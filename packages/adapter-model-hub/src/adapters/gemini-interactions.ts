import { AIMessageChunk } from '@langchain/core/messages'
import { ChatGenerationChunk } from '@langchain/core/outputs'
import {
    createRequestSignal,
    createUsageMetadata,
    parseOpenAIModelNameWithReasoningEffort
} from '@chatluna/v1-shared-adapter'
import { checkResponse, sseIterable } from 'koishi-plugin-chatluna/utils/sse'
import {
    ChatLunaError,
    ChatLunaErrorCode
} from 'koishi-plugin-chatluna/utils/error'
import type { ModelRequestParams } from 'koishi-plugin-chatluna/llm-core/platform/api'
import type { ModelHubRequester } from '../requester'
import {
    createGeminiRequest,
    createGeminiToolNameMapper,
    mergeGeminiRequest
} from './gemini'

type Json = Record<string, any>

async function buildInteraction(
    requester: ModelHubRequester,
    params: ModelRequestParams,
    mapper: ReturnType<typeof createGeminiToolNameMapper>,
    stream: boolean
) {
    const config = requester.currentConfig()
    if (config.geminiCachedContent)
        throw new Error(
            'cachedContents references require generateContent, not Interactions'
        )
    const customInput = Object.hasOwn(
        params.overrideRequestParams ?? {},
        'input'
    )
    const generated = await createGeminiRequest(
        requester,
        {
            ...params,
            input: customInput ? [] : params.input,
            overrideRequestParams: undefined
        },
        mapper
    )
    const model = parseOpenAIModelNameWithReasoningEffort(
        String(params.overrideRequestParams?.model ?? params.model)
    ).model.replace(/^models\//, '')
    const input: Json[] = []
    let index = 0
    let previousTool = false
    let toolContent: Json | undefined
    for (const message of customInput ? [] : params.input) {
        if (message.getType() === 'system') continue
        if (message.getType() === 'tool') {
            if (!previousTool) toolContent = generated.contents[index++]
            previousTool = true
            const tool = message as any
            const response = toolContent?.parts?.find(
                (part: Json) => part.functionResponse?.id === tool.tool_call_id
            )?.functionResponse
            const text =
                typeof tool.content === 'string'
                    ? tool.content
                    : tool.content
                          .filter((part: Json) => part.type === 'text')
                          .map((part: Json) => part.text)
                          .join('')
            input.push({
                type: 'function_result',
                name: response?.name ?? mapper.sanitize(tool.name),
                call_id: tool.tool_call_id,
                result: [
                    { type: 'text', text },
                    ...(response?.parts ?? []).map(partToContent)
                ]
            })
            continue
        }
        previousTool = false
        const content = generated.contents[index++]
        const saved = message.additional_kwargs.hub_gemini_interaction as
            | Json
            | undefined
        if (
            message.getType() === 'ai' &&
            saved?.model === model &&
            Array.isArray(saved.steps)
        ) {
            input.push(...structuredClone(saved.steps))
            continue
        }
        if (!content) continue
        let ordinary: Json[] = []
        for (const part of content.parts) {
            if (part.functionCall) {
                if (ordinary.length) {
                    input.push({ type: 'model_output', content: ordinary })
                    ordinary = []
                }
                const call = part.functionCall
                input.push({
                    type: 'function_call',
                    id: call.id,
                    name: call.name,
                    arguments: call.args
                })
            } else ordinary.push(partToContent(part))
        }
        if (ordinary.length)
            input.push({
                type:
                    message.getType() === 'ai' ? 'model_output' : 'user_input',
                content: ordinary
            })
    }
    const tools: Json[] = []
    for (const tool of generated.tools ?? []) {
        for (const fn of tool.functionDeclarations ?? [])
            tools.push({ type: 'function', ...fn })
        if (tool.googleSearch) tools.push({ type: 'google_search' })
        if (tool.codeExecution) tools.push({ type: 'code_execution' })
        if (tool.urlContext) tools.push({ type: 'url_context' })
    }
    const g = generated.generationConfig ?? {}
    const schema = config.geminiResponseJsonSchema
    const base = {
        model,
        input,
        stream,
        store: false,
        system_instruction: generated.systemInstruction?.parts
            ?.map((p: Json) => p.text ?? '')
            .join('\n'),
        tools: tools.length ? tools : undefined,
        generation_config: {
            temperature: g.temperature,
            top_p: g.topP,
            max_output_tokens: g.maxOutputTokens,
            thinking_level: g.thinkingConfig?.thinkingLevel,
            thinking_summaries: config.includeThoughts ? 'auto' : undefined
        },
        response_format: schema
            ? [{ type: 'text', mime_type: 'application/json', schema }]
            : config.geminiResponseMimeType
              ? [{ type: 'text', mime_type: config.geminiResponseMimeType }]
              : undefined
    }
    const { reasoning_effort: _effort, ...override } =
        params.overrideRequestParams ?? {}
    return mergeGeminiRequest(base, override)
}

function partToContent(part: Json): Json {
    if (part.text != null) return { type: 'text', text: part.text }
    const media =
        part.inlineData ?? part.inline_data ?? part.fileData ?? part.file_data
    if (media) {
        const mime = media.mimeType ?? media.mime_type
        const type = mime?.startsWith('image/')
            ? 'image'
            : mime?.startsWith('audio/')
              ? 'audio'
              : mime?.startsWith('video/')
                ? 'video'
                : 'document'
        return {
            type,
            mime_type: mime,
            ...(media.data
                ? { data: media.data }
                : { uri: media.fileUri ?? media.file_uri })
        }
    }
    throw new Error(
        'Cannot convert generateContent-specific context to Interactions; start a new conversation or supply overrideRequestParams.input'
    )
}

function ensureSuccess(data: Json) {
    if (data.error || ['failed', 'cancelled'].includes(data.status)) {
        throw new ChatLunaError(
            ChatLunaErrorCode.API_REQUEST_FAILED,
            new Error(
                `Gemini interaction failed: ${data.error?.message ?? data.status}`
            )
        )
    }
}

export function parseGeminiInteraction(
    data: Json,
    mapper: ReturnType<typeof createGeminiToolNameMapper>,
    metadataOnly = false
) {
    ensureSuccess(data)
    const steps = data.steps ?? []
    const content: Json[] = []
    const calls: Json[] = []
    let reasoning = ''
    for (const step of steps) {
        if (step.type === 'model_output')
            for (const part of step.content ?? []) {
                if (part.type === 'text')
                    content.push({ type: 'text', text: part.text })
                else if (
                    ['image', 'audio', 'video', 'document'].includes(part.type)
                ) {
                    const url =
                        part.uri ?? `data:${part.mime_type};base64,${part.data}`
                    const type =
                        part.type === 'image'
                            ? 'image_url'
                            : part.type === 'audio'
                              ? 'audio_url'
                              : part.type === 'video'
                                ? 'video_url'
                                : 'file_url'
                    content.push({
                        type,
                        [type]:
                            type === 'image_url'
                                ? url
                                : { url, mimeType: part.mime_type }
                    })
                }
            }
        if (step.type === 'function_call')
            calls.push({
                name: mapper.restore(step.name),
                id: step.id,
                args:
                    typeof step.arguments === 'string'
                        ? step.arguments
                        : JSON.stringify(step.arguments ?? {}),
                index: calls.length
            })
        if (step.type === 'thought')
            reasoning += (step.summary ?? [])
                .map((p: Json) => p.text ?? '')
                .join('')
    }
    const usage = data.usage
    const metadata = usage
        ? createUsageMetadata({
              inputTokens: usage.total_input_tokens ?? 0,
              outputTokens: usage.total_output_tokens ?? 0,
              totalTokens: usage.total_tokens ?? 0,
              cacheReadTokens: usage.total_cached_tokens,
              reasoningTokens: usage.total_thought_tokens
          })
        : undefined
    const text = metadataOnly
        ? ''
        : content
              .filter((p) => p.type === 'text')
              .map((p) => p.text)
              .join('')
    return new ChatGenerationChunk({
        text,
        generationInfo: { status: data.status, usage_metadata: metadata },
        message: new AIMessageChunk({
            content: metadataOnly ? '' : (content as any),
            tool_call_chunks: metadataOnly ? [] : (calls as any),
            usage_metadata: metadata,
            additional_kwargs: {
                hub_gemini_interaction: {
                    model: data.model,
                    id: data.id,
                    steps
                },
                ...(reasoning ? { reasoning_content: reasoning } : {})
            }
        })
    })
}

export async function geminiInteractionCompletion(
    requester: ModelHubRequester,
    params: ModelRequestParams
) {
    const mapper = createGeminiToolNameMapper(params.tools ?? [])
    const signal = createRequestSignal(params)
    try {
        const request = await buildInteraction(
            requester,
            { ...params, signal: signal.signal },
            mapper,
            false
        )
        const response = await requester.post('interactions', request, {
            signal: signal.signal
        })
        await checkResponse(response)
        const data = JSON.parse(await response.text())
        data.model ??= request.model
        return parseGeminiInteraction(data, mapper)
    } finally {
        signal.dispose()
    }
}

export async function* geminiInteractionStream(
    requester: ModelHubRequester,
    params: ModelRequestParams
) {
    const mapper = createGeminiToolNameMapper(params.tools ?? [])
    const signal = createRequestSignal(params)
    const steps: Json[] = []
    const args = new Map<number, string>()
    let interaction: Json = {}
    let completed = false
    try {
        const request = await buildInteraction(
            requester,
            { ...params, signal: signal.signal },
            mapper,
            true
        )
        const response = await requester.post('interactions', request, {
            signal: signal.signal
        })
        signal.clearTimeout()
        await checkResponse(response)
        for await (const event of sseIterable(response, {
            signal: signal.signal,
            timeout: params.timeout
        })) {
            if (!event.data || event.data.trim() === '[DONE]') continue
            const data = JSON.parse(event.data)
            const type = data.event_type ?? event.event
            if (type === 'error' || data.error)
                ensureSuccess({ error: data.error ?? data, status: 'failed' })
            if (data.interaction)
                interaction = { ...interaction, ...data.interaction }
            if (type === 'interaction.status_update')
                ensureSuccess({ ...data, status: data.status })
            if (type === 'step.start')
                steps[data.index] = structuredClone(data.step)
            if (type === 'step.delta') {
                const step = steps[data.index]
                const delta = data.delta
                if (!step)
                    throw new Error(
                        'Gemini interaction delta has no step.start'
                    )
                if (delta.type === 'arguments_delta')
                    args.set(
                        data.index,
                        (args.get(data.index) ?? '') + delta.arguments
                    )
                else if (delta.type === 'thought_signature')
                    step.signature = delta.signature
                else if (delta.type === 'thought_summary')
                    (step.summary ??= []).push(delta.content)
                else if (step.type === 'model_output') {
                    ;(step.content ??= []).push(delta)
                    if (delta.type === 'text')
                        yield new ChatGenerationChunk({
                            text: delta.text,
                            message: new AIMessageChunk({ content: delta.text })
                        })
                    else {
                        const chunk = parseGeminiInteraction(
                            { steps: [{ ...step, content: [delta] }] },
                            mapper
                        )
                        delete chunk.message.additional_kwargs
                            .hub_gemini_interaction
                        yield chunk
                    }
                } else
                    Object.assign(
                        step,
                        Object.fromEntries(
                            Object.entries(delta).filter(
                                ([key]) => key !== 'type'
                            )
                        )
                    )
            }
            if (type === 'step.stop') {
                if (data.step) steps[data.index] = data.step
                if (args.has(data.index))
                    steps[data.index].arguments = JSON.parse(
                        args.get(data.index)!
                    )
                if (steps[data.index]?.type === 'function_call') {
                    const chunk = parseGeminiInteraction(
                        { steps: [steps[data.index]] },
                        mapper
                    )
                    delete chunk.message.additional_kwargs
                        .hub_gemini_interaction
                    const calls = (chunk.message as AIMessageChunk)
                        .tool_call_chunks
                    calls.forEach((call) => {
                        call.index = data.index
                    })
                    yield chunk
                }
            }
            if (type === 'interaction.completed') {
                ensureSuccess(interaction)
                completed = true
            }
        }
        if (!completed)
            throw new Error(
                'Gemini interaction stream ended without completion'
            )
        interaction.steps ??= steps.filter(Boolean)
        interaction.model ??= request.model
        yield parseGeminiInteraction(interaction, mapper, true)
    } finally {
        signal.dispose()
    }
}
