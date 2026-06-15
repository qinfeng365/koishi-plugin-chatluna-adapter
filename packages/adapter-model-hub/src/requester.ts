import { ChatGeneration, ChatGenerationChunk } from '@langchain/core/outputs'
import { RunnableConfig } from '@langchain/core/runnables'
import { Context } from 'koishi'
import {
    EmbeddingsRequester,
    EmbeddingsRequestParams,
    EmbeddingsResult,
    ModelRequester,
    ModelRequestParams,
    RerankerRequester,
    RerankerRequestParams,
    RerankerResult,
    RerankerUsageResult
} from 'koishi-plugin-chatluna/llm-core/platform/api'
import type { ResponseBuiltinTool, ResponseImageProvider } from '@chatluna/v1-shared-adapter'
import type { ClientConfigPool } from 'koishi-plugin-chatluna/llm-core/platform/config'
import { ChatLunaPlugin } from 'koishi-plugin-chatluna/services/chat'
import { createRequestContext } from '@chatluna/v1-shared-adapter'
import { logger } from '.'
import { getProviderPreset, targetMatches } from './providers'
import { getProviderAdapter } from './adapters/registry'
import type {
    ModelHubClientConfig,
    ModelHubResolvedConfig,
    ProviderModelEntry
} from './types'

export class ModelHubRequester
    extends ModelRequester<ModelHubClientConfig, ModelHubResolvedConfig>
    implements EmbeddingsRequester, RerankerRequester
{
    constructor(
        ctx: Context,
        configPool: ClientConfigPool<ModelHubClientConfig>,
        pluginConfig: ModelHubResolvedConfig,
        plugin: ChatLunaPlugin<ModelHubClientConfig, ModelHubResolvedConfig>
    ) {
        super(ctx, configPool, pluginConfig, plugin)
    }

    async completion(params: ModelRequestParams): Promise<ChatGeneration> {
        return await this._adapter().completion(this, params)
    }

    async *completionStream(
        params: ModelRequestParams
    ): AsyncGenerator<ChatGenerationChunk> {
        yield* this._adapter().completionStream(this, params)
    }

    async *completionStreamInternal(
        params: ModelRequestParams
    ): AsyncGenerator<ChatGenerationChunk> {
        yield* this._adapter().completionStreamInternal(this, params)
    }

    async embeddings(
        params: EmbeddingsRequestParams
    ): Promise<EmbeddingsResult> {
        return await this._adapter().embeddings(this, params)
    }

    async rerank(
        params: RerankerRequestParams
    ): Promise<RerankerResult[] | RerankerUsageResult> {
        return await this._adapter().rerank(this, params)
    }

    async getModels(config?: RunnableConfig): Promise<ProviderModelEntry[]> {
        return await this._adapter().getModels(this, config)
    }

    public buildHeaders() {
        const current = this._config.value
        const preset = getProviderPreset(current.provider)
        const result: Record<string, string> = {
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://github.com/ChatLunaLab/chatluna',
            'X-Title': 'ChatLuna'
        }

        if (preset.adapter !== 'gemini' && current.apiKey.length > 0) {
            result.Authorization = `Bearer ${current.apiKey}`
        }

        for (const header of this._pluginConfig.customHeaders ?? []) {
            const name = header.name?.trim()
            if (!name) continue
            if (
                !targetMatches(header.target, current.platform, current.provider)
            )
                continue
            result[name] = header.value
        }

        return result
    }

    async post(url: string, body: Record<string, unknown>, options?: any) {
        if (url === 'chat/completions') {
            const current = this._config.value
            getProviderPreset(current.provider).patchCompletionBody?.(
                body,
                String(body.model ?? '')
            )
        }
        return super.post(url, body, options)
    }

    get logger() {
        return logger
    }

    get pluginConfig() {
        return this._pluginConfig
    }

    requestContext(): any {
        return createRequestContext(
            this.ctx,
            this._config.value,
            this._pluginConfig,
            this._plugin,
            this
        )
    }

    currentProviderPreset() {
        return getProviderPreset(this._config.value.provider)
    }

    currentConfig() {
        return this._config.value
    }

    responseBuiltinTools(params: ModelRequestParams): ResponseBuiltinTool[] {
        const current = this._config.value
        if (!current.responseApi) return []
        if (
            !current.responseBuiltinToolSupportModel?.includes(params.model ?? '')
        ) {
            return []
        }

        const result: ResponseBuiltinTool[] = []
        for (const type of current.responseBuiltinTools ?? []) {
            if (type === 'file_search') {
                if ((current.responseFileSearchVectorStoreIds ?? []).length > 0) {
                    result.push({
                        type,
                        vector_store_ids: current.responseFileSearchVectorStoreIds
                    })
                }
                continue
            }
            if (type === 'code_interpreter') {
                result.push({ type, container: { type: 'auto' } })
                continue
            }
            result.push({ type })
        }
        return result
    }

    responseImageProvider(): ResponseImageProvider {
        return async (item) => {
            const format =
                item.output_format === 'png' ||
                item.output_format === 'jpeg' ||
                item.output_format === 'webp'
                    ? item.output_format
                    : 'png'
            const ext = format === 'jpeg' ? 'jpg' : format
            const mime = format === 'jpeg' ? 'image/jpeg' : `image/${format}`
            const data = item.result as string
            return `data:${mime};base64,${data}`
        }
    }

    defaultCompletion(params: ModelRequestParams) {
        return super.completion(params)
    }

    defaultCompletionStream(params: ModelRequestParams) {
        return super.completionStream(params)
    }

    private _adapter() {
        return getProviderAdapter(this.currentProviderPreset().adapter)
    }

    concatUrl(url: string) {
        const base = super.concatUrl(url)
        if (this.currentProviderPreset().adapter !== 'gemini') return base

        const next = new URL(base)
        const apiKey = this._config.value.apiKey?.trim()
        if (apiKey) next.searchParams.set('key', apiKey)
        return next.toString()
    }
}
