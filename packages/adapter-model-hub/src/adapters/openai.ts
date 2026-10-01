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
import { ModelCapabilities } from 'koishi-plugin-chatluna/llm-core/platform/types'
import {
    ChatLunaError,
    ChatLunaErrorCode
} from 'koishi-plugin-chatluna/utils/error'
import type { ProviderAdapter } from './types'
import { parseOpenAIModels } from './model-list'
import { createOpenAIBridge, usesResponses } from './openai-bridge'

export const openAIAdapter: ProviderAdapter = {
    id: 'openai',

    async completion(requester, params) {
        const current = requester.currentConfig()
        if (!current.nonStreaming) {
            return requester.defaultCompletion(params)
        }

        const bridge = createOpenAIBridge(requester, params)
        const requestContext = bridge.context

        if (usesResponses(requester, params)) {
            return bridge.finish(
                await responseApiCompletion(
                    requestContext,
                    params,
                    {
                        builtinTools: requester.responseBuiltinTools(params)
                    },
                    requester.supportsCapability(
                        params.model,
                        ModelCapabilities.ImageInput
                    ),
                    requester.responseImageProvider()
                )
            )
        }

        return bridge.finish(
            await completion(
                requestContext,
                params,
                'chat/completions',
                undefined,
                requester.supportsCapability(
                    params.model,
                    ModelCapabilities.ImageInput
                )
            )
        )
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
        const bridge = createOpenAIBridge(requester, params)
        const requestContext = bridge.context

        if (usesResponses(requester, params)) {
            for await (const chunk of responseApiCompletionStream(
                requestContext,
                params,
                {
                    builtinTools: requester.responseBuiltinTools(params)
                },
                requester.supportsCapability(
                    params.model,
                    ModelCapabilities.ImageInput
                ),
                requester.responseImageProvider()
            ))
                yield bridge.enrich(chunk)
            yield bridge.historyChunk()
            return
        }

        for await (const chunk of completionStream(
            requestContext,
            params,
            'chat/completions',
            undefined,
            requester.supportsCapability(
                params.model,
                ModelCapabilities.ImageInput
            )
        ))
            yield bridge.enrich(chunk)
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
        const response = await requester.get(
            'models',
            {},
            { signal: config?.signal }
        )
        await checkResponse(response)
        return parseOpenAIModels(
            JSON.parse(await response.text()),
            requester.currentProviderPreset()
        )
    }
}
