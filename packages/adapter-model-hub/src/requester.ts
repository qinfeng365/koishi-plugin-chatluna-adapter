import {
    AIMessageChunk,
    type UsageMetadata
} from '@langchain/core/messages'
import { ChatGeneration, ChatGenerationChunk } from '@langchain/core/outputs'
import { RunnableConfig } from '@langchain/core/runnables'
import { Context } from 'koishi'
import {
    attachInvocationMetrics,
    EmbeddingsRequester,
    EmbeddingsRequestParams,
    EmbeddingsResult,
    ModelRequester,
    ModelRequestParams,
    RerankerRequester,
    RerankerRequestParams,
    RerankerResult,
    RerankerUsageResult,
    readInvocationMetrics
} from 'koishi-plugin-chatluna/llm-core/platform/api'
import type { ResponseBuiltinTool, ResponseImageProvider } from '@chatluna/v1-shared-adapter'
import { parseOpenAIModelNameWithReasoningEffort } from '@chatluna/v1-shared-adapter'
import type { ClientConfigPool } from 'koishi-plugin-chatluna/llm-core/platform/config'
import { ChatLunaPlugin } from 'koishi-plugin-chatluna/services/chat'
import { createRequestContext } from '@chatluna/v1-shared-adapter'
import { logger } from '.'
import { getProviderPreset, targetMatches } from './providers'
import { getProviderAdapter } from './adapters/registry'
import {
    applyReasoningProtocol,
    resolveReasoningProtocol
} from './adapters/reasoning-protocols'
import type {
    ModelHubClientConfig,
    ModelHubResolvedConfig,
    OpenAICompatibleReasoningProtocol,
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
        const start = Date.now()
        const generation = await this._adapter().completion(
            this,
            this._prepareParams(params)
        )

        attachGenerationMetrics(generation, start)
        return generation
    }

    async *completionStream(
        params: ModelRequestParams
    ): AsyncGenerator<ChatGenerationChunk> {
        const preparedParams = this._prepareParams(params)
        if (!this.currentConfig().nonStreaming) {
            yield* super.completionStream(preparedParams)
            return
        }

        const tracker = new ModelHubStreamMetricsTracker()

        for await (const chunk of this._adapter().completionStream(
            this,
            preparedParams
        )) {
            tracker.observe(chunk)
            yield chunk
        }

        yield tracker.attachTo(
            new ChatGenerationChunk({
                message: new AIMessageChunk({ content: '' }),
                text: ''
            })
        )
    }

    async *completionStreamInternal(
        params: ModelRequestParams
    ): AsyncGenerator<ChatGenerationChunk> {
        yield* this._adapter().completionStreamInternal(
            this,
            this._prepareParams(params)
        )
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

    async dispose(model?: string, id?: string): Promise<void> {
        await this._adapter().dispose?.(this, model, id)
    }

    async getModels(config?: RunnableConfig): Promise<ProviderModelEntry[]> {
        return await this._adapter().getModels(this, config)
    }

    public buildHeaders() {
        const current = this._config.value
        const preset = getProviderPreset(current.provider)
        const result: Record<string, string> =
            preset.adapter === 'anthropic'
                ? {
                      'Content-Type': 'application/json',
                      'x-api-key': current.apiKey,
                      'anthropic-version': '2023-06-01'
                  }
                : {
                      'Content-Type': 'application/json',
                      'HTTP-Referer': 'https://github.com/ChatLunaLab/chatluna',
                      'X-Title': 'ChatLuna'
                  }

        if (
            preset.adapter !== 'gemini' &&
            preset.adapter !== 'anthropic' &&
            current.apiKey.length > 0
        ) {
            result.Authorization = `Bearer ${current.apiKey}`
        }

        for (const header of current.customHeaders ?? []) {
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
            const preset = getProviderPreset(current.provider)
            const parsedModel = parseOpenAIModelNameWithReasoningEffort(
                String(body.model ?? '')
            )
            applyReasoningEffortStrategy(
                preset.reasoningEffort,
                body,
                parsedModel.model,
                current.reasoningProtocol
            )
            preset.patchCompletionBody?.(body, String(body.model ?? ''))
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

    koishiContext() {
        return this.ctx
    }

    responseBuiltinTools(params: ModelRequestParams): ResponseBuiltinTool[] {
        const current = this._config.value
        if (!current.responseApi) return []
        if (!matchesResponseBuiltinToolModel(params.model, current.responseBuiltinToolSupportModel)) {
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
        return super.completion(this._prepareParams(params))
    }

    defaultCompletionStream(params: ModelRequestParams) {
        return super.completionStream(this._prepareParams(params))
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

    private _prepareParams<T extends ModelRequestParams>(params: T): T {
        if (!params.model) return params

        const { model, reasoningEffort } =
            parseOpenAIModelNameWithReasoningEffort(params.model)

        if (model === params.model && reasoningEffort == null) return params

        return {
            ...params,
            overrideRequestParams: {
                ...params.overrideRequestParams,
                model,
                ...(reasoningEffort == null
                    ? {}
                    : { reasoning_effort: reasoningEffort })
            }
        }
    }
}

function applyReasoningEffortStrategy(
    strategy: ReturnType<typeof getProviderPreset>['reasoningEffort'],
    body: Record<string, unknown>,
    model: string,
    configuredProtocol?: OpenAICompatibleReasoningProtocol
) {
    const effort = body.reasoning_effort
    if (effort == null) return

    if (strategy === 'passthrough') {
        applyReasoningProtocol(
            resolveReasoningProtocol(configuredProtocol, model),
            body,
            model
        )
        return
    }

    if (strategy === 'deepseek') {
        applyReasoningProtocol('deepseek', body, model)
        return
    }

    if (strategy === 'qwen') {
        applyReasoningProtocol('qwen', body, model)
        return
    }

    delete body.reasoning_effort
}

function matchesResponseBuiltinToolModel(
    model: string | undefined,
    supported: string[] | undefined
) {
    if (!model || (supported?.length ?? 0) < 1) return false
    const normalized = normalizeResponseToolModel(model)
    return (supported ?? []).some((item) => {
        const target = normalizeResponseToolModel(item)
        if (!target) return false
        return (
            normalized === target ||
            isResponseModelPrefix(normalized, target) ||
            isResponseModelPrefix(target, normalized)
        )
    })
}

function normalizeResponseToolModel(model: string) {
    return parseOpenAIModelNameWithReasoningEffort(model)
        .model
        .trim()
        .toLowerCase()
}

function isResponseModelPrefix(model: string, prefix: string) {
    if (!model.startsWith(prefix)) return false
    const next = model[prefix.length]
    return next === '-' || next === '.' || next === ':'
}

class ModelHubStreamMetricsTracker {
    private readonly start = Date.now()
    private firstAt?: number
    private usage?: UsageMetadata

    observe(chunk: ChatGenerationChunk) {
        const usage = readChunkUsage(chunk)
        if (usage != null) {
            this.usage = usage
        }
        if (this.firstAt == null && hasResponseChunk(chunk)) {
            this.firstAt = Date.now()
        }
    }

    attachTo(chunk: ChatGenerationChunk) {
        attachInvocationMetrics(chunk, {
            usageMetadata: this.usage,
            timing: createModelHubUsageTiming(this.start, this.firstAt, this.usage)
        })
        return chunk
    }
}

function attachGenerationMetrics(generation: ChatGeneration, start: number) {
    const metrics = readInvocationMetrics(generation)
    if (isUsableTiming(metrics.timing)) return

    const usage = metrics.usageMetadata ?? readChunkUsage(generation)
    attachInvocationMetrics(generation, {
        usageMetadata: usage,
        timing: createModelHubUsageTiming(start, undefined, usage)
    })
}

function createModelHubUsageTiming(
    start: number,
    firstAt?: number,
    usage?: UsageMetadata
) {
    const totalMs = Math.max(Date.now() - start, 10)
    const outputTokens =
        usage == null
            ? undefined
            : (usage.output_tokens ?? 0) +
              (usage.output_token_details?.reasoning ?? 0)
    const timing = {
        totalMs,
        tps:
            outputTokens == null
                ? undefined
                : outputTokens * 1000 / totalMs
    }

    if (firstAt == null) return timing
    return {
        ttftMs: Math.max(firstAt - start, 10),
        ...timing
    }
}

function isUsableTiming(
    timing: { ttftMs?: number; totalMs?: number; tps?: number } | undefined
) {
    if (timing == null) return false
    if (timing.totalMs == null) return false
    if (timing.totalMs != null && !Number.isFinite(timing.totalMs)) return false
    if (timing.ttftMs != null && !Number.isFinite(timing.ttftMs)) return false
    if (timing.tps != null && !Number.isFinite(timing.tps)) return false
    return true
}

function readChunkUsage(
    chunk: ChatGeneration | ChatGenerationChunk
): UsageMetadata | undefined {
    return (
        (chunk.message as { usage_metadata?: UsageMetadata } | undefined)
            ?.usage_metadata ??
        (chunk.generationInfo as { usage_metadata?: UsageMetadata } | undefined)
            ?.usage_metadata
    )
}

function hasResponseChunk(chunk: ChatGenerationChunk) {
    const message = chunk.message as
        | {
              content?: unknown
              tool_call_chunks?: unknown[]
              tool_calls?: unknown[]
              invalid_tool_calls?: unknown[]
              additional_kwargs?: Record<string, unknown>
          }
        | undefined
    const content = message?.content
    const kwargs = message?.additional_kwargs

    return (
        chunk.text.length > 0 ||
        (typeof content === 'string'
            ? content.trim().length > 0
            : Array.isArray(content) && content.length > 0) ||
        (message?.tool_call_chunks?.length ?? 0) > 0 ||
        (message?.tool_calls?.length ?? 0) > 0 ||
        (message?.invalid_tool_calls?.length ?? 0) > 0 ||
        ((kwargs?.tool_calls as unknown[] | undefined)?.length ?? 0) > 0 ||
        kwargs?.function_call != null ||
        kwargs?.thought_data != null
    )
}
