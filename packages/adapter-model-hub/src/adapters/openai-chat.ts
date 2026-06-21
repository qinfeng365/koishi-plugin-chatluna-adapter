import { ChatGenerationChunk } from '@langchain/core/outputs'
import { BaseMessageChunk } from '@langchain/core/messages'
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
        yield* completionStream(
            requester.requestContext(),
            preserveRealModelName(params),
            'chat/completions'
        )
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
