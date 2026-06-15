import { ChatGenerationChunk } from '@langchain/core/outputs'
import { BaseMessageChunk } from '@langchain/core/messages'
import {
    completion,
    completionStream,
    createEmbeddings,
    createRerank
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

        return completion(requester.requestContext(), params, 'chat/completions')
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
            params,
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
        return parseOpenAIModels(JSON.parse(await response.text()))
    }
}
