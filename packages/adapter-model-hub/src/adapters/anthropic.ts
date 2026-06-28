import {
    AIMessage,
    AIMessageChunk,
    BaseMessage,
    BaseMessageChunk,
    ToolMessage,
    type MessageContent,
    type MessageContentComplex
} from '@langchain/core/messages'
import { ChatGenerationChunk } from '@langchain/core/outputs'
import { StructuredTool } from '@langchain/core/tools'
import { isZodSchemaV3 } from '@langchain/core/utils/types'
import {
    createUsageMetadata,
    fetchFileLikeUrl,
    fetchImageUrl,
    parseOpenAIModelNameWithReasoningEffort,
    removeAdditionalProperties
} from '@chatluna/v1-shared-adapter'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { checkResponse, sseIterable } from 'koishi-plugin-chatluna/utils/sse'
import {
    getMessageContent,
    isMessageContentImageUrl,
    isMessageContentText
} from 'koishi-plugin-chatluna/utils/string'
import {
    ChatLunaError,
    ChatLunaErrorCode
} from 'koishi-plugin-chatluna/utils/error'
import type { ModelRequestParams } from 'koishi-plugin-chatluna/llm-core/platform/api'
import type { ProviderAdapter } from './types'
import type { ModelHubRequester } from '../requester'
import type { ProviderModelEntry } from '../types'
import { parseAnthropicModels } from './model-list'

type AnthropicRole = 'user' | 'assistant'
type AnthropicEffort = 'low' | 'medium' | 'high' | 'xhigh' | 'max'
type AnthropicThinking =
    | {
          type: 'adaptive'
          display?: 'summarized' | 'omitted'
      }
    | {
          type: 'disabled'
      }

type AnthropicCacheControl = {
    type: 'ephemeral'
    ttl?: '1h'
}

type AnthropicTextBlock = {
    type: 'text'
    text: string
}

type AnthropicImageBlock = {
    type: 'image'
    source:
        | {
              type: 'base64'
              media_type: string
              data: string
          }
        | {
              type: 'url'
              url: string
          }
}

type AnthropicDocumentBlock = {
    type: 'document'
    source:
        | {
              type: 'base64'
              media_type: 'application/pdf'
              data: string
          }
        | {
              type: 'text'
              media_type: 'text/plain'
              data: string
          }
}

type AnthropicToolUseBlock = {
    type: 'tool_use'
    id: string
    name: string
    input: Record<string, unknown>
}

type AnthropicToolResultBlock = {
    type: 'tool_result'
    tool_use_id: string
    content?: string | AnthropicInputContentBlock[]
    is_error?: boolean
}

type AnthropicThinkingBlock = {
    type: 'thinking'
    thinking: string
    signature: string
}

type AnthropicRedactedThinkingBlock = {
    type: 'redacted_thinking'
    data: string
}

type AnthropicInputContentBlock =
    | AnthropicTextBlock
    | AnthropicImageBlock
    | AnthropicDocumentBlock

type AnthropicMessageContentBlock =
    | AnthropicInputContentBlock
    | AnthropicToolUseBlock
    | AnthropicToolResultBlock
    | AnthropicThinkingBlock
    | AnthropicRedactedThinkingBlock

type AnthropicMessage = {
    role: AnthropicRole
    content: string | AnthropicMessageContentBlock[]
}

type AnthropicTool = {
    name: string
    description: string
    input_schema: Record<string, unknown>
}

type AnthropicUsage = {
    input_tokens?: number
    output_tokens?: number
    cache_creation_input_tokens?: number
    cache_read_input_tokens?: number
    cache_creation?: {
        ephemeral_5m_input_tokens?: number
        ephemeral_1h_input_tokens?: number
    }
    iterations?: AnthropicUsage[]
    output_tokens_details?: {
        thinking_tokens?: number
    }
}

type AnthropicResponse = {
    id?: string
    content?: AnthropicMessageContentBlock[]
    model?: string
    role?: 'assistant'
    stop_reason?: string | null
    stop_sequence?: string | null
    stop_details?: Record<string, unknown> | null
    usage?: AnthropicUsage
}

type AnthropicStreamEvent =
    | {
          type: 'message_start'
          message: AnthropicResponse
      }
    | {
          type: 'message_delta'
          delta?: {
              stop_reason?: string | null
              stop_sequence?: string | null
          }
          usage?: AnthropicUsage
      }
    | {
          type: 'content_block_start'
          index: number
          content_block: AnthropicMessageContentBlock & Record<string, unknown>
      }
    | {
          type: 'content_block_delta'
          index: number
          delta:
              | {
                    type: 'text_delta'
                    text: string
                }
              | {
                    type: 'input_json_delta'
                    partial_json: string
                }
              | {
                    type: 'thinking_delta'
                    thinking: string
                }
              | {
                    type: 'signature_delta'
                    signature: string
                }
      }
    | {
          type: 'content_block_stop'
          index: number
      }
    | {
          type: 'message_stop'
      }

type AnthropicMessageContents = {
    system?: string
    messages: AnthropicMessage[]
}

type AnthropicToolNameMapper = {
    sanitize(name: string | undefined): string
    restore(name: string | undefined): string
}

type OpenAIReasoningEffort = NonNullable<
    ReturnType<typeof parseOpenAIModelNameWithReasoningEffort>['reasoningEffort']
>

export const anthropicAdapter: ProviderAdapter = {
    id: 'anthropic',

    async completion(requester, params) {
        if (!requester.currentConfig().nonStreaming) {
            return requester.defaultCompletion(params)
        }

        return await anthropicCompletion(requester, params)
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
        yield* anthropicCompletionStream(requester, params)
    },

    async embeddings(_requester, params) {
        throw new ChatLunaError(
            ChatLunaErrorCode.API_REQUEST_FAILED,
            new Error(`Anthropic does not provide embeddings for ${params.model}.`)
        )
    },

    async rerank(_requester, params) {
        throw new ChatLunaError(
            ChatLunaErrorCode.API_REQUEST_FAILED,
            new Error(`Anthropic does not provide rerank for ${params.model}.`)
        )
    },

    async getModels(requester, config) {
        return await getAnthropicModels(requester, config?.signal)
    }
}

async function anthropicCompletion(
    requester: ModelHubRequester,
    params: ModelRequestParams
) {
    const toolNameMapper = createAnthropicToolNameMapper(params.tools ?? [])
    const request = await createAnthropicRequest(
        requester,
        params,
        toolNameMapper,
        false
    )
    const response = await requester.post('messages', request, {
        signal: params.signal
    })
    await checkResponse(response)
    return parseAnthropicResponse(
        (await response.json()) as AnthropicResponse,
        toolNameMapper
    )
}

async function* anthropicCompletionStream(
    requester: ModelHubRequester,
    params: ModelRequestParams
) {
    const toolNameMapper = createAnthropicToolNameMapper(params.tools ?? [])
    const request = await createAnthropicRequest(
        requester,
        params,
        toolNameMapper,
        true
    )
    const response = await requester.post('messages', request, {
        signal: params.signal
    })
    await checkResponse(response)

    const reasoningState = createReasoningState()
    let usage: AnthropicUsage | undefined

    for await (const event of sseIterable(response)) {
        if (!event.data || event.data === '[DONE]' || event.event === 'ping') {
            continue
        }
        if (event.event === 'error') {
            throw new ChatLunaError(
                ChatLunaErrorCode.API_REQUEST_FAILED,
                new Error(event.data)
            )
        }

        const data = JSON.parse(event.data) as AnthropicStreamEvent
        const usageDelta =
            data.type === 'message_start'
                ? data.message.usage
                : data.type === 'message_delta'
                  ? data.usage
                  : undefined

        if (usageDelta != null) {
            usage = mergeAnthropicUsage(usage, usageDelta)
            yield createAnthropicChunk('', {
                usage,
                generationInfo: {
                    id: data.type === 'message_start' ? data.message.id : undefined,
                    model:
                        data.type === 'message_start'
                            ? data.message.model
                            : undefined,
                    stop_reason:
                        data.type === 'message_delta'
                            ? data.delta?.stop_reason
                            : undefined,
                    stop_sequence:
                        data.type === 'message_delta'
                            ? data.delta?.stop_sequence
                            : undefined
                }
            })
            continue
        }

        const chunk = convertAnthropicStreamEvent(
            data,
            reasoningState,
            toolNameMapper
        )
        if (chunk == null) continue

        if (reasoningState.endedAt == null && hasAnthropicResponseChunk(chunk)) {
            reasoningState.endedAt = Date.now()
        }
        yield chunk
    }

    const reasoningChunk = createReasoningChunk(reasoningState)
    if (reasoningChunk) yield reasoningChunk
}

async function createAnthropicRequest(
    requester: ModelHubRequester,
    params: ModelRequestParams,
    toolNameMapper: AnthropicToolNameMapper,
    stream: boolean
) {
    const parsedModel = parseOpenAIModelNameWithReasoningEffort(params.model ?? '')
    const override = {
        ...(params.overrideRequestParams ?? {})
    }
    const overrideEffort = override.reasoning_effort
    delete override.reasoning_effort

    const model = String(override.model ?? parsedModel.model)
    const maxTokens = normalizeMaxTokens(params.maxTokens)
    const effort = normalizeAnthropicEffort(
        overrideEffort ?? parsedModel.reasoningEffort
    )
    const contents = await messagesToAnthropicContents(
        requester,
        params.input,
        toolNameMapper
    )
    const hasAssistantPrefill =
        contents.messages[contents.messages.length - 1]?.role === 'assistant'
    const generatedThinking = createThinkingConfig(effort, hasAssistantPrefill)
    const tools = formatToolsToAnthropicTools(params.tools ?? [], toolNameMapper)
    const outputConfig =
        effort == null
            ? undefined
            : {
                  ...objectOf(override.output_config),
                  effort
              }

    const request = stripUndefined({
        model,
        max_tokens: maxTokens,
        stream,
        system: contents.system,
        messages: contents.messages,
        stop_sequences:
            typeof params.stop === 'string' ? [params.stop] : params.stop,
        temperature: generatedThinking == null ? params.temperature : undefined,
        top_p: generatedThinking == null ? params.topP : undefined,
        tools,
        cache_control: createAnthropicCacheControl(requester),
        thinking: generatedThinking,
        output_config: outputConfig,
        ...override
    })

    if (outputConfig != null) {
        request.output_config = {
            ...outputConfig,
            ...objectOf(override.output_config)
        }
    }

    if (override.thinking !== undefined) {
        request.thinking = override.thinking
    }

    return request
}

async function messagesToAnthropicContents(
    requester: ModelHubRequester,
    messages: BaseMessage[],
    toolNameMapper: AnthropicToolNameMapper
): Promise<AnthropicMessageContents> {
    const result: AnthropicMessage[] = []
    const system: string[] = []

    for (const message of messages) {
        const type = message.getType()

        if (type === 'system') {
            const text = systemTextFromContent(message.content)
            if (text) system.push(text)
            continue
        }

        if (message instanceof ToolMessage || type === 'tool') {
            result.push(await toolMessageToAnthropic(message as ToolMessage, requester))
            continue
        }

        if (message instanceof AIMessage || type === 'ai') {
            result.push(
                await aiMessageToAnthropic(
                    message as AIMessage,
                    requester,
                    toolNameMapper
                )
            )
            continue
        }

        result.push({
            role: 'user',
            content: await userContentToAnthropic(requester, message.content)
        })
    }

    return {
        system: system.length > 0 ? system.join('\n\n') : undefined,
        messages: result.length > 0 ? result : [{ role: 'user', content: '' }]
    }
}

async function aiMessageToAnthropic(
    message: AIMessage,
    requester: ModelHubRequester,
    toolNameMapper: AnthropicToolNameMapper
): Promise<AnthropicMessage> {
    const blocks: AnthropicMessageContentBlock[] = []
    const reasoningBlocks = message.additional_kwargs
        .reasoning_blocks as AnthropicMessageContentBlock[] | undefined

    if (Array.isArray(reasoningBlocks) && reasoningBlocks.length > 0) {
        blocks.push(...reasoningBlocks.filter(isReasoningBlock))
    } else {
        const reasoningContent = message.additional_kwargs
            .reasoning_content as string | undefined
        const reasoningSignature = message.additional_kwargs
            .reasoning_signature as string | undefined
        if (reasoningContent && reasoningSignature) {
            blocks.push({
                type: 'thinking',
                thinking: reasoningContent,
                signature: reasoningSignature
            })
        }
    }

    const content = await contentToAnthropicBlocks(requester, message.content)
    blocks.push(...content)

    for (const toolCall of message.tool_calls ?? []) {
        blocks.push({
            type: 'tool_use',
            id: toolCall.id ?? createToolUseId(toolCall.name),
            name: toolNameMapper.sanitize(toolCall.name),
            input: objectOf(toolCall.args)
        })
    }

    return {
        role: 'assistant',
        content:
            blocks.length === 0
                ? ''
                : blocks.length === 1 && blocks[0].type === 'text'
                  ? blocks[0].text
                  : blocks
    }
}

async function toolMessageToAnthropic(
    message: ToolMessage,
    requester: ModelHubRequester
): Promise<AnthropicMessage> {
    const content =
        typeof message.content === 'string'
            ? message.content
            : await contentToAnthropicBlocks(requester, message.content)
    const normalizedContent =
        Array.isArray(content) && content.length < 1 ? '' : content

    return {
        role: 'user',
        content: [
            stripUndefined({
                type: 'tool_result',
                tool_use_id: message.tool_call_id,
                content: normalizedContent,
                is_error: message.status === 'error' ? true : undefined
            }) as AnthropicToolResultBlock
        ]
    }
}

async function userContentToAnthropic(
    requester: ModelHubRequester,
    content: MessageContent
) {
    if (typeof content === 'string') return content
    const blocks = await contentToAnthropicBlocks(requester, content)
    return blocks.length > 0 ? blocks : ''
}

async function contentToAnthropicBlocks(
    requester: ModelHubRequester,
    content: MessageContent
): Promise<AnthropicInputContentBlock[]> {
    if (typeof content === 'string') return content ? [{ type: 'text', text: content }] : []

    const blocks: AnthropicInputContentBlock[] = []
    for (const part of content) {
        const block = await contentPartToAnthropicBlock(requester, part)
        if (block != null) blocks.push(block)
    }
    return blocks
}

async function contentPartToAnthropicBlock(
    requester: ModelHubRequester,
    part: MessageContentComplex
): Promise<AnthropicInputContentBlock | null> {
    if (isMessageContentText(part)) {
        return { type: 'text', text: part.text }
    }

    if (isMessageContentImageUrl(part)) {
        return await imageContentToAnthropic(requester, part)
    }

    if (isFileLikePart(part)) {
        return await fileContentToAnthropic(requester, part)
    }

    if (isAnthropicInputBlock(part)) return part
    if (isInlineDataPart(part)) return inlineDataToAnthropic(requester, part)

    return {
        type: 'text',
        text: stringifyUnknownContent(part)
    }
}

async function imageContentToAnthropic(
    requester: ModelHubRequester,
    part: MessageContentComplex
): Promise<AnthropicImageBlock | null> {
    try {
        const url = await fetchImageUrl(requester.requestContext().plugin, part as any)
        if (/^https?:\/\//i.test(url)) {
            return {
                type: 'image',
                source: {
                    type: 'url',
                    url
                }
            }
        }

        const match = url.match(/^data:([^;]+);base64,(.+)$/)
        if (!match) return null

        return {
            type: 'image',
            source: {
                type: 'base64',
                media_type: normalizeAnthropicImageMime(match[1]),
                data: match[2]
            }
        }
    } catch (error) {
        requester.logger.warn(error)
        return null
    }
}

async function fileContentToAnthropic(
    requester: ModelHubRequester,
    part: MessageContentComplex
): Promise<AnthropicInputContentBlock | null> {
    try {
        const { buffer, mimeType } = await fetchFileLikeUrl(
            requester.requestContext().plugin,
            part as any
        )

        if (mimeType.startsWith('image/')) {
            return {
                type: 'image',
                source: {
                    type: 'base64',
                    media_type: normalizeAnthropicImageMime(mimeType),
                    data: buffer.toString('base64')
                }
            }
        }

        if (mimeType === 'application/pdf') {
            return {
                type: 'document',
                source: {
                    type: 'base64',
                    media_type: 'application/pdf',
                    data: buffer.toString('base64')
                }
            }
        }

        if (mimeType.startsWith('text/') || mimeType === 'application/json') {
            return {
                type: 'document',
                source: {
                    type: 'text',
                    media_type: 'text/plain',
                    data: buffer.toString('utf8')
                }
            }
        }

        requester.logger.warn(`Unsupported Anthropic file mime type: ${mimeType}`)
        return null
    } catch (error) {
        requester.logger.warn(error)
        return null
    }
}

function inlineDataToAnthropic(
    requester: ModelHubRequester,
    part: MessageContentComplex
): AnthropicInputContentBlock | null {
    const inline = (part as any).inline_data ?? (part as any).inlineData
    const mimeType = inline?.mime_type ?? inline?.mimeType
    const data = inline?.data
    if (typeof mimeType !== 'string' || typeof data !== 'string') return null

    if (mimeType.startsWith('image/')) {
        return {
            type: 'image',
            source: {
                type: 'base64',
                media_type: normalizeAnthropicImageMime(mimeType),
                data
            }
        }
    }

    if (mimeType === 'application/pdf') {
        return {
            type: 'document',
            source: {
                type: 'base64',
                media_type: 'application/pdf',
                data
            }
        }
    }

    if (mimeType.startsWith('text/') || mimeType === 'application/json') {
        return {
            type: 'document',
            source: {
                type: 'text',
                media_type: 'text/plain',
                data: Buffer.from(data, 'base64').toString('utf8')
            }
        }
    }

    requester.logger.warn(`Unsupported Anthropic inline mime type: ${mimeType}`)
    return null
}

function formatToolsToAnthropicTools(
    tools: StructuredTool[],
    toolNameMapper: AnthropicToolNameMapper
): AnthropicTool[] | undefined {
    if (tools.length < 1) return undefined

    return tools.map((tool) => ({
        name: toolNameMapper.sanitize(tool.name),
        description: tool.description,
        input_schema: normalizeToolInputSchema(
            removeAdditionalProperties(
                isZodSchemaV3(tool.schema)
                    ? zodToJsonSchema(tool.schema as never)
                    : tool.schema
            ) as Record<string, unknown>
        )
    }))
}

function parseAnthropicResponse(
    data: AnthropicResponse,
    toolNameMapper: AnthropicToolNameMapper
) {
    let content = ''
    const toolCalls: {
        name: string
        args: string
        id: string
        index: number
    }[] = []
    const reasoningState = createReasoningState()

    for (const block of data.content ?? []) {
        if (block.type === 'text') {
            content += block.text
        } else if (block.type === 'tool_use') {
            toolCalls.push({
                name: toolNameMapper.restore(block.name),
                args: JSON.stringify(block.input ?? {}),
                id: block.id,
                index: toolCalls.length
            })
        } else if (block.type === 'thinking') {
            pushThinkingBlock(reasoningState, reasoningState.blocks.length, block)
        } else if (block.type === 'redacted_thinking') {
            reasoningState.blocks.push(block)
        }
    }

    const usage = data.usage ? anthropicUsageToMetadata(data.usage) : undefined
    const additional = reasoningAdditionalKwargs(reasoningState)
    const message = new AIMessageChunk({
        content,
        tool_call_chunks: toolCalls,
        usage_metadata: usage,
        additional_kwargs: additional
    })

    return new ChatGenerationChunk({
        generationInfo: stripUndefined({
            id: data.id,
            model: data.model,
            stop_reason: data.stop_reason,
            stop_sequence: data.stop_sequence,
            stop_details: data.stop_details,
            usage_metadata: usage
        }),
        message,
        text: getMessageContent(message.content) ?? content
    })
}

function convertAnthropicStreamEvent(
    event: AnthropicStreamEvent,
    reasoningState: ReturnType<typeof createReasoningState>,
    toolNameMapper: AnthropicToolNameMapper
): ChatGenerationChunk | undefined {
    if (event.type === 'content_block_start') {
        const block = event.content_block
        if (block.type === 'text') {
            return block.text ? createAnthropicChunk(block.text) : undefined
        }
        if (block.type === 'tool_use') {
            return createAnthropicToolChunk({
                id: block.id,
                index: event.index,
                name: toolNameMapper.restore(block.name),
                args: objectHasKeys(block.input)
                    ? JSON.stringify(block.input)
                    : ''
            })
        }
        if (block.type === 'thinking') {
            pushThinkingBlock(reasoningState, event.index, block)
            return undefined
        }
        if (block.type === 'redacted_thinking') {
            reasoningState.blocks[event.index] = block
        }
        return undefined
    }

    if (event.type !== 'content_block_delta') return undefined

    const delta = event.delta
    if (delta.type === 'text_delta') {
        return createAnthropicChunk(delta.text)
    }
    if (delta.type === 'input_json_delta') {
        return createAnthropicToolChunk({
            index: event.index,
            args: delta.partial_json
        })
    }
    if (delta.type === 'thinking_delta') {
        reasoningState.content += delta.thinking
        const block = reasoningState.blocks[event.index]
        if (block?.type === 'thinking') block.thinking += delta.thinking
        return undefined
    }
    if (delta.type === 'signature_delta') {
        const block = reasoningState.blocks[event.index]
        if (block?.type === 'thinking') block.signature = delta.signature
        return undefined
    }
}

async function getAnthropicModels(
    requester: ModelHubRequester,
    signal?: AbortSignal
): Promise<ProviderModelEntry[]> {
    const result: ProviderModelEntry[] = []
    let afterId: string | undefined

    while (true) {
        const query = new URLSearchParams({ limit: '100' })
        if (afterId) query.set('after_id', afterId)

        const response = await requester.get(`models?${query.toString()}`, {}, { signal })
        await checkResponse(response)
        const payload = JSON.parse(await response.text()) as {
            data?: unknown[]
            has_more?: boolean
            last_id?: string
        }
        result.push(...parseAnthropicModels(payload))

        if (!payload.has_more || !payload.last_id) break
        afterId = payload.last_id
    }

    return dedupeProviderModels(result)
}

function createAnthropicChunk(
    text: string,
    options: {
        usage?: AnthropicUsage
        generationInfo?: Record<string, unknown>
    } = {}
) {
    const usage = options.usage
        ? anthropicUsageToMetadata(options.usage)
        : undefined
    return new ChatGenerationChunk({
        generationInfo: stripUndefined({
            ...options.generationInfo,
            usage_metadata: usage
        }),
        message: new AIMessageChunk({
            content: text,
            usage_metadata: usage
        }),
        text
    })
}

function createAnthropicToolChunk(toolCall: {
    name?: string
    args?: string
    id?: string
    index: number
}) {
    return new ChatGenerationChunk({
        message: new AIMessageChunk({
            content: '',
            tool_call_chunks: [toolCall]
        }),
        text: ''
    })
}

function createReasoningChunk(
    reasoningState: ReturnType<typeof createReasoningState>
) {
    const additional = reasoningAdditionalKwargs(reasoningState)
    if (Object.keys(additional).length < 1) return undefined

    return new ChatGenerationChunk({
        message: new AIMessageChunk({
            content: '',
            additional_kwargs: additional
        }),
        text: ''
    })
}

function reasoningAdditionalKwargs(
    reasoningState: ReturnType<typeof createReasoningState>
) {
    const blocks = reasoningState.blocks.filter(isReasoningBlock)
    const reasoningSignature =
        blocks.length === 1 && blocks[0].type === 'thinking'
            ? blocks[0].signature
            : undefined
    const reasoningTime =
        reasoningState.content || blocks.length > 0
            ? (reasoningState.endedAt ?? Date.now()) - reasoningState.startedAt
            : undefined

    return stripUndefined({
        reasoning_content: reasoningState.content || undefined,
        reasoning_signature: reasoningSignature,
        reasoning_blocks: blocks.length > 0 ? blocks : undefined,
        reasoning_time: reasoningTime
    })
}

function createReasoningState() {
    return {
        content: '',
        startedAt: Date.now(),
        endedAt: undefined as number | undefined,
        blocks: [] as (AnthropicThinkingBlock | AnthropicRedactedThinkingBlock | undefined)[]
    }
}

function pushThinkingBlock(
    reasoningState: ReturnType<typeof createReasoningState>,
    index: number,
    block: AnthropicThinkingBlock
) {
    reasoningState.content += block.thinking ?? ''
    reasoningState.blocks[index] = {
        type: 'thinking',
        thinking: block.thinking ?? '',
        signature: block.signature ?? ''
    }
}

function anthropicUsageToMetadata(usage: AnthropicUsage) {
    const cacheReadTokens = usage.cache_read_input_tokens ?? 0
    const cacheCreationTokens = usage.cache_creation_input_tokens ?? 0
    const inputTokens =
        (usage.input_tokens ?? 0) + cacheReadTokens + cacheCreationTokens
    const outputTokens = usage.output_tokens ?? 0
    const metadata = createUsageMetadata({
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        cacheReadTokens: usage.cache_read_input_tokens,
        cacheCreationTokens: usage.cache_creation_input_tokens,
        reasoningTokens: usage.output_tokens_details?.thinking_tokens
    })
    const cacheCreation = usage.cache_creation

    if (cacheCreation != null) {
        metadata.input_token_details = {
            ...metadata.input_token_details,
            ...(cacheCreation.ephemeral_5m_input_tokens != null
                ? {
                      cache_creation_5m:
                          cacheCreation.ephemeral_5m_input_tokens
                  }
                : {}),
            ...(cacheCreation.ephemeral_1h_input_tokens != null
                ? {
                      cache_creation_1h:
                          cacheCreation.ephemeral_1h_input_tokens
                  }
                : {})
        } as typeof metadata.input_token_details & {
            cache_creation_5m?: number
            cache_creation_1h?: number
        }
    }

    return metadata
}

function mergeAnthropicUsage(
    previous: AnthropicUsage | undefined,
    next: AnthropicUsage
): AnthropicUsage {
    return {
        ...previous,
        ...next,
        input_tokens: next.input_tokens ?? previous?.input_tokens,
        output_tokens: next.output_tokens ?? previous?.output_tokens,
        cache_creation_input_tokens:
            next.cache_creation_input_tokens ??
            previous?.cache_creation_input_tokens,
        cache_read_input_tokens:
            next.cache_read_input_tokens ?? previous?.cache_read_input_tokens,
        cache_creation: mergeAnthropicCacheCreation(
            previous?.cache_creation,
            next.cache_creation
        ),
        iterations: next.iterations ?? previous?.iterations,
        output_tokens_details: {
            ...previous?.output_tokens_details,
            ...next.output_tokens_details
        }
    }
}

function mergeAnthropicCacheCreation(
    previous: AnthropicUsage['cache_creation'] | undefined,
    next: AnthropicUsage['cache_creation'] | undefined
): AnthropicUsage['cache_creation'] | undefined {
    if (previous == null) return next
    if (next == null) return previous

    return {
        ...previous,
        ...next,
        ephemeral_5m_input_tokens:
            next.ephemeral_5m_input_tokens ??
            previous.ephemeral_5m_input_tokens,
        ephemeral_1h_input_tokens:
            next.ephemeral_1h_input_tokens ??
            previous.ephemeral_1h_input_tokens
    }
}

function createThinkingConfig(
    effort: AnthropicEffort | undefined,
    hasAssistantPrefill: boolean
): AnthropicThinking | undefined {
    if (effort == null || hasAssistantPrefill) return undefined

    return {
        type: 'adaptive',
        display: 'summarized'
    }
}

function createAnthropicCacheControl(
    requester: ModelHubRequester
): AnthropicCacheControl | undefined {
    const config = requester.currentConfig()
    if (config.anthropicPromptCache !== true) return undefined

    return {
        type: 'ephemeral',
        ...(config.anthropicPromptCacheTtl === '1h' ? { ttl: '1h' } : {})
    }
}

function normalizeAnthropicEffort(
    effort: unknown
): AnthropicEffort | undefined {
    if (effort === 'none' || effort === 'minimal' || effort === 'tiny') {
        return undefined
    }
    if (
        effort === 'low' ||
        effort === 'medium' ||
        effort === 'high' ||
        effort === 'xhigh' ||
        effort === 'max'
    ) {
        return effort
    }
}

function normalizeMaxTokens(value: number | undefined) {
    const number = Number(value)
    if (!Number.isFinite(number) || number < 1) return 4096
    return Math.floor(number)
}

function normalizeAnthropicImageMime(mimeType: string) {
    if (
        mimeType === 'image/jpeg' ||
        mimeType === 'image/png' ||
        mimeType === 'image/gif' ||
        mimeType === 'image/webp'
    ) {
        return mimeType
    }
    return 'image/jpeg'
}

function createAnthropicToolNameMapper(
    tools: StructuredTool[]
): AnthropicToolNameMapper {
    const sanitizeMap = new Map<string, string>()
    const restoreMap = new Map<string, string>()
    const used = new Set<string>()

    for (const tool of tools) {
        const sanitized = sanitizeAnthropicToolName(tool.name, used)
        sanitizeMap.set(tool.name, sanitized)
        restoreMap.set(sanitized, tool.name)
    }

    return {
        sanitize(name: string | undefined) {
            const original = name || 'tool'
            const known = sanitizeMap.get(original)
            if (known) return known

            const sanitized = sanitizeAnthropicToolName(original, used)
            sanitizeMap.set(original, sanitized)
            restoreMap.set(sanitized, original)
            return sanitized
        },
        restore(name: string | undefined) {
            const value = name || ''
            return restoreMap.get(value) ?? value
        }
    }
}

function sanitizeAnthropicToolName(name: string, used: Set<string>) {
    const fallback = 'tool'
    const normalized = (name || fallback)
        .normalize('NFKC')
        .replace(/[^a-zA-Z0-9_-]+/g, '_')
        .replace(/^[^a-zA-Z_]+/, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 64)

    let result = normalized || fallback
    if (!/^[A-Za-z_]/.test(result)) result = `_${result}`
    result = result.slice(0, 64)

    let unique = result
    let index = 2
    while (used.has(unique)) {
        const suffix = `_${index++}`
        unique = `${result.slice(0, Math.max(1, 64 - suffix.length))}${suffix}`
    }
    used.add(unique)
    return unique
}

function normalizeToolInputSchema(schema: Record<string, unknown>) {
    if (schema.type === 'object') return schema
    return {
        type: 'object',
        properties: {},
        ...schema
    }
}

function systemTextFromContent(content: MessageContent) {
    if (typeof content === 'string') return content.trim()
    return content
        .map((part) => {
            if (isMessageContentText(part)) return part.text
            const text = (part as { text?: unknown }).text
            return typeof text === 'string' ? text : ''
        })
        .filter(Boolean)
        .join('\n')
        .trim()
}

function stringifyUnknownContent(value: unknown) {
    if (typeof value === 'string') return value
    try {
        return JSON.stringify(value)
    } catch {
        return String(value)
    }
}

function objectOf(value: unknown): Record<string, any> {
    return value != null && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, any>)
        : {}
}

function objectHasKeys(value: unknown) {
    return value != null && typeof value === 'object' && Object.keys(value).length > 0
}

function stripUndefined<T extends Record<string, any>>(value: T): T {
    for (const key of Object.keys(value)) {
        if (value[key] === undefined) delete value[key]
        if (
            value[key] != null &&
            typeof value[key] === 'object' &&
            !Array.isArray(value[key])
        ) {
            stripUndefined(value[key] as Record<string, any>)
        }
    }
    return value
}

function isFileLikePart(part: MessageContentComplex) {
    return (
        part != null &&
        typeof part === 'object' &&
        ['file_url', 'audio_url', 'video_url'].includes(String(part.type))
    )
}

function isInlineDataPart(part: MessageContentComplex) {
    return (
        part != null &&
        typeof part === 'object' &&
        ((part as any).inline_data != null || (part as any).inlineData != null)
    )
}

function isAnthropicInputBlock(
    value: MessageContentComplex
): value is AnthropicInputContentBlock {
    if (value == null || typeof value !== 'object') return false
    return (
        value.type === 'text' ||
        value.type === 'image' ||
        value.type === 'document'
    )
}

function isReasoningBlock(
    value: AnthropicMessageContentBlock | undefined
): value is AnthropicThinkingBlock | AnthropicRedactedThinkingBlock {
    return value?.type === 'thinking' || value?.type === 'redacted_thinking'
}

function hasAnthropicResponseChunk(chunk: ChatGenerationChunk) {
    const message = chunk.message as AIMessageChunk
    return (
        chunk.text.length > 0 ||
        (typeof message.content === 'string' && message.content.length > 0) ||
        (Array.isArray(message.content) && message.content.length > 0) ||
        (message.tool_call_chunks?.length ?? 0) > 0
    )
}

function createToolUseId(name: string | undefined) {
    return `toolu_${(name || 'tool').replace(/[^a-zA-Z0-9_-]+/g, '_')}`
}

function dedupeProviderModels(models: ProviderModelEntry[]) {
    const result = new Map<string, ProviderModelEntry>()
    for (const model of models) {
        if (!model.name) continue
        result.set(model.name, model)
    }
    return [...result.values()]
}
