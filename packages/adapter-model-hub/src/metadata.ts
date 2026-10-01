import { mkdir, readFile, rename, rm, writeFile } from 'fs/promises'
import { randomUUID } from 'crypto'
import { dirname, resolve } from 'path'
import { parseOpenAIModelNameWithReasoningEffort } from '@chatluna/v1-shared-adapter'
import type { Context } from 'koishi'
import { ModelCapabilities } from 'koishi-plugin-chatluna/llm-core/platform/types'
import type { ProviderModelEntry, ReasoningEffortLevel } from './types'

type ModelsDevModel = {
    id?: string
    name?: string
    attachment?: boolean
    reasoning?: boolean
    reasoning_effort?: boolean | string[]
    reasoning_efforts?: string[]
    supported_reasoning_efforts?: string[]
    reasoning_options?: {
        type?: string
        values?: string[]
    }[]
    supported_parameters?: string[]
    tool_call?: boolean
    modalities?: {
        input?: string[]
        output?: string[]
    }
    limit?: {
        context?: number
        input?: number
        output?: number
    }
}

type ModelsDevCatalog =
    | {
          models?: Record<string, ModelsDevModel>
      }
    | Record<string, ModelsDevModel>

export class ModelMetadataStore {
    private _models = new Map<string, ModelsDevModel>()
    private _aliases = new Map<string, ModelsDevModel | undefined>()
    private _timer?: ReturnType<typeof setInterval>
    private _refreshing?: Promise<void>
    private _disposed = false
    private _controller?: AbortController

    readonly path: string

    constructor(
        private ctx: Context,
        private options: {
            url?: string
            cachePath?: string
            updateHours?: number
            onStatus?: (error?: unknown) => void
            onUpdate?: () => Promise<void>
        } = {}
    ) {
        this.path = resolve(
            ctx.baseDir,
            options.cachePath ||
                'data/chatluna-model-hub/models.dev.models.json'
        )
    }

    async start() {
        if (this._timer || this._disposed) return
        const interval =
            Math.max(1, this.options.updateHours ?? 24) * 60 * 60 * 1000
        this._timer = setInterval(() => {
            this.refresh()
                .then(() =>
                    this._disposed ? undefined : this.options.onUpdate?.()
                )
                .catch((error) =>
                    this.ctx.logger('chatluna-model-hub-adapter').warn(error)
                )
        }, interval)
        this.ctx.on('dispose', () => {
            this._disposed = true
            if (this._timer) clearInterval(this._timer)
            this._controller?.abort()
        })
        // A corrupt disk cache must not prevent downloading a fresh catalog.
        try {
            await this.load()
        } catch (error) {
            this.ctx.logger('chatluna-model-hub-adapter').warn(error)
        }
        await this.refresh()
    }

    async load() {
        try {
            const raw = await readFile(this.path, 'utf8')
            this.apply(JSON.parse(raw) as ModelsDevCatalog)
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
        }
    }

    refresh(): Promise<void> {
        if (this._disposed) return Promise.resolve()
        if (this._refreshing) return this._refreshing
        this._refreshing = this.refreshInternal()
            .then(
                () => {
                    if (!this._disposed) this.options.onStatus?.()
                },
                (error) => {
                    if (!this._disposed) this.options.onStatus?.(error)
                    throw error
                }
            )
            .finally(() => {
                this._refreshing = undefined
            })
        return this._refreshing
    }

    private async refreshInternal() {
        const catalog = await this.downloadCatalog(
            this.options.url || 'https://models.dev/api.json'
        )
        validateCatalog(catalog)
        if (this._disposed) return
        const temporaryPath = `${this.path}.${randomUUID()}.tmp`
        try {
            await mkdir(dirname(this.path), { recursive: true })
            await writeFile(
                temporaryPath,
                `${JSON.stringify(catalog)}\n`,
                'utf8'
            )
            if (this._disposed) return
            await rename(temporaryPath, this.path)
            this.apply(catalog)
        } finally {
            await rm(temporaryPath, { force: true })
        }
    }

    enhance(provider: string, model: ProviderModelEntry): ProviderModelEntry {
        const metadata = this.findEntry(provider, model)
        if (!metadata) return model

        return {
            ...model,
            maxTokens:
                positiveNumber(model.maxTokens) ?? metadataMaxTokens(metadata),
            capabilities: mergeCapabilities(
                model.capabilities,
                capabilitiesFromMetadata(metadata)
            ),
            capabilityOverrides: {
                ...capabilityOverridesFromMetadata(metadata),
                ...model.capabilityOverrides
            },
            reasoningEfforts:
                model.reasoningEfforts ??
                reasoningEffortsFromMetadata(provider, metadata)
        }
    }

    getMaxTokens(provider: string, model: string) {
        const metadata = this.find(provider, model)
        return metadata ? metadataMaxTokens(metadata) : undefined
    }

    private apply(catalog: ModelsDevCatalog) {
        validateCatalog(catalog)
        this._models.clear()
        this._aliases.clear()
        for (const [id, model] of Object.entries(modelsFromCatalog(catalog))) {
            const keys = new Set([
                id,
                ...(!id.includes('/') && model.id ? [model.id] : [])
            ])
            for (const key of keys) {
                const normalized = normalizeModelId(key)
                this._models.set(normalized, model)

                const alias = modelAlias(normalized)
                if (alias !== normalized) this.setAlias(alias, model)
            }
        }
    }

    private findEntry(provider: string, model: ProviderModelEntry) {
        return (
            this.find(provider, model.name) ??
            (model.reasoningVariantOf
                ? this.find(provider, model.reasoningVariantOf)
                : undefined)
        )
    }

    private find(provider: string, model: string) {
        for (const candidate of metadataLookupCandidates(model)) {
            const metadata = this.findCandidate(provider, candidate)
            if (metadata) return metadata
        }
    }

    private findCandidate(provider: string, model: string) {
        for (const prefix of providerPrefixes(provider)) {
            const prefixed = this._models.get(
                normalizeModelId(`${prefix}/${model}`)
            )
            if (prefixed) return prefixed
        }

        const exact = this._models.get(normalizeModelId(model))
        if (exact) return exact

        const alias = this._aliases.get(normalizeModelId(model))
        if (alias) return alias
    }

    private setAlias(alias: string, model: ModelsDevModel) {
        if (!alias) return

        if (!this._aliases.has(alias)) {
            this._aliases.set(alias, model)
            return
        }

        if (this._aliases.get(alias) !== model) {
            this._aliases.set(alias, undefined)
        }
    }

    private async downloadCatalog(url: string): Promise<ModelsDevCatalog> {
        const controller = new AbortController()
        this._controller = controller
        const timer = setTimeout(() => controller.abort(), 60_000)
        try {
            if (this.ctx.http != null) {
                const response = await this.ctx.http<ModelsDevCatalog>(url, {
                    method: 'GET',
                    responseType: 'json',
                    timeout: 60_000,
                    signal: controller.signal
                })
                return response.data
            }

            const response = await fetch(url, { signal: controller.signal })
            if (!response.ok) {
                throw new Error(
                    `Failed to download models.dev catalog: ${response.status}`
                )
            }
            return (await response.json()) as ModelsDevCatalog
        } finally {
            clearTimeout(timer)
            this._controller = undefined
        }
    }
}

function reasoningEffortsFromMetadata(
    provider: string,
    model: ModelsDevModel
): ReasoningEffortLevel[] | undefined {
    const values = [
        ...(Array.isArray(model.reasoning_effort)
            ? model.reasoning_effort
            : []),
        ...(model.reasoning_efforts ?? []),
        ...(model.supported_reasoning_efforts ?? []),
        ...reasoningOptionEfforts(model.reasoning_options)
    ]
        .map(normalizeReasoningEffort)
        .filter((value): value is ReasoningEffortLevel => value != null)

    if (values.length > 0) return [...new Set(values)]

    if (provider === 'anthropic') return undefined

    if (
        model.reasoning_effort === true ||
        model.supported_parameters?.includes('reasoning_effort')
    ) {
        return ['low', 'medium', 'high']
    }

    if (model.reasoning === true) return ['low', 'medium', 'high']
}

function reasoningOptionEfforts(options: ModelsDevModel['reasoning_options']) {
    return (options ?? [])
        .filter((option) => option?.type === 'effort')
        .flatMap((option) => option.values ?? [])
}

function normalizeReasoningEffort(
    value: unknown
): ReasoningEffortLevel | undefined {
    if (typeof value !== 'string') return undefined
    const normalized = value
        .trim()
        .toLowerCase()
        .replace(/[-_\s]*thinking$/, '')

    if (normalized === 'tiny') return 'minimal'
    if (
        normalized === 'none' ||
        normalized === 'minimal' ||
        normalized === 'low' ||
        normalized === 'medium' ||
        normalized === 'high' ||
        normalized === 'xhigh' ||
        normalized === 'max'
    ) {
        return normalized
    }
}

function modelsFromCatalog(catalog: ModelsDevCatalog) {
    if (isRecord(catalog) && isModelMap(catalog.models)) {
        return catalog.models
    }

    const providerModels: Record<string, ModelsDevModel> = {}
    for (const [provider, value] of Object.entries(catalog)) {
        if (!isRecord(value) || !isModelMap(value.models)) continue
        for (const [id, model] of Object.entries(value.models)) {
            providerModels[`${provider}/${id}`] = model
        }
    }
    if (Object.keys(providerModels).length > 0) return providerModels

    return catalog as Record<string, ModelsDevModel>
}

function isModelMap(value: unknown): value is Record<string, ModelsDevModel> {
    if (!isRecord(value)) return false
    return Object.values(value).some(isModelsDevModel)
}

function isModelsDevModel(value: unknown): value is ModelsDevModel {
    if (!isRecord(value)) return false

    const modalities = value.modalities
    return (
        typeof value.id === 'string' ||
        typeof value.name === 'string' ||
        isRecord(value.limit) ||
        (isRecord(modalities) && Array.isArray(modalities.input)) ||
        typeof value.reasoning === 'boolean' ||
        typeof value.tool_call === 'boolean'
    )
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return value != null && typeof value === 'object' && !Array.isArray(value)
}

function normalizeModelId(value: string) {
    return value.trim().toLowerCase()
}

function metadataLookupCandidates(model: string) {
    const exact = model.trim()
    const realModel =
        parseOpenAIModelNameWithReasoningEffort(exact).model.trim()
    return unique([exact, realModel].filter(Boolean))
}

function unique(values: string[]) {
    return [...new Set(values)]
}

function modelAlias(value: string) {
    const index = value.lastIndexOf('/')
    return index >= 0 ? value.slice(index + 1) : value
}

function providerPrefixes(provider: string) {
    const map: Record<string, string[]> = {
        openai: ['openai'],
        gemini: ['google'],
        deepseek: ['deepseek'],
        qwen: ['alibaba'],
        zhipu: ['zhipuai'],
        moonshot: ['moonshotai'],
        xai: ['xai'],
        minimax: ['minimax'],
        mistral: ['mistral'],
        anthropic: ['anthropic'],
        groq: ['groq'],
        together: ['togetherai', 'together'],
        modelscope: ['modelscope'],
        openrouter: ['openrouter']
    }
    return map[provider] ?? [provider]
}

function capabilitiesFromMetadata(model: ModelsDevModel) {
    const capabilities: ModelCapabilities[] = []
    const input = new Set(model.modalities?.input ?? [])
    const output = new Set(model.modalities?.output ?? [])

    if (model.tool_call) capabilities.push(ModelCapabilities.ToolCall)
    if (model.reasoning) capabilities.push(ModelCapabilities.Thinking)
    if (input.has('image')) capabilities.push(ModelCapabilities.ImageInput)
    if (input.has('audio')) capabilities.push(ModelCapabilities.AudioInput)
    if (input.has('video')) capabilities.push(ModelCapabilities.VideoInput)
    if (input.has('pdf')) capabilities.push(ModelCapabilities.FileInput)
    if (output.has('image'))
        capabilities.push(ModelCapabilities.ImageGeneration)

    return capabilities
}

function capabilityOverridesFromMetadata(
    model: ModelsDevModel
): ProviderModelEntry['capabilityOverrides'] {
    const result: NonNullable<ProviderModelEntry['capabilityOverrides']> = {}
    if (typeof model.tool_call === 'boolean')
        result[ModelCapabilities.ToolCall] = model.tool_call
    if (typeof model.reasoning === 'boolean')
        result[ModelCapabilities.Thinking] = model.reasoning
    if (Array.isArray(model.modalities?.input)) {
        const input = new Set(model.modalities.input)
        result[ModelCapabilities.ImageInput] = input.has('image')
        result[ModelCapabilities.AudioInput] = input.has('audio')
        result[ModelCapabilities.VideoInput] = input.has('video')
        result[ModelCapabilities.FileInput] =
            input.has('file') || input.has('pdf')
    }
    if (Array.isArray(model.modalities?.output)) {
        result[ModelCapabilities.ImageGeneration] =
            model.modalities.output.includes('image')
    }
    return result
}

function validateCatalog(catalog: ModelsDevCatalog) {
    const models = isRecord(catalog)
        ? Object.values(modelsFromCatalog(catalog))
        : []
    if (
        !models.length ||
        !models.every(
            (model) =>
                isModelsDevModel(model) &&
                (model.id == null || typeof model.id === 'string')
        )
    ) {
        throw new Error(
            'Invalid or empty models.dev catalog; keeping the last known cache.'
        )
    }
}

function metadataMaxTokens(model: ModelsDevModel) {
    return (
        positiveNumber(model.limit?.context) ??
        positiveNumber(model.limit?.input)
    )
}

function positiveNumber(value: unknown) {
    return typeof value === 'number' && Number.isFinite(value) && value > 0
        ? value
        : undefined
}

function mergeCapabilities(
    preferred: ModelCapabilities[] | undefined,
    fallback: ModelCapabilities[]
) {
    if ((preferred?.length ?? 0) < 1) return fallback
    return [...new Set([...(preferred ?? []), ...fallback])]
}
