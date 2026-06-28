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
    ReturnType<typeof parseOpenAIModelNameWithReasoningEffort>['reasoningEffort']
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
        const input = typeof params.input === 'string' ? [params.input] : params.input
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
        const response = await requester.get('models', {}, { signal: config?.signal })
        await checkResponse(response)
        return parseGeminiModels(JSON.parse(await response.text()))
    }
}

async function geminiCompletion(requester: ModelHubRequester, params: any) {
    const toolNameMapper = createGeminiToolNameMapper(params.tools ?? [])
    const request = await createGeminiRequest(requester, params, toolNameMapper)
    const response = await requester.post(
        `models/${prepareGeminiModel(params.model, requester)}:generateContent`,
        request,
        { signal: params.signal }
    )
    await checkResponse(response)
    return await parseGeminiResponse(
        await response.text(),
        requester,
        toolNameMapper
    )
}

async function* geminiCompletionStream(
    requester: ModelHubRequester,
    params: any
) {
    const toolNameMapper = createGeminiToolNameMapper(params.tools ?? [])
    const request = await createGeminiRequest(requester, params, toolNameMapper)
    const response = await requester.post(
        `models/${prepareGeminiModel(params.model, requester)}:streamGenerateContent?alt=sse`,
        request,
        { signal: params.signal }
    )
    await checkResponse(response)

    let pending = new ChatGenerationChunk({
        message: new AIMessageChunk(''),
        text: ''
    })
    for await (const event of sseIterable(response)) {
        if (!event.data || event.data === '[DONE]') continue
        const chunk = await parseGeminiResponse(
            event.data,
            requester,
            toolNameMapper
        )
        pending = pending.concat(chunk)
        yield chunk
    }
}

async function createGeminiRequest(
    requester: ModelHubRequester,
    params: any,
    toolNameMapper: GeminiToolNameMapper
) {
    const messageContents = await messagesToGeminiContents(
        requester,
        params.input,
        toolNameMapper
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
    toolNameMapper: GeminiToolNameMapper
): Promise<GeminiMessageContents> {
    const result: GeminiContent[] = []
    const systemParts: GeminiPart[] = []

    for (const message of messages) {
        const type = message.getType()
        if (type === 'system') {
            systemParts.push(...(await contentToParts(requester, message.content)))
            continue
        }
        if (type === 'tool') {
            const tool = message as ToolMessage
            result.push({
                role: 'user',
                parts: [
                    {
                        functionResponse: {
                            name: toolNameMapper.sanitize(tool.name),
                            response: parseToolResponse(tool.content as string),
                            id: tool.tool_call_id
                        }
                    }
                ]
            })
            continue
        }

        const ai = message as AIMessage
        if (ai.tool_calls?.length) {
            result.push({
                role: 'model',
                parts: ai.tool_calls.map((toolCall) => ({
                    functionCall: {
                        name: toolNameMapper.sanitize(toolCall.name),
                        args: toolCall.args,
                        id: toolCall.id
                    }
                }))
            })
            continue
        }

        result.push({
            role: type === 'ai' ? 'model' : 'user',
            parts: await contentToParts(requester, message.content)
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
    content: BaseMessage['content']
): Promise<GeminiPart[]> {
    if (typeof content === 'string') return [{ text: content }]
    const parts = await Promise.all(
        content.map(async (part) => {
            if (isMessageContentText(part)) return { text: part.text }
            if (isMessageContentImageUrl(part)) {
                const url = await fetchImageUrl(requester.requestContext().plugin, part)
                const mimeType = url.match(/^data:([^;]+);base64,/)?.[1] ?? 'image/jpeg'
                return {
                    inline_data: {
                        mime_type: mimeType,
                        data: url.replace(/^data:[^;]+;base64,/, '')
                    }
                }
            }
            if (isFileLikePart(part)) {
                const file = await fetchFileLikeUrl(
                    requester.requestContext().plugin,
                    part as any
                )
                return {
                    inline_data: {
                        mime_type: file.mimeType,
                        data: file.buffer.toString('base64')
                    }
                }
            }
            return part as GeminiPart
        })
    )
    return parts.filter(Boolean)
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
        parameters: removeAdditionalProperties(
            isZodSchemaV3(tool.schema)
                ? zodToJsonSchema(tool.schema as never)
                : tool.schema
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
        thinkingBudget:
            suffixBudget ??
            current.thinkingBudget ??
            -1
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
    return parseOpenAIModelNameWithReasoningEffort(normalized)
        .model
        .toLowerCase()
}

function createGeminiToolNameMapper(tools: StructuredTool[]): GeminiToolNameMapper {
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
            if (sanitizeMap.has(original)) return sanitizeMap.get(original) ?? original
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

async function parseGeminiResponse(
    text: string,
    requester: ModelHubRequester,
    toolNameMapper: GeminiToolNameMapper
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
    const images: string[] = []

    for (const candidate of data.candidates ?? []) {
        for (const part of candidate.content?.parts ?? []) {
            if (part.text && part.thought) {
                reasoning += part.text
            } else if (part.text) {
                content += part.text
            } else if (part.functionCall) {
                toolCalls.push({
                    name: toolNameMapper.restore(part.functionCall.name),
                    args: part.functionCall.args,
                    id: part.functionCall.id
                })
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
        content: images.length > 0 ? [{ type: 'text', text: content }] : content,
        tool_call_chunks: toolCalls.map((toolCall, index) => ({
            name: toolCall.name,
            args: JSON.stringify(toolCall.args ?? {}),
            id: toolCall.id ?? `function_call_${index}`,
            index
        })),
        usage_metadata: usage,
        additional_kwargs: {
            images: images.length > 0 ? images : undefined,
            reasoning_content: reasoning || undefined
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
        return JSON.parse(value)
    } catch {
        return { response: value }
    }
}

function formatGrounding(metadata: any) {
    const chunks = metadata?.groundingChunks ?? []
    if (!chunks.length) return ''
    return chunks
        .map((item: any, index: number) =>
            item.web?.uri ? `[^${index}]: [${item.web.title ?? item.web.uri}](${item.web.uri})` : ''
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
