import { mkdir, readFile, writeFile } from 'fs/promises'
import { dirname, resolve } from 'path'
import type { Context } from 'koishi'
import { ModelCapabilities } from 'koishi-plugin-chatluna/llm-core/platform/types'
import type { ProviderModelEntry } from './types'

type ModelsDevModel = {
    id?: string
    name?: string
    attachment?: boolean
    reasoning?: boolean
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
        const response = await fetch(
            this.options.url || 'https://models.dev/models.json'
        )
        if (!response.ok) {
            throw new Error(`Failed to download models.dev catalog: ${response.status}`)
        }
        const catalog = (await response.json()) as ModelsDevCatalog
        this.apply(catalog)
        await mkdir(dirname(this.path), { recursive: true })
        await writeFile(this.path, `${JSON.stringify(catalog)}\n`, 'utf8')
    }

    enhance(provider: string, model: ProviderModelEntry): ProviderModelEntry {
        const metadata = this.find(provider, model.name)
        if (!metadata) return model

        return {
            ...model,
            maxTokens:
                model.maxTokens ??
                metadata.limit?.context ??
                metadata.limit?.input,
            capabilities: mergeCapabilities(
                model.capabilities,
                capabilitiesFromMetadata(metadata)
            )
        }
    }

    getMaxTokens(provider: string, model: string) {
        const metadata = this.find(provider, model)
        return metadata?.limit?.context ?? metadata?.limit?.input
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

    private find(provider: string, model: string) {
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

function mergeCapabilities(
    preferred: ModelCapabilities[] | undefined,
    fallback: ModelCapabilities[]
) {
    if ((preferred?.length ?? 0) < 1) return fallback
    return [...new Set([...(preferred ?? []), ...fallback])]
}
