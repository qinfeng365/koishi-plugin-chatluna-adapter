import { RunnableConfig } from '@langchain/core/runnables'
import { Context } from 'koishi'
import { PlatformModelEmbeddingsAndRerankerClient } from 'koishi-plugin-chatluna/llm-core/platform/client'
import {
    ChatLunaBaseEmbeddings,
    ChatLunaChatModel,
    ChatLunaEmbeddings
} from 'koishi-plugin-chatluna/llm-core/platform/model'
import { ChatLunaReranker } from 'koishi-plugin-chatluna/llm-core/platform/rerank'
import {
    FileHandlingConfig,
    ModelCapabilities,
    ModelInfo,
    ModelType
} from 'koishi-plugin-chatluna/llm-core/platform/types'
import type { ModelUsageReporter } from 'koishi-plugin-chatluna/llm-core/platform/usage'
import {
    ChatLunaError,
    ChatLunaErrorCode
} from 'koishi-plugin-chatluna/utils/error'
import { ChatLunaPlugin } from 'koishi-plugin-chatluna/services/chat'
import {
    getModelMaxContextSize,
    isEmbeddingModel,
    isImageGenerationModel,
    isNonLLMModel,
    isRerankerModel
} from '@chatluna/v1-shared-adapter'
import { logger } from '.'
import { ModelHubRequester } from './requester'
import { getTargetedAdditionalModels, getTargetedBlacklist } from './providers'
import { ModelMetadataStore } from './metadata'
import {
    capabilityFileHandling,
    protocolCapabilities,
    resolveCapabilities
} from './capabilities'
import type { GeminiResourceRequest } from './adapters/gemini-resources'
import { expandReasoningVariantsForProvider } from './adapters/model-list'
import type {
    AdditionalModelEntry,
    ModelHubClientConfig,
    ModelHubResolvedConfig,
    RuntimeProvider
} from './types'

export class ModelHubClient extends PlatformModelEmbeddingsAndRerankerClient<ModelHubClientConfig> {
    platform: string

    private _requester: ModelHubRequester

    constructor(
        ctx: Context,
        private _config: ModelHubResolvedConfig,
        public plugin: ChatLunaPlugin<
            ModelHubClientConfig,
            ModelHubResolvedConfig
        >,
        private _runtime: RuntimeProvider,
        private _metadata: ModelMetadataStore
    ) {
        super(ctx, plugin.platformConfigPool)
        this.platform = _runtime.platform
        this._requester = new ModelHubRequester(
            ctx,
            plugin.platformConfigPool,
            _config,
            plugin
        )
    }

    async refreshModels(config?: RunnableConfig): Promise<ModelInfo[]> {
        try {
            const current = this.config
            const rawModels =
                current?.pullModels === true ||
                this._runtime.provider.adapter === 'dify'
                    ? await this._requester.getModels(config)
                    : []

            const enhancedModels = rawModels.map((model) =>
                this._metadata.enhance(this._runtime.provider.id, model)
            )

            const providerModels =
                current?.expandReasoningVariants === true
                    ? expandReasoningVariantsForProvider(
                          this._runtime.provider,
                          enhancedModels,
                          {
                              reasoningProtocol: current?.reasoningProtocol
                          }
                      )
                    : enhancedModels

            const apiModels = providerModels
                .filter(
                    (model) =>
                        !isNonLLMModel(model.name) ||
                        isImageGenerationModel(model.name)
                )
                .map((model) => this._inferModelInfo(model))

            const additionalModels = getTargetedAdditionalModels(
                this._config.additionalModels,
                this._runtime.platform,
                this._runtime.provider.id
            ).map((model) => this._additionalModelInfo(model))

            const blacklist = getTargetedBlacklist(
                this._config.blacklistModels,
                this._runtime.platform,
                this._runtime.provider.id
            )

            const models = this._dedupeModels([
                ...apiModels,
                ...additionalModels
            ]).filter((model) => {
                const id = model.name.toLowerCase()
                return !blacklist.some((keyword) => id.includes(keyword))
            })
            this._requester.setModelCapabilities(models)
            return models
        } catch (e) {
            if (e instanceof ChatLunaError) {
                throw e
            }
            throw new ChatLunaError(ChatLunaErrorCode.MODEL_INIT_ERROR, e)
        }
    }

    async reloadModels(config?: RunnableConfig) {
        this._modelInfos = {}
        return await this.getModels(config)
    }

    async geminiResource(request: GeminiResourceRequest) {
        return this._requester.geminiResources().request(request)
    }

    registerSelf() {
        this.ctx.chatluna.platform.registerClient(this.platform, () => this)
    }

    getFileHandlingConfig(): FileHandlingConfig | null {
        if (this._runtime.provider.adapter === 'anthropic') {
            return ANTHROPIC_FILE_HANDLING_CONFIG
        }

        if (this._runtime.provider.adapter !== 'dify') {
            return null
        }

        const configs = Object.keys(this.config.difyApps ?? {})
            .map((model) => this._difyFileHandlingConfig(model))
            .filter((item): item is FileHandlingConfig => item != null)

        if (configs.length < 1) return null

        const supportedMimeTypes = new Set<string>()
        const maxFileSizeBytesOverrides: Record<string, number> = {}
        let maxTotalSizeBytes = 0
        let maxFileSizeBytes = 0

        for (const config of configs) {
            for (const mimeType of config.supportedMimeTypes) {
                supportedMimeTypes.add(mimeType)
            }
            maxTotalSizeBytes = Math.max(
                maxTotalSizeBytes,
                config.maxTotalSizeBytes
            )
            maxFileSizeBytes = Math.max(
                maxFileSizeBytes,
                config.maxFileSizeBytes
            )
            for (const [mimeType, size] of Object.entries(
                config.maxFileSizeBytesOverrides ?? {}
            )) {
                maxFileSizeBytesOverrides[mimeType] = Math.max(
                    maxFileSizeBytesOverrides[mimeType] ?? 0,
                    size
                )
            }
        }

        return {
            supportedMimeTypes,
            maxTotalSizeBytes,
            maxFileSizeBytes,
            maxFileSizeBytesOverrides
        }
    }

    protected _createModel(
        model: string,
        report: ModelUsageReporter
    ): ChatLunaChatModel | ChatLunaBaseEmbeddings | ChatLunaReranker {
        const info = this._modelInfos[model]

        if (info == null) {
            logger.warn(
                `Model ${model} not found`,
                JSON.stringify(this._modelInfos)
            )
            throw new ChatLunaError(
                ChatLunaErrorCode.MODEL_NOT_FOUND,
                new Error(`The model ${model} is not found in ${this.platform}`)
            )
        }

        if (info.type === ModelType.llm) {
            const current = this.config ?? this._config
            const modelMaxContextSize = getModelMaxContextSize(info)
            return new ChatLunaChatModel({
                usageReporter: report,
                modelInfo: info,
                requester: this._requester,
                model,
                maxTokenLimit: Math.floor(
                    (info.maxTokens || modelMaxContextSize || 128_000) *
                        current.maxContextRatio
                ),
                modelMaxContextSize,
                frequencyPenalty: current.frequencyPenalty,
                presencePenalty: current.presencePenalty,
                timeout: current.timeout,
                temperature: current.temperature,
                maxRetries: current.maxRetries,
                llmType: this._runtime.provider.id,
                fileHandlingConfig: this._fileHandlingConfig(model, info),
                isThinkModel: info.capabilities.includes(
                    ModelCapabilities.Thinking
                )
            })
        }

        if (info.type === ModelType.reranker) {
            const current = this.config ?? this._config
            return new ChatLunaReranker({
                usageReporter: report,
                client: this._requester,
                model,
                maxRetries: current.maxRetries,
                timeout: current.timeout
            })
        }

        const current = this.config ?? this._config
        return new ChatLunaEmbeddings({
            usageReporter: report,
            client: this._requester,
            model,
            maxRetries: current.maxRetries
        })
    }

    private _inferModelInfo(model: {
        name: string
        type?: ModelType
        maxTokens?: number
        capabilities?: ModelCapabilities[]
        reasoningVariantOf?: string
    }): ModelInfo {
        const name = model.name
        const lower = name.toLowerCase()
        const type =
            model.type ??
            (isRerankerModel(lower)
                ? ModelType.reranker
                : isEmbeddingModel(lower)
                  ? ModelType.embeddings
                  : ModelType.llm)

        if (isImageGenerationModel(lower)) {
            return {
                name,
                type: ModelType.llm,
                maxTokens: positiveNumber(model.maxTokens) ?? 4096,
                capabilities: resolveCapabilities(
                    this._runtime.provider.adapter,
                    {
                        ...model,
                        capabilities: [
                            ...(model.capabilities ?? []),
                            ModelCapabilities.ImageGeneration
                        ]
                    },
                    this.config?.responseApi === true
                ).filter(
                    (capability) => capability !== ModelCapabilities.ToolCall
                )
            }
        }

        const maxTokens =
            positiveNumber(model.maxTokens) ??
            positiveNumber(
                this._metadata.getMaxTokens(this._runtime.provider.id, name)
            )

        const info = {
            name,
            type,
            ...(model.reasoningVariantOf
                ? { reasoningVariantOf: model.reasoningVariantOf }
                : {}),
            maxTokens:
                type === ModelType.llm
                    ? (maxTokens ?? this._fallbackModelMaxContextSize(name))
                    : (maxTokens ?? this._nonLlmInputTokenLimit()),
            capabilities:
                type === ModelType.llm
                    ? resolveCapabilities(
                          this._runtime.provider.adapter,
                          model,
                          this.config?.responseApi === true
                      )
                    : []
        } as ModelInfo

        return info
    }

    private _additionalModelInfo(model: AdditionalModelEntry): ModelInfo {
        const type =
            model.modelType === 'embeddings' ||
            model.modelType === 'Embeddings 嵌入模型'
                ? ModelType.embeddings
                : model.modelType === 'reranker' ||
                    model.modelType === 'Reranker 重排序模型'
                  ? ModelType.reranker
                  : ModelType.llm

        return {
            name: model.model,
            type,
            maxTokens: positiveNumber(model.contextSize) ?? 4096,
            capabilities:
                type === ModelType.llm
                    ? protocolCapabilities(
                          this._runtime.provider.adapter,
                          model.modelCapabilities,
                          this.config?.responseApi === true
                      )
                    : model.modelCapabilities.filter(
                          (cap) => cap !== ModelCapabilities.ToolCall
                      )
        }
    }

    private _dedupeModels(models: ModelInfo[]) {
        const result = new Map<string, ModelInfo>()
        for (const model of models) {
            if (!model.name) continue
            result.set(model.name, model)
        }
        return [...result.values()]
    }

    private _fallbackModelMaxContextSize(model: string) {
        const inferred = getModelMaxContextSize({
            name: model,
            type: ModelType.llm,
            maxTokens: undefined as unknown as number,
            capabilities: []
        })
        return positiveNumber(inferred) ?? 128_000
    }

    private _nonLlmInputTokenLimit() {
        return positiveNumber(this.config?.nonLlmInputTokenLimit) ?? 8192
    }

    private _fileHandlingConfig(
        model: string,
        info: ModelInfo
    ): FileHandlingConfig | undefined {
        if (this._runtime.provider.adapter === 'anthropic') {
            const supportedMimeTypes = new Set(
                [...ANTHROPIC_FILE_HANDLING_CONFIG.supportedMimeTypes].filter(
                    (mime) =>
                        info.capabilities.includes(
                            mime.startsWith('image/')
                                ? ModelCapabilities.ImageInput
                                : ModelCapabilities.FileInput
                        )
                )
            )
            return supportedMimeTypes.size > 0
                ? { ...ANTHROPIC_FILE_HANDLING_CONFIG, supportedMimeTypes }
                : undefined
        }

        if (this._runtime.provider.adapter !== 'dify') {
            const config = capabilityFileHandling(
                this._runtime.provider.adapter,
                info.capabilities
            )
            if (
                config &&
                this._runtime.provider.adapter === 'gemini' &&
                this.config.geminiFileUpload
            ) {
                const limit =
                    Math.min(this.config.geminiMaxFileSizeMb ?? 64, 2048) *
                    1024 *
                    1024
                return {
                    ...config,
                    maxFileSizeBytes: limit,
                    maxTotalSizeBytes: limit
                }
            }
            return config
        }
        if (!info.capabilities.includes(ModelCapabilities.FileInput)) {
            return undefined
        }
        const difyFileHandling = this._difyFileHandlingConfig(model)
        if (difyFileHandling != null) return difyFileHandling

        return {
            supportedMimeTypes: new Set([
                'image/png',
                'image/jpeg',
                'image/gif',
                'image/webp',
                'image/svg+xml',
                'application/pdf',
                'text/plain',
                'text/markdown',
                'audio/mpeg',
                'audio/wav',
                'audio/ogg',
                'video/mp4',
                'video/quicktime'
            ]),
            maxTotalSizeBytes: 100 * 1024 * 1024,
            maxFileSizeBytes: 50 * 1024 * 1024,
            maxFileSizeBytesOverrides: {
                'application/pdf': 50 * 1024 * 1024,
                'video/mp4': 100 * 1024 * 1024,
                'video/quicktime': 100 * 1024 * 1024
            }
        }
    }

    private _difyFileHandlingConfig(
        model: string
    ): FileHandlingConfig | undefined {
        const app = this.config.difyApps?.[model]
        const limits = app?.parameters?.fileHandling
        if (limits == null) return undefined

        return {
            supportedMimeTypes: new Set(limits.supportedMimeTypes),
            maxTotalSizeBytes: limits.maxTotalSizeBytes,
            maxFileSizeBytes: limits.maxFileSizeBytes,
            maxFileSizeBytesOverrides: limits.maxFileSizeBytesOverrides
        }
    }
}

function positiveNumber(value: unknown) {
    return typeof value === 'number' && Number.isFinite(value) && value > 0
        ? value
        : undefined
}

const ANTHROPIC_FILE_HANDLING_CONFIG: FileHandlingConfig = {
    supportedMimeTypes: new Set<string>([
        'text/html',
        'text/css',
        'text/plain',
        'text/markdown',
        'text/xml',
        'text/csv',
        'text/rtf',
        'text/javascript',
        'application/json',
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp'
    ]),
    maxTotalSizeBytes: 32 * 1024 * 1024,
    maxFileSizeBytes: 32 * 1024 * 1024,
    maxFileSizeBytesOverrides: {
        'image/jpeg': 5 * 1024 * 1024,
        'image/png': 5 * 1024 * 1024,
        'image/gif': 5 * 1024 * 1024,
        'image/webp': 5 * 1024 * 1024
    }
}
