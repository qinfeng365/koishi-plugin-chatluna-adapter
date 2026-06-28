import { mkdir, readFile, writeFile } from 'fs/promises'
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

type ModelsDevCatalog = {
    models?: Record<string, ModelsDevModel>
} | Record<string, ModelsDevModel>

export class ModelMetadataStore {
    private _models = new Map<string, ModelsDevModel>()
    private _aliases = new Map<string, ModelsDevModel | undefined>()
    private _timer?: ReturnType<typeof setInterval>

    readonly path: string

    constructor(
        private ctx: Context,
        private options: {
            url?: string
            cachePath?: string
            updateHours?: number
        } = {}
    ) {
        this.path = resolve(
            ctx.baseDir,
            options.cachePath || 'data/chatluna-model-hub/models.dev.models.json'
        )
    }

    async start() {
        await this.load()
        await this.refresh()
        const interval = Math.max(1, this.options.updateHours ?? 24) * 60 * 60 * 1000
        this._timer = setInterval(() => {
            this.refresh().catch((error) => this.ctx.logger('chatluna-model-hub-adapter').warn(error))
        }, interval)
        this.ctx.on('dispose', () => {
            if (this._timer) clearInterval(this._timer)
        })
    }

    async load() {
        try {
            const raw = await readFile(this.path, 'utf8')
            this.apply(JSON.parse(raw) as ModelsDevCatalog)
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
        }
    }

    async refresh() {
        const url = this.options.url || 'https://models.dev/models.json'
        const catalog = await this.downloadCatalog(url)
        this.apply(catalog)
        await mkdir(dirname(this.path), { recursive: true })
        await writeFile(this.path, `${JSON.stringify(catalog)}\n`, 'utf8')
    }

    enhance(provider: string, model: ProviderModelEntry): ProviderModelEntry {
        const metadata = this.findEntry(provider, model)
        if (!metadata) return model

        return {
            ...model,
            maxTokens:
                positiveNumber(model.maxTokens) ??
                metadataMaxTokens(metadata),
            capabilities: mergeCapabilities(
                model.capabilities,
                capabilitiesFromMetadata(metadata)
            ),
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
        this._models.clear()
        this._aliases.clear()
        for (const [id, model] of Object.entries(modelsFromCatalog(catalog))) {
            const keys = new Set([id, model.id].filter(Boolean) as string[])
            for (const key of keys) {
                const normalized = normalizeModelId(key)
                this._models.set(normalized, model)

                const alias = modelAlias(normalized)
                if (alias !== normalized) this.setAlias(alias, model)
            }
        }
    }

    private findEntry(provider: string, model: ProviderModelEntry) {
        return this.find(provider, model.name) ??
            (model.reasoningVariantOf
                ? this.find(provider, model.reasoningVariantOf)
                : undefined)
    }

    private find(provider: string, model: string) {
        for (const candidate of metadataLookupCandidates(model)) {
            const metadata = this.findCandidate(provider, candidate)
            if (metadata) return metadata
        }
    }

    private findCandidate(provider: string, model: string) {
        const exact = this._models.get(normalizeModelId(model))
        if (exact) return exact

        for (const prefix of providerPrefixes(provider)) {
            const prefixed = this._models.get(normalizeModelId(`${prefix}/${model}`))
            if (prefixed) return prefixed
        }

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
        if (this.ctx.http != null) {
            const response = await this.ctx.http<ModelsDevCatalog>(url, {
                method: 'GET',
                responseType: 'json',
                timeout: 60_000
            })
            return response.data
        }

        const response = await fetch(url)
        if (!response.ok) {
            throw new Error(
                `Failed to download models.dev catalog: ${response.status}`
            )
        }
        return (await response.json()) as ModelsDevCatalog
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
        ...(model.supported_reasoning_efforts ?? [])
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
    if ('models' in catalog && catalog.models != null) {
        return catalog.models
    }
    return catalog as Record<string, ModelsDevModel>
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
        openrouter: []
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
    if (output.has('image')) capabilities.push(ModelCapabilities.ImageGeneration)

    return capabilities
}

function metadataMaxTokens(model: ModelsDevModel) {
    return positiveNumber(model.limit?.context) ?? positiveNumber(model.limit?.input)
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
