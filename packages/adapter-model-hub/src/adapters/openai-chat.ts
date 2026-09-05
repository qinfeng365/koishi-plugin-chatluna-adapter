import { ChatGenerationChunk } from '@langchain/core/outputs'
import { AIMessageChunk, BaseMessageChunk } from '@langchain/core/messages'
import {
    completion,
    completionStream,
    createEmbeddings,
    createRerank,
    parseOpenAIModelNameWithReasoningEffort
} from '@chatluna/v1-shared-adapter'
import { checkResponse } from 'koishi-plugin-chatluna/utils/sse'
import type { ProviderAdapter } from './types'
import { parseOpenAIModels } from './model-list'

export const openAIChatAdapter: ProviderAdapter = {
    id: 'openai-chat',

    async completion(requester, params) {
        if (!requester.currentConfig().nonStreaming) {
            return requester.defaultCompletion(params)
        }

        return completion(
            requester.requestContext(),
            preserveRealModelName(params),
            'chat/completions'
        )
    },

    async *completionStream(requester, params) {
        if (!requester.currentConfig().nonStreaming) {
            yield* requester.defaultCompletionStream(params)
            return
        }

        const generation = await this.completion(requester, params)
        yield new ChatGenerationChunk({
            generationInfo: generation.generationInfo,
            message: generation.message as BaseMessageChunk,
            text: generation.text
        })
    },

    async *completionStreamInternal(requester, params) {
        const normalizeToolCallChunk =
            requester.currentProviderPreset().id === 'deepseek'
                ? createToolCallChunkNormalizer()
                : undefined

        for await (const chunk of completionStream(
            requester.requestContext(),
            preserveRealModelName(params),
            'chat/completions'
        )) {
            yield normalizeToolCallChunk?.(chunk) ?? chunk
        }
    },

    async embeddings(requester, params) {
        return await createEmbeddings(requester.requestContext(), params)
    },

    async rerank(requester, params) {
        return await createRerank(requester.requestContext(), params)
    },

    async getModels(requester, config) {
        const response = await requester.get('models', {}, { signal: config?.signal })
        await checkResponse(response)
        return parseOpenAIModels(
            JSON.parse(await response.text()),
            requester.currentProviderPreset()
        )
    }
}

type StreamToolCallChunk = {
    index?: number
    id?: string
    name?: string
    args?: string
}

function createToolCallChunkNormalizer() {
    const ids = new Map<number, string>()
    const indexes = new Map<string, number>()
    let nextIndex = 0
    let nextId = 0

    return (chunk: ChatGenerationChunk) => {
        const message = chunk.message
        if (!(message instanceof AIMessageChunk)) return chunk

        const toolCallChunks = message.tool_call_chunks as
            | StreamToolCallChunk[]
            | undefined
        if ((toolCallChunks?.length ?? 0) < 1) return chunk

        let changed = false
        const repairedToolCallChunks = toolCallChunks.map((toolCall, offset) => {
            const id = normalizeToolCallId(toolCall.id)
            const index = resolveToolCallIndex(toolCall.index, id, offset)
            if (id) {
                ids.set(index, id)
                indexes.set(id, index)
            } else if (!ids.has(index)) {
                ids.set(index, `call_deepseek_${nextId++}`)
            }

            changed ||= index !== toolCall.index || ids.get(index) !== toolCall.id

            return {
                ...toolCall,
                index,
                id: ids.get(index)
            }
        })

        if (!changed) return chunk

        return new ChatGenerationChunk({
            generationInfo: chunk.generationInfo,
            text: chunk.text,
            message: new AIMessageChunk({
                content: message.content,
                additional_kwargs: message.additional_kwargs,
                response_metadata: message.response_metadata,
                tool_call_chunks: repairedToolCallChunks,
                usage_metadata: message.usage_metadata,
                id: message.id,
                name: message.name
            })
        })
    }

    function resolveToolCallIndex(
        index: number | undefined,
        id: string | undefined,
        offset: number
    ) {
        if (Number.isInteger(index)) return index!
        if (id && indexes.has(id)) return indexes.get(id)!
        if (id) return nextIndex++
        return offset
    }
}

function normalizeToolCallId(value: unknown) {
    return typeof value === 'string' && value.trim().length > 0
        ? value
        : undefined
}

export function preserveRealModelName<
    T extends {
        model?: string
        overrideRequestParams?: Record<string, unknown>
    }
>(params: T): T {
    if (!params.model) return params
    const { model, reasoningEffort } =
        parseOpenAIModelNameWithReasoningEffort(params.model)
    if (
        model === params.model &&
        Object.prototype.hasOwnProperty.call(
            params.overrideRequestParams ?? {},
            'model'
        )
    ) {
        return params
    }

    return {
        ...params,
        overrideRequestParams: {
            ...params.overrideRequestParams,
            model,
            ...(reasoningEffort == null
                ? {}
                : { reasoning_effort: reasoningEffort })
        }
    } as T
}
