import { AIMessageChunk, type BaseMessage } from '@langchain/core/messages'
import {
    ChatGenerationChunk,
    type ChatGeneration
} from '@langchain/core/outputs'
import {
    attachInvocationMetrics,
    readInvocationMetrics,
    type ModelRequestParams
} from 'koishi-plugin-chatluna/llm-core/platform/api'
import type { ModelHubRequester } from '../requester'

type Json = Record<string, any>

export function usesResponses(
    requester: ModelHubRequester,
    params: ModelRequestParams
) {
    const model = String(
        params.overrideRequestParams?.model ?? params.model ?? ''
    ).toLowerCase()
    return (
        requester.currentConfig().responseApi === true ||
        (requester.currentProviderPreset().id === 'openai' &&
            model.startsWith('gpt-6'))
    )
}

/** Per invocation: never put response history or SSE state on a pooled requester. */
export function createOpenAIBridge(
    requester: ModelHubRequester,
    params: ModelRequestParams
) {
    const context = requester.requestContext()
    const provider = requester.currentConfig().provider
    const state: {
        output?: Json[]
        usage?: Json
        model?: string
        id?: string
        reasoning?: string
    } = {}
    const proxy = Object.create(context.modelRequester)
    proxy.post = async (url: string, body: Json, options: any) => {
        state.model = body.model
        if (url === 'responses') {
            if (!Object.hasOwn(params.overrideRequestParams ?? {}, 'input')) {
                body.input = restoreResponseInput(
                    body.input,
                    params.input,
                    provider,
                    body.model
                )
            }
            const configured = requester.currentConfig()
            if (
                configured.promptCacheMode === 'explicit' &&
                !Object.hasOwn(params.overrideRequestParams ?? {}, 'input')
            ) {
                markCacheBoundary(
                    body.input.filter((item: Json) => item.type === 'message'),
                    true
                )
            }
            // Stateless history needs opaque reasoning; no server-side storage is enabled.
            if (body.store === false && provider === 'openai') {
                body.include = [
                    ...new Set([
                        ...(body.include ?? []),
                        'reasoning.encrypted_content'
                    ])
                ]
            }
            const effort = (params.overrideRequestParams as Json)
                ?.reasoning_effort
            if (
                effort != null &&
                !Object.hasOwn(params.overrideRequestParams ?? {}, 'reasoning')
            ) {
                body.reasoning = { ...body.reasoning, effort }
            }
            delete body.reasoning_effort
        } else if (
            url === 'chat/completions' &&
            !Object.hasOwn(params.overrideRequestParams ?? {}, 'messages')
        ) {
            body.messages?.forEach((message: Json, index: number) => {
                message.content = restoreContent(
                    message.content,
                    params.input[index]?.content,
                    false
                )
            })
            if (requester.currentConfig().promptCacheMode === 'explicit')
                markCacheBoundary(body.messages, false)
        }
        const response = await requester.post(url, body, options)
        if (!response.ok) return response
        const observe = (data: Json) => {
            const raw = data.response ?? data
            if (raw.usage) {
                state.usage = raw.usage
                const details = raw.usage.prompt_tokens_details
                const cached =
                    raw.usage.cached_tokens ?? raw.usage.prompt_cache_hit_tokens
                if (cached != null && details?.cached_tokens == null) {
                    raw.usage.prompt_tokens_details = {
                        ...details,
                        cached_tokens: cached
                    }
                }
            }
            if (Array.isArray(raw.output)) state.output = raw.output
            if (raw.id) state.id = raw.id
            if (data.type === 'response.output_item.done' && data.item) {
                state.output ??= []
                state.output[data.output_index ?? state.output.length] =
                    data.item
            }
            for (const choice of data.choices ?? []) {
                for (const message of [choice.message, choice.delta]) {
                    if (
                        message?.reasoning_content == null &&
                        typeof message?.reasoning === 'string'
                    ) {
                        message.reasoning_content = message.reasoning
                    }
                    if (
                        message === choice.delta &&
                        typeof message?.reasoning_content === 'string'
                    ) {
                        state.reasoning =
                            (state.reasoning ?? '') + message.reasoning_content
                    }
                }
            }
            return data
        }
        if (body.stream !== true) {
            const data = observe(JSON.parse(await response.text()))
            return new Response(JSON.stringify(data), {
                status: response.status,
                headers: response.headers as any
            })
        }
        if (!response.body) return response
        const decoder = new TextDecoder()
        const encoder = new TextEncoder()
        let buffer = ''
        const rewrite = (frame: string) =>
            frame.replace(/^data: ?(.*)$/gm, (line, payload) => {
                if (!payload.trim() || payload.trim() === '[DONE]') return line
                let parsed: Json
                try {
                    parsed = JSON.parse(payload)
                } catch {
                    return line
                }
                return `data: ${JSON.stringify(observe(parsed))}`
            })
        const stream = response.body.pipeThrough(
            new TransformStream({
                transform(bytes, controller) {
                    buffer += decoder.decode(bytes, { stream: true })
                    let match: RegExpExecArray | null
                    while ((match = /\r?\n\r?\n/.exec(buffer))) {
                        controller.enqueue(
                            encoder.encode(
                                rewrite(buffer.slice(0, match.index)) + '\n\n'
                            )
                        )
                        buffer = buffer.slice(match.index + match[0].length)
                    }
                },
                flush(controller) {
                    buffer += decoder.decode()
                    if (buffer)
                        controller.enqueue(
                            encoder.encode(rewrite(buffer) + '\n\n')
                        )
                }
            })
        )
        const headers = new Headers(response.headers as any)
        headers.delete('content-length')
        return new Response(stream as any, { status: response.status, headers })
    }

    function enrich<T extends ChatGeneration>(generation: T): T {
        const message = generation.message as AIMessageChunk
        if (
            Object.hasOwn(message.additional_kwargs, 'reasoning_content') &&
            state.reasoning != null
        ) {
            message.additional_kwargs.reasoning_content = state.reasoning
        }
        const usage = message.usage_metadata
        if (usage && state.usage) {
            const raw = state.usage
            const detail =
                raw.input_tokens_details ?? raw.prompt_tokens_details ?? {}
            const write =
                detail.cache_write_tokens ??
                detail.cache_creation_input_tokens ??
                raw.cache_creation_input_tokens
            const read =
                detail.cached_tokens ??
                raw.cached_tokens ??
                raw.prompt_cache_hit_tokens
            usage.input_token_details = {
                ...usage.input_token_details,
                ...(write == null ? {} : { cache_creation: write }),
                ...(read == null ? {} : { cache_read: read })
            }
            const metrics = readInvocationMetrics(generation)
            attachInvocationMetrics(generation, {
                ...metrics,
                usageMetadata: usage
            })
        }
        return generation
    }
    function history() {
        const output = state.output?.filter(Boolean)
        return output?.length
            ? {
                  hub_response: {
                      provider,
                      model: state.model,
                      id: state.id,
                      output
                  }
              }
            : {}
    }
    return {
        context: { ...context, modelRequester: proxy },
        enrich,
        finish<T extends ChatGeneration>(generation: T): T {
            enrich(generation)
            Object.assign(generation.message.additional_kwargs, history())
            return generation
        },
        historyChunk() {
            return new ChatGenerationChunk({
                text: '',
                message: new AIMessageChunk({
                    content: '',
                    additional_kwargs: history()
                })
            })
        }
    }
}

function restoreResponseInput(
    input: Json[],
    messages: BaseMessage[],
    provider: string,
    model: string
) {
    const result: Json[] = []
    let offset = 0
    for (const message of messages) {
        const type = message.getType()
        const count =
            type === 'tool' || type === 'function'
                ? 1
                : (message.content !== '' ? 1 : 0) +
                  (type === 'ai'
                      ? ((message as any).tool_calls?.length ?? 0)
                      : 0)
        const group = input.slice(offset, offset + count)
        offset += count
        const raw = message.additional_kwargs?.hub_response as Json | undefined
        if (
            type === 'ai' &&
            raw?.provider === provider &&
            raw.model === model &&
            Array.isArray(raw.output)
        ) {
            result.push(...structuredClone(raw.output))
            continue
        }
        for (const item of group) {
            if (item.content)
                item.content = restoreContent(
                    item.content,
                    message.content,
                    true
                )
            if (item.output)
                item.output = restoreContent(item.output, message.content, true)
            result.push(item)
        }
    }
    result.push(...input.slice(offset))
    return result
}

function markCacheBoundary(messages: Json[], responses: boolean) {
    const stable = messages.slice(0, -1).at(-1) ?? messages[0]
    if (!stable) return
    const type = responses ? 'input_text' : 'text'
    if (typeof stable.content === 'string')
        stable.content = [{ type, text: stable.content }]
    const lastText = stable.content
        ?.filter((part: Json) => part.type === type)
        .at(-1)
    if (lastText) lastText.prompt_cache_breakpoint ??= { mode: 'explicit' }
}

function restoreContent(content: any, original: any, responses: boolean) {
    if (!Array.isArray(content) || !Array.isArray(original)) return content
    const images = original.filter((part) => part.type === 'image_url')
    const texts = original.filter(
        (part) => part.type === 'text' && part.text?.length > 0
    )
    const files = original.filter((part) => part.type === 'file_url')
    let imageIndex = 0
    let textIndex = 0
    let fileIndex = 0
    return content.map((part) => {
        if (part.type === 'image_url' || part.type === 'input_image') {
            const source = images[imageIndex++]
            if (!source) return part
            const { type: _type, image_url: _image, ...blockOptions } = source
            const options =
                typeof source.image_url === 'object' ? source.image_url : {}
            const { url: _url, ...extensions } = options
            if (responses)
                return {
                    ...part,
                    ...blockOptions,
                    ...extensions,
                    detail: options.detail ?? 'auto'
                }
            return {
                ...source,
                image_url: {
                    ...extensions,
                    url: part.image_url.url,
                    detail: options.detail ?? 'auto'
                }
            }
        }
        if (part.type === 'text' || part.type === 'input_text') {
            const source = texts[textIndex++]
            if (!source) return part
            const { type: _type, ...extensions } = source
            return { ...part, ...extensions }
        }
        if (part.type === 'input_file') {
            const source = files[fileIndex++]
            if (!source) return part
            const options =
                typeof source.file_url === 'object' ? source.file_url : {}
            const { url: _url, ...extensions } = options
            const { type: _type, file_url: _file, ...blockOptions } = source
            return { ...part, ...blockOptions, ...extensions }
        }
        return part
    })
}
