import {
    AIMessage,
    AIMessageChunk,
    BaseMessage,
    BaseMessageChunk,
    ToolMessage
} from '@langchain/core/messages'
import { StructuredTool } from '@langchain/core/tools'
import { ChatGeneration, ChatGenerationChunk } from '@langchain/core/outputs'
import { isZodSchemaV3 } from '@langchain/core/utils/types'
import { zodToJsonSchema } from 'zod-to-json-schema'
import {
    createRequestSignal,
    createUsageMetadata,
    fetchFileLikeUrl,
    fetchImageUrl,
    parseOpenAIModelNameWithReasoningEffort,
    removeAdditionalProperties
} from '@chatluna/v1-shared-adapter'
import { checkResponse, sseIterable } from 'koishi-plugin-chatluna/utils/sse'
import {
    getMessageContent,
    isMessageContentImageUrl,
    isMessageContentText
} from 'koishi-plugin-chatluna/utils/string'
import { ModelCapabilities } from 'koishi-plugin-chatluna/llm-core/platform/types'
import type { EmbeddingsResult } from 'koishi-plugin-chatluna/llm-core/platform/api'
import type { ProviderAdapter } from './types'
import type { ModelHubRequester } from '../requester'
import type { ProviderModelEntry } from '../types'
import { parseGeminiModels } from './model-list'

type GeminiPart = Record<string, any>
type GeminiContent = {
    role: 'user' | 'model'
    parts: GeminiPart[]
}

type GeminiMessageContents = {
    contents: GeminiContent[]
    systemInstruction?: {
        parts: GeminiPart[]
    }
}

type GeminiToolNameMapper = {
    sanitize(name: string | undefined): string
    restore(name: string | undefined): string
}

type OpenAIReasoningEffort = NonNullable<
    ReturnType<
        typeof parseOpenAIModelNameWithReasoningEffort
    >['reasoningEffort']
>

type GeminiThinkingLevel = 'low' | 'medium' | 'high'

export const geminiAdapter: ProviderAdapter = {
    id: 'gemini',

    async completion(requester, params): Promise<ChatGeneration> {
        if (!requester.currentConfig().nonStreaming) {
            return requester.defaultCompletion(params)
        }

        const generation = await geminiCompletion(requester, params)
        return generation
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
        yield* geminiCompletionStream(requester, params)
    },

    async embeddings(requester, params): Promise<EmbeddingsResult> {
        const input =
            typeof params.input === 'string' ? [params.input] : params.input
        const response = await requester.post(
            `models/${params.model}:batchEmbedContents`,
            {
                requests: input.map((text) => ({
                    model: `models/${params.model}`,
                    content: {
                        parts: [{ text }]
                    }
                }))
            },
            { signal: params.signal }
        )
        await checkResponse(response)
        const data = JSON.parse(await response.text()) as {
            embeddings?: { values: number[] }[]
        }
        return data.embeddings?.map((item) => item.values) ?? []
    },

    async rerank() {
        return []
    },

    async getModels(requester, config) {
        const response = await requester.get(
            'models',
            {},
            { signal: config?.signal }
        )
        await checkResponse(response)
        return parseGeminiModels(JSON.parse(await response.text()))
    }
}

async function geminiCompletion(requester: ModelHubRequester, params: any) {
    const toolNameMapper = createGeminiToolNameMapper(params.tools ?? [])
    const request = await createGeminiRequest(requester, params, toolNameMapper)
    const requestSignal = createRequestSignal(params)
    try {
        const response = await requester.post(
            `models/${prepareGeminiModel(params.model, requester)}:generateContent`,
            request,
            { signal: requestSignal.signal }
        )
        requestSignal.clearTimeout()
        await checkResponse(response)
        return await parseGeminiResponse(
            await response.text(),
            requester,
            toolNameMapper
        )
    } finally {
        requestSignal.dispose()
    }
}

async function* geminiCompletionStream(
    requester: ModelHubRequester,
    params: any
) {
    const toolNameMapper = createGeminiToolNameMapper(params.tools ?? [])
    const request = await createGeminiRequest(requester, params, toolNameMapper)
    const requestSignal = createRequestSignal(params)
    const streamState: GeminiStreamState = { nextToolIndex: 0, partIndex: 0 }
    try {
        const response = await requester.post(
            `models/${prepareGeminiModel(params.model, requester)}:streamGenerateContent?alt=sse`,
            request,
            { signal: requestSignal.signal }
        )
        requestSignal.clearTimeout()
        await checkResponse(response)

        for await (const event of sseIterable(response, {
            timeout: params.timeout,
            signal: requestSignal.signal
        })) {
            if (!event.data || event.data === '[DONE]') continue
            yield await parseGeminiResponse(
                event.data,
                requester,
                toolNameMapper,
                streamState
            )
        }
    } finally {
        requestSignal.dispose()
    }
}

export async function createGeminiRequest(
    requester: ModelHubRequester,
    params: any,
    toolNameMapper: GeminiToolNameMapper
) {
    const messageContents = await messagesToGeminiContents(
        requester,
        params.input,
        toolNameMapper,
        params.model
    )
    const current = requester.currentConfig()
    const parsedModel = parseOpenAIModelNameWithReasoningEffort(
        params.model ?? ''
    )
    const thinkingConfig = createGeminiThinkingConfig(
        parsedModel.model,
        parsedModel.reasoningEffort,
        current
    )
    const tools = geminiTools(
        requester,
        params.tools ?? [],
        parsedModel.model,
        toolNameMapper
    )
    const generationConfig = filterEmpty({
        temperature: params.temperature,
        topP: params.topP,
        maxOutputTokens: params.maxTokens,
        stopSequences: params.stop,
        responseModalities:
            current.imageGeneration &&
            supportsGeminiImageGeneration(parsedModel.model)
                ? ['TEXT', 'IMAGE']
                : undefined,
        thinkingConfig
    })

    return filterEmpty({
        ...messageContents,
        generationConfig,
        safetySettings: createSafetySettings(),
        tools,
        toolConfig:
            tools?.some(
                (tool) =>
                    tool.googleSearch != null ||
                    tool.codeExecution != null ||
                    tool.urlContext != null
            ) && isGemini3Model(params.model)
                ? { includeServerSideToolInvocations: true }
                : undefined
    })
}

async function messagesToGeminiContents(
    requester: ModelHubRequester,
    messages: BaseMessage[],
    toolNameMapper: GeminiToolNameMapper,
    model: string
): Promise<GeminiMessageContents> {
    const result: GeminiContent[] = []
    const systemParts: GeminiPart[] = []

    let previousWasTool = false
    for (const message of messages) {
        const type = message.getType()
        if (type === 'system') {
            systemParts.push(
                ...(await contentToParts(requester, message.content, model))
            )
            previousWasTool = false
            continue
        }
        if (type === 'tool') {
            const tool = message as ToolMessage
            const text =
                typeof tool.content === 'string'
                    ? tool.content
                    : tool.content
                          .filter(isMessageContentText)
                          .map((part) => part.text)
                          .join('')
            const response: GeminiPart = {
                name: toolNameMapper.sanitize(tool.name),
                response: parseToolResponse(text),
                id: tool.tool_call_id
            }
            const parts: GeminiPart[] = [{ functionResponse: response }]
            if (Array.isArray(tool.content)) {
                const media = await contentToParts(
                    requester,
                    tool.content.filter(
                        (part) =>
                            isMessageContentImageUrl(part) ||
                            isFileLikePart(part)
                    ),
                    model
                )
                for (const part of media) {
                    if (part.mediaProcessing || part.media_processing)
                        parts.push(part)
                    else (response.parts ??= []).push(part)
                }
            }
            if (previousWasTool) result[result.length - 1].parts.push(...parts)
            else result.push({ role: 'user', parts })
            previousWasTool = true
            continue
        }
        previousWasTool = false

        const ai = message as AIMessage
        if (ai.tool_calls?.length) {
            const thoughtData = (message.additional_kwargs?.thought_data ??
                {}) as Record<string, any>
            const shared = { ...thoughtData }
            for (const call of ai.tool_calls)
                if (call.id) delete shared[call.id]
            const parts = await contentToParts(
                requester,
                message.content,
                model
            )
            parts.push(...getContextParts(shared))
            for (const toolCall of ai.tool_calls) {
                const saved = thoughtData[toolCall.id] ?? thoughtData
                if (toolCall.id && thoughtData[toolCall.id])
                    parts.push(...getContextParts(saved))
                const signature = findThoughtSignature(saved)
                parts.push({
                    functionCall: {
                        name: toolNameMapper.sanitize(toolCall.name),
                        args: toolCall.args,
                        id: toolCall.id
                    },
                    ...(signature ? { thoughtSignature: signature } : {})
                })
            }
            result.push({
                role: 'model',
                parts
            })
            continue
        }

        const thoughtData = (message.additional_kwargs?.thought_data ??
            {}) as Record<string, any>
        result.push({
            role: type === 'ai' ? 'model' : 'user',
            parts: [
                ...getContextParts(thoughtData),
                ...(await contentToParts(requester, message.content, model))
            ]
        })
    }

    return filterEmpty({
        contents: result,
        systemInstruction:
            systemParts.length > 0 ? { parts: systemParts } : undefined
    }) as GeminiMessageContents
}

async function contentToParts(
    requester: ModelHubRequester,
    content: BaseMessage['content'],
    model: string
): Promise<GeminiPart[]> {
    if (typeof content === 'string') return content ? [{ text: content }] : []
    const config = requester.currentConfig()
    const agentic =
        config.agenticVideo &&
        AGENTIC_VIDEO_MODELS.some((id) =>
            prepareGeminiModelId(model).includes(id)
        )
    const mediaPart = (mimeType: string, data: string) => {
        const mode =
            agentic && mimeType.startsWith('video/') ? 'AGENTIC' : undefined
        return config.useCamelCaseMediaFields
            ? filterEmpty({
                  inlineData: { mimeType, data },
                  mediaProcessing: mode
              })
            : filterEmpty({
                  inline_data: { mime_type: mimeType, data },
                  media_processing: mode
              })
    }
    const parts = await Promise.all(
        content.map(async (part) => {
            if (isMessageContentText(part)) {
                return part.text.length > 0 ? { text: part.text } : null
            }
            if (isMessageContentImageUrl(part)) {
                const url = await fetchImageUrl(
                    requester.requestContext().plugin,
                    part
                )
                const mimeType =
                    url.match(/^data:([^;]+);base64,/)?.[1] ?? 'image/jpeg'
                return mediaPart(
                    mimeType,
                    url.replace(/^data:[^;]+;base64,/, '')
                )
            }
            if (isFileLikePart(part)) {
                const file = await fetchFileLikeUrl(
                    requester.requestContext().plugin,
                    part as any
                )
                return mediaPart(file.mimeType, file.buffer.toString('base64'))
            }
            return part as GeminiPart
        })
    )
    return parts.filter(Boolean)
}

const AGENTIC_VIDEO_MODELS = [
    'gemini-3.5-flash-lite',
    'gemini-3.6-flash',
    'gemini-3.7-flash',
    'gemini-3.8-flash'
]

function isMediaProcessingPart(part: GeminiPart) {
    const tool = part.toolCall ?? part.toolResponse
    return (
        tool != null &&
        (tool.toolType == null || tool.toolType === 'MEDIA_PROCESSING')
    )
}

function getContextParts(value: unknown): GeminiPart[] {
    const result: GeminiPart[] = []
    const seen = new Set<unknown>()
    const visit = (part: any) => {
        if (!part || typeof part !== 'object' || seen.has(part)) return
        seen.add(part)
        if (
            part.toolCall ||
            part.toolResponse ||
            part.executableCode ||
            part.codeExecutionResult
        ) {
            if (!isMediaProcessingPart(part)) result.push(part)
        } else Object.values(part).forEach(visit)
    }
    visit(value)
    return result
}

function findThoughtSignature(value: any): string | undefined {
    if (typeof value?.thoughtSignature === 'string')
        return value.thoughtSignature
    if (value && typeof value === 'object') {
        for (const part of Object.values(value)) {
            const signature = findThoughtSignature(part)
            if (signature) return signature
        }
    }
}

function geminiTools(
    requester: ModelHubRequester,
    tools: StructuredTool[],
    model: string,
    toolNameMapper: GeminiToolNameMapper
) {
    const result: GeminiPart[] = []
    const functionDeclarations = tools.map((tool) => ({
        name: toolNameMapper.sanitize(tool.name),
        description: tool.description,
        parameters: sanitizeGeminiSchema(
            removeAdditionalProperties(
                isZodSchemaV3(tool.schema)
                    ? zodToJsonSchema(tool.schema as never)
                    : tool.schema
            )
        )
    }))
    const builtinTools =
        functionDeclarations.length > 0 && !isGemini3Model(model)
            ? []
            : geminiBuiltinTools(requester, model)

    if (functionDeclarations.length > 0) {
        result.push({ functionDeclarations })
    }
    result.push(...builtinTools)

    return result.length > 0 ? result : undefined
}

const GEMINI_SCHEMA_KEYS = new Set([
    'type',
    'format',
    'title',
    'description',
    'nullable',
    'default',
    'example',
    'enum',
    'items',
    'minItems',
    'maxItems',
    'minLength',
    'maxLength',
    'minProperties',
    'maxProperties',
    'minimum',
    'maximum',
    'pattern',
    'properties',
    'required',
    'propertyOrdering',
    'anyOf'
])

function sanitizeGeminiSchema(schema: any): any {
    if (!schema || typeof schema !== 'object' || Array.isArray(schema))
        return schema
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(schema)) {
        if ((key === 'oneOf' || key === 'anyOf') && Array.isArray(value))
            result.anyOf = value.map(sanitizeGeminiSchema)
        else if (key === 'properties' && value && typeof value === 'object') {
            result.properties = Object.fromEntries(
                Object.entries(value).map(([name, sub]) => [
                    name,
                    sanitizeGeminiSchema(sub)
                ])
            )
        } else if (key === 'items') result.items = sanitizeGeminiSchema(value)
        else if (GEMINI_SCHEMA_KEYS.has(key)) result[key] = value
    }
    return result
}

function geminiBuiltinTools(requester: ModelHubRequester, model: string) {
    const config = requester.currentConfig()
    const lower = prepareGeminiModelId(model)
    const unsupported =
        lower.includes('gemini-2.0-flash-lite') ||
        lower.includes('gemini-2.0-flash-exp')
    if (unsupported) return []

    const result: GeminiPart[] = []
    if (config.googleSearch) result.push({ googleSearch: {} })
    if (config.codeExecution) result.push({ codeExecution: {} })
    if (config.urlContext) result.push({ urlContext: {} })
    return result
}

function isGemini3Model(model: string | undefined) {
    return prepareGeminiModelId(model).includes('gemini-3')
}

function supportsGeminiThinkingConfig(model: string | undefined) {
    const id = prepareGeminiModelId(model)
    if (!id) return false
    return (
        id.includes('gemini-2.5') ||
        id.includes('gemini-3') ||
        id.includes('gemini-flash-latest') ||
        id.includes('gemini-pro-latest') ||
        id.includes('gemini-flash-lite-latest')
    )
}

function createGeminiThinkingConfig(
    model: string,
    effort: OpenAIReasoningEffort | undefined,
    current: {
        thinkingBudget?: number
        includeThoughts?: boolean
    }
) {
    if (!supportsGeminiThinkingConfig(model)) return undefined

    const suffixBudget =
        effort == null ? undefined : geminiThinkingBudgetForEffort(effort)
    const hasProviderConfig =
        current.includeThoughts === true || current.thinkingBudget != null
    const hasSuffixConfig = suffixBudget != null

    if (!hasProviderConfig && !hasSuffixConfig) return undefined

    const shared = {
        includeThoughts: current.includeThoughts === true
    }

    if (isGemini3Model(model)) {
        const thinkingLevel =
            effort == null
                ? geminiThinkingLevelForBudget(current.thinkingBudget)
                : geminiThinkingLevelForEffort(effort)
        return filterEmpty({
            ...shared,
            thinkingLevel,
            ...(effort === 'none' ? { includeThoughts: false } : {})
        })
    }

    return filterEmpty({
        ...shared,
        thinkingBudget: suffixBudget ?? current.thinkingBudget ?? -1
    })
}

function geminiThinkingBudgetForEffort(
    effort: OpenAIReasoningEffort
): number | undefined {
    if (effort === 'none') return 0
    if (effort === 'minimal') return 128
    if (effort === 'low') return 1024
    if (effort === 'medium') return 8192
    if (effort === 'high') return 24576
    if (effort === 'xhigh' || effort === 'max') return 24576
}

function geminiThinkingLevelForEffort(
    effort: OpenAIReasoningEffort
): GeminiThinkingLevel {
    if (effort === 'none' || effort === 'minimal' || effort === 'low') {
        return 'low'
    }
    if (effort === 'medium') return 'medium'
    return 'high'
}

function geminiThinkingLevelForBudget(
    budget: number | undefined
): GeminiThinkingLevel {
    if (budget == null || budget < 0) return 'medium'
    if (budget <= 1024) return 'low'
    if (budget <= 24576) return 'medium'
    return 'high'
}

function supportsGeminiImageGeneration(model: string | undefined) {
    const id = prepareGeminiModelId(model)
    return id.startsWith('gemini-') && id.includes('image')
}

function prepareGeminiModelId(model: string | undefined) {
    const normalized = (model ?? '').replace(/^models\//, '')
    return parseOpenAIModelNameWithReasoningEffort(
        normalized
    ).model.toLowerCase()
}

export function createGeminiToolNameMapper(
    tools: StructuredTool[]
): GeminiToolNameMapper {
    const sanitizeMap = new Map<string, string>()
    const restoreMap = new Map<string, string>()
    const used = new Set<string>()

    for (const tool of tools) {
        const original = tool.name || ''
        const sanitized = sanitizeGeminiToolName(original, used)
        sanitizeMap.set(original, sanitized)
        restoreMap.set(sanitized, original)
    }

    return {
        sanitize(name: string | undefined) {
            const original = name || ''
            if (sanitizeMap.has(original))
                return sanitizeMap.get(original) ?? original
            const sanitized = sanitizeGeminiToolName(original, used)
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

function sanitizeGeminiToolName(name: string, used: Set<string>) {
    const fallback = 'tool'
    const normalized = (name || fallback)
        .normalize('NFKC')
        .replace(/[^a-zA-Z0-9_.:-]+/g, '_')
        .replace(/^[^a-zA-Z_]+/, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 128)

    let result = normalized || fallback
    if (!/^[A-Za-z_]/.test(result)) {
        result = `_${result}`
    }
    result = result.slice(0, 128)

    let unique = result
    let index = 2
    while (used.has(unique)) {
        const suffix = `_${index++}`
        unique = `${result.slice(0, Math.max(1, 128 - suffix.length))}${suffix}`
    }
    used.add(unique)
    return unique
}

export type GeminiStreamState = {
    nextToolIndex: number
    partIndex: number
    currentToolIndex?: number
    currentToolId?: string
}

export async function parseGeminiResponse(
    text: string,
    requester: ModelHubRequester,
    toolNameMapper: GeminiToolNameMapper,
    streamState: GeminiStreamState = { nextToolIndex: 0, partIndex: 0 }
): Promise<ChatGenerationChunk> {
    const data = JSON.parse(text)
    const usage = data.usageMetadata
        ? createUsageMetadata({
              inputTokens: data.usageMetadata.promptTokenCount,
              outputTokens:
                  data.usageMetadata.candidatesTokenCount ??
                  data.candidates?.[0]?.tokenCount,
              totalTokens: data.usageMetadata.totalTokenCount,
              cacheReadTokens: data.usageMetadata.cachedContentTokenCount,
              reasoningTokens: data.usageMetadata.thoughtsTokenCount
          })
        : undefined
    let content = ''
    let reasoning = ''
    const toolCalls = []
    const thoughtData: Record<string, unknown> = {}
    const images: string[] = []

    // ChatLuna exposes a single generation; never mix alternate candidates.
    for (const candidate of (data.candidates ?? []).slice(0, 1)) {
        for (const part of candidate.content?.parts ?? []) {
            const key = `part_${streamState.partIndex++}`
            if (
                part.toolCall ||
                part.toolResponse ||
                part.executableCode ||
                part.codeExecutionResult
            ) {
                if (!isMediaProcessingPart(part))
                    thoughtData[key] = { parts: [part] }
            } else if (
                typeof part.thoughtSignature === 'string' &&
                !part.functionCall
            ) {
                thoughtData[key] = {
                    parts: [{ thoughtSignature: part.thoughtSignature }]
                }
            }
            if (part.text && part.thought) {
                reasoning += part.text
            } else if (part.text) {
                content += part.text
            } else if (part.functionCall) {
                const fresh =
                    part.functionCall.name != null ||
                    streamState.currentToolIndex == null
                if (fresh) {
                    streamState.currentToolIndex = streamState.nextToolIndex++
                    streamState.currentToolId =
                        part.functionCall.id ??
                        `function_call_${streamState.currentToolIndex}`
                }
                const id = streamState.currentToolId!
                toolCalls.push({
                    name: fresh
                        ? toolNameMapper.restore(part.functionCall.name)
                        : undefined,
                    args: part.functionCall.args,
                    id: fresh ? id : undefined,
                    index: streamState.currentToolIndex
                })
                if (typeof part.thoughtSignature === 'string') {
                    thoughtData[id] = {
                        thoughtSignature: part.thoughtSignature
                    }
                }
            } else if (part.inlineData?.data || part.inline_data?.data) {
                const inline = part.inlineData ?? part.inline_data
                const mime = inline.mimeType ?? inline.mime_type ?? 'image/png'
                images.push(`data:${mime};base64,${inline.data}`)
            }
        }
        if (requester.currentConfig().groundingContentDisplay) {
            const grounding = formatGrounding(candidate.groundingMetadata)
            if (grounding) content += `\n${grounding}`
        }
    }

    const message = new AIMessageChunk({
        content:
            images.length > 0 ? [{ type: 'text', text: content }] : content,
        tool_call_chunks: toolCalls.map((toolCall) => ({
            name: toolCall.name,
            args:
                typeof toolCall.args === 'string'
                    ? toolCall.args
                    : JSON.stringify(toolCall.args ?? {}),
            id: toolCall.id,
            index: toolCall.index
        })),
        usage_metadata: usage,
        additional_kwargs: {
            images: images.length > 0 ? images : undefined,
            reasoning_content: reasoning || undefined,
            thought_data:
                Object.keys(thoughtData).length > 0 ? thoughtData : undefined
        }
    })

    return new ChatGenerationChunk({
        generationInfo: usage ? { usage_metadata: usage } : undefined,
        message,
        text: getMessageContent(message.content) ?? content
    })
}

function prepareGeminiModel(model: string, requester: ModelHubRequester) {
    let result = parseOpenAIModelNameWithReasoningEffort(model).model
    if (requester.currentConfig().googleSearch && result.endsWith('-search')) {
        result = result.slice(0, -'-search'.length)
    }
    return result.replace(/^models\//, '')
}

function parseToolResponse(value: string) {
    try {
        const parsed = JSON.parse(value)
        return parsed != null &&
            typeof parsed === 'object' &&
            !Array.isArray(parsed)
            ? parsed
            : { response: parsed }
    } catch {
        return { response: value }
    }
}

function formatGrounding(metadata: any) {
    const chunks = metadata?.groundingChunks ?? []
    if (!chunks.length) return ''
    return chunks
        .map((item: any, index: number) =>
            item.web?.uri
                ? `[^${index}]: [${item.web.title ?? item.web.uri}](${item.web.uri})`
                : ''
        )
        .filter(Boolean)
        .join('\n')
}

function createSafetySettings() {
    return [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'OFF' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'OFF' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'OFF' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'OFF' },
        { category: 'HARM_CATEGORY_CIVIC_INTEGRITY', threshold: 'OFF' }
    ]
}

function filterEmpty<T extends Record<string, any>>(value: T): Partial<T> {
    return Object.fromEntries(
        Object.entries(value).filter(([, item]) => item !== undefined)
    ) as Partial<T>
}

function isFileLikePart(part: any) {
    return (
        part != null &&
        typeof part === 'object' &&
        ['file_url', 'audio_url', 'video_url'].includes(part.type)
    )
}
