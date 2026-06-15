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
    getOpenAIFileHandlingConfig,
    isEmbeddingModel,
    isImageGenerationModel,
    isNonLLMModel,
    isRerankerModel,
    supportAudioInput,
    supportImageInput
} from '@chatluna/v1-shared-adapter'
import { logger } from '.'
import { ModelHubRequester } from './requester'
import {
    getTargetedAdditionalModels,
    getTargetedBlacklist
} from './providers'
import { ModelMetadataStore } from './metadata'
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
                current?.pullModels === true
                    ? await this._requester.getModels(config)
                    : []

            const apiModels = rawModels
                .filter(
                    (model) => !isNonLLMModel(model.name) || isImageGenerationModel(model.name)
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

            return this._dedupeModels([
                ...apiModels,
                ...additionalModels
            ]).filter((model) => {
                const id = model.name.toLowerCase()
                return !blacklist.some((keyword) => id.includes(keyword))
            })
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
                new Error(
                    `The model ${model} is not found in ${this.platform}`
                )
            )
        }

        if (info.type === ModelType.llm) {
            const modelMaxContextSize = getModelMaxContextSize(info)
            return new ChatLunaChatModel({
                usageReporter: report,
                modelInfo: info,
                requester: this._requester,
                model,
                maxTokenLimit: Math.floor(
                    (info.maxTokens || modelMaxContextSize || 128_000) *
                        this._config.maxContextRatio
                ),
                modelMaxContextSize,
                frequencyPenalty: this._config.frequencyPenalty,
                presencePenalty: this._config.presencePenalty,
                timeout: this._config.timeout,
                temperature: this._config.temperature,
                maxRetries: this._config.maxRetries,
                llmType: this._runtime.provider.id,
                fileHandlingConfig: getOpenAIFileHandlingConfig(model),
                isThinkModel: this._isThinkModel(model, info)
            })
        }

        if (info.type === ModelType.reranker) {
            return new ChatLunaReranker({
                usageReporter: report,
                client: this._requester,
                model,
                maxRetries: this._config.maxRetries,
                timeout: this._config.timeout
            })
        }

        return new ChatLunaEmbeddings({
            usageReporter: report,
            client: this._requester,
            model,
            maxRetries: this._config.maxRetries
        })
    }

    private _inferModelInfo(model: { name: string; maxTokens?: number }): ModelInfo {
        const name = model.name
        const lower = name.toLowerCase()
        const type = isRerankerModel(lower)
            ? ModelType.reranker
            : isEmbeddingModel(lower)
              ? ModelType.embeddings
              : ModelType.llm

        if (isImageGenerationModel(lower)) {
            return {
                name,
                type: ModelType.llm,
                maxTokens: model.maxTokens ?? 4096,
                capabilities: [ModelCapabilities.ImageGeneration]
            }
        }

        const info = {
            name,
            type,
            maxTokens:
                model.maxTokens ??
                this._metadata.getMaxTokens(this._runtime.provider.id, name) ??
                0,
            capabilities:
                type === ModelType.llm
                    ? [
                          ModelCapabilities.ToolCall,
                          supportImageInput(name)
                              ? ModelCapabilities.ImageInput
                              : null,
                          supportAudioInput(name)
                              ? ModelCapabilities.AudioInput
                              : null
                      ].filter(Boolean)
                    : []
        } as ModelInfo

        info.maxTokens =
            type === ModelType.llm
                ? info.maxTokens || getModelMaxContextSize(info)
                : info.maxTokens || 8192

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
            maxTokens: model.contextSize ?? 4096,
            capabilities:
                type === ModelType.llm
                    ? model.modelCapabilities
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

    private _isThinkModel(model: string, info: ModelInfo) {
        const lower = model.toLowerCase()
        return (
            info.capabilities.includes(ModelCapabilities.Thinking) ||
            lower.includes('reasoner') ||
            lower.includes('thinking') ||
            lower.includes('reasoning') ||
            lower.includes('r1') ||
            lower.startsWith('o1') ||
            lower.startsWith('o3') ||
            lower.startsWith('o4') ||
            lower.startsWith('gpt-5')
        )
    }
}
