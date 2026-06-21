import { BaseMessageChunk } from '@langchain/core/messages'
import { ChatGenerationChunk } from '@langchain/core/outputs'
import {
    completion,
    completionStream,
    createEmbeddings,
    responseApiCompletion,
    responseApiCompletionStream
} from '@chatluna/v1-shared-adapter'
import { checkResponse } from 'koishi-plugin-chatluna/utils/sse'
import {
    ChatLunaError,
    ChatLunaErrorCode
} from 'koishi-plugin-chatluna/utils/error'
import type { ProviderAdapter } from './types'
import { parseOpenAIModels } from './model-list'

export const openAIAdapter: ProviderAdapter = {
    id: 'openai',

    async completion(requester, params) {
        const current = requester.currentConfig()
        if (!current.nonStreaming && !current.responseApi) {
            return requester.defaultCompletion(params)
        }

        const requestContext = requester.requestContext()

        if (current.responseApi) {
            return await responseApiCompletion(
                requestContext,
                params,
                {
                    builtinTools: requester.responseBuiltinTools(params)
                },
                true,
                requester.responseImageProvider()
            )
        }

        return await completion(requestContext, params, 'chat/completions')
    },

    async *completionStream(requester, params) {
        const current = requester.currentConfig()

        if (!current.nonStreaming) {
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
        const current = requester.currentConfig()
        const requestContext = requester.requestContext()

        if (current.responseApi) {
            yield* responseApiCompletionStream(
                requestContext,
                params,
                {
                    builtinTools: requester.responseBuiltinTools(params)
                },
                true,
                requester.responseImageProvider()
            )
            return
        }

        yield* completionStream(requestContext, params, 'chat/completions')
    },

    async embeddings(requester, params) {
        const requestContext = requester.requestContext()

        return await createEmbeddings(requestContext, params)
    },

    async rerank(requester, params) {
        throw new ChatLunaError(
            ChatLunaErrorCode.API_REQUEST_FAILED,
            new Error(
                `OpenAI official API does not provide a rerank endpoint for ${params.model ?? 'this model'}.`
            )
        )
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
