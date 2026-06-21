import {
    expandReasoningEffortModelVariants,
    isEmbeddingModel,
    isImageGenerationModel,
    isRerankerModel
} from '@chatluna/v1-shared-adapter'
import {
    ModelCapabilities,
    ModelType
} from 'koishi-plugin-chatluna/llm-core/platform/types'
import type { ProviderModelEntry, ProviderPreset } from '../types'

type OpenAIModelObject = {
    id?: string
    context_length?: number
    max_context_length?: number
    input_token_limit?: number
    output_token_limit?: number
    token_limit?: number
    limit?: {
        context?: number
        input?: number
        output?: number
    }
    top_provider?: {
        context_length?: number
        max_completion_tokens?: number
    }
    meta?: {
        n_ctx_train?: number
        n_ctx?: number
    }
    architecture?: {
        input_modalities?: string[]
        output_modalities?: string[]
    }
    modalities?: string[]
    supported_parameters?: string[]
    reasoning?: boolean
    supports_reasoning?: boolean
    tool_call?: boolean
    supports_image_in?: boolean
    supports_video_in?: boolean
    type?: string
}

type GeminiModelObject = {
    name?: string
    supportedGenerationMethods?: string[]
    inputTokenLimit?: number
    outputTokenLimit?: number
    embedding?: boolean
    batchEmbedContents?: boolean
    metadata?: {
        inputTokenLimit?: number
        outputTokenLimit?: number
    }
}

export function parseOpenAIModels(
    payload: unknown,
    provider?: Pick<ProviderPreset, 'id' | 'reasoningEffort'>
): ProviderModelEntry[] {
    const items = Array.isArray((payload as { data?: unknown }).data)
        ? ((payload as { data?: OpenAIModelObject[] }).data ?? [])
        : []
    const result: ProviderModelEntry[] = []
    const seen = new Set<string>()

    for (const item of items) {
        const id = item.id?.trim()
        if (!id) continue

        const base = makeOpenAIEntry(id, item)
        pushUnique(result, seen, base)

        if (!shouldExpandReasoningVariants(provider, base)) continue

        for (const variant of expandReasoningEffortModelVariants(
            id,
            reasoningVariantSuffixes(provider, id)
        )) {
            pushUnique(result, seen, {
                name: variant,
                type: ModelType.llm,
                maxTokens: base.maxTokens,
                capabilities: mergeCapabilities(base.capabilities, [
                    ModelCapabilities.Thinking
                ]),
                reasoningVariantOf: id
            })
        }
    }

    return result
}

function shouldExpandReasoningVariants(
    provider: Pick<ProviderPreset, 'id' | 'reasoningEffort'> | undefined,
    model: ProviderModelEntry
) {
    if (!provider?.reasoningEffort || provider.reasoningEffort === 'disabled') {
        return false
    }
    if (model.capabilities?.includes(ModelCapabilities.Thinking)) {
        return isChatModel(model)
    }
    return modelSupportsReasoning(provider.id, model)
}

export function expandReasoningVariantsForProvider(
    provider: Pick<ProviderPreset, 'id' | 'reasoningEffort'> | undefined,
    models: ProviderModelEntry[]
) {
    const result: ProviderModelEntry[] = []
    const seen = new Set<string>()

    for (const model of models) {
        pushUnique(result, seen, model)

        if (model.reasoningVariantOf) continue
        if (!shouldExpandReasoningVariants(provider, model)) continue

        for (const variant of expandReasoningEffortModelVariants(
            model.name,
            reasoningVariantSuffixes(provider, model.name)
        )) {
            pushUnique(result, seen, {
                name: variant,
                type: ModelType.llm,
                maxTokens: model.maxTokens,
                capabilities: mergeCapabilities(model.capabilities, [
                    ModelCapabilities.Thinking
                ]),
                reasoningVariantOf: model.name
            })
        }
    }

    return result
}

function isChatModel(model: ProviderModelEntry) {
    if (model.type != null) return model.type === ModelType.llm
    const lower = model.name.toLowerCase()
    return (
        !isEmbeddingModel(lower) &&
        !isRerankerModel(lower) &&
        !isImageGenerationModel(lower)
    )
}

function modelSupportsReasoning(provider: string, model: ProviderModelEntry) {
    const id = model.name.toLowerCase()
    if (provider === 'openai') {
        return (
            id.startsWith('o1') ||
            id.startsWith('o3') ||
            id.startsWith('o4') ||
            id.startsWith('gpt-5')
        )
    }
    if (provider === 'deepseek') {
        return (
            id.includes('reasoner') ||
            id.includes('r1') ||
            id.includes('deepseek-v4')
        )
    }
    if (provider === 'qwen') {
        return id.includes('qwen3')
    }
    if (provider === 'siliconflow') {
        return (
            id.includes('deepseek-v4') ||
            id.includes('deepseek') && id.includes('reason')
        )
    }
    return false
}

const DEEPSEEK_REASONING_SUFFIXES = ['high-thinking', 'max-thinking'] as const
const NO_REASONING_SUFFIXES = [] as const
const GEMINI_REASONING_SUFFIXES = [
    'minimal-thinking',
    'low-thinking',
    'medium-thinking',
    'high-thinking'
] as const
const GEMINI_FLASH_REASONING_SUFFIXES = [
    'non-thinking',
    ...GEMINI_REASONING_SUFFIXES
] as const
const GEMMA_REASONING_SUFFIXES = ['minimal-thinking', 'high-thinking'] as const

function reasoningVariantSuffixes(
    provider: Pick<ProviderPreset, 'id'> | undefined,
    model: string
) {
    const id = model.toLowerCase()
    if (provider?.id === 'deepseek' || id.includes('deepseek-v4')) {
        return DEEPSEEK_REASONING_SUFFIXES
    }
    if (provider?.id === 'minimax' || id.includes('minimax-m')) {
        return NO_REASONING_SUFFIXES
    }
    if (id.includes('gemma-4')) return GEMMA_REASONING_SUFFIXES
    if (
        id.includes('gemini-2.5-flash') ||
        id.includes('gemini-flash-lite-latest')
    ) {
        return GEMINI_FLASH_REASONING_SUFFIXES
    }
    if (
        id.includes('gemini-2.5') ||
        id.includes('gemini-3') ||
        id.includes('gemini-pro-latest')
    ) {
        return GEMINI_REASONING_SUFFIXES
    }
    return undefined
}

function mergeCapabilities(
    preferred: ModelCapabilities[] | undefined,
    extra: ModelCapabilities[]
) {
    return [...new Set([...(preferred ?? []), ...extra])]
}

export function parseGeminiModels(payload: unknown): ProviderModelEntry[] {
    const items = Array.isArray((payload as { models?: unknown }).models)
        ? ((payload as { models?: GeminiModelObject[] }).models ?? [])
        : []
    return items
        .map((item) => {
            const name = item.name?.replace(/^models\//, '').trim()
            if (!name) return undefined
            const methods = new Set(item.supportedGenerationMethods ?? [])
            const isEmbedding =
                item.embedding === true ||
                item.batchEmbedContents === true ||
                methods.has('embedContent') ||
                methods.has('batchEmbedContents')
            const isGenerative =
                methods.size < 1 ||
                methods.has('generateContent') ||
                methods.has('streamGenerateContent')
            if (!isGenerative && !isEmbedding) return undefined

            return {
                name,
                maxTokens:
                    item.inputTokenLimit ??
                    item.metadata?.inputTokenLimit ??
                    item.outputTokenLimit ??
                    item.metadata?.outputTokenLimit,
                type: isEmbedding ? ModelType.embeddings : undefined,
                capabilities: isEmbedding
                    ? []
                    : geminiCapabilities(name)
            } satisfies ProviderModelEntry
        })
        .filter(Boolean)
}

function geminiCapabilities(name: string) {
    const lower = name.toLowerCase()
    const result = new Set<ModelCapabilities>([ModelCapabilities.ToolCall])
    if (
        lower.includes('vision') ||
        lower.includes('gemini-1.5') ||
        lower.includes('gemini-2') ||
        lower.includes('gemini-3') ||
        lower.includes('gemini-pro-latest') ||
        lower.includes('gemini-flash-latest')
    ) {
        result.add(ModelCapabilities.ImageInput)
    }
    if (
        lower.includes('thinking') ||
        lower.includes('gemini-2.5') ||
        lower.includes('gemini-3') ||
        lower.includes('gemini-pro-latest') ||
        lower.includes('gemini-flash-latest') ||
        lower.includes('gemini-flash-lite-latest')
    ) {
        result.add(ModelCapabilities.Thinking)
    }
    if (lower.includes('image')) {
        result.add(ModelCapabilities.ImageGeneration)
    }
    return [...result]
}

function makeOpenAIEntry(
    id: string,
    item: OpenAIModelObject
): ProviderModelEntry {
    return {
        name: id,
        type: inferOpenAIModelType(id, item),
        maxTokens:
            item.context_length ??
            item.max_context_length ??
            item.input_token_limit ??
            item.limit?.context ??
            item.limit?.input ??
            item.token_limit ??
            item.top_provider?.context_length ??
            item.meta?.n_ctx_train ??
            item.meta?.n_ctx,
        capabilities: openAICapabilities(item)
    }
}

function inferOpenAIModelType(id: string, item: OpenAIModelObject) {
    const type = item.type?.toLowerCase()
    if (type === 'embedding' || type === 'embeddings') {
        return ModelType.embeddings
    }
    if (type === 'rerank' || type === 'reranker') {
        return ModelType.reranker
    }

    const lower = id.toLowerCase()
    if (isRerankerModel(lower)) return ModelType.reranker
    if (isEmbeddingModel(lower)) return ModelType.embeddings
    return undefined
}

function openAICapabilities(item: OpenAIModelObject) {
    const result = new Set<ModelCapabilities>()
    const input = new Set([
        ...(item.architecture?.input_modalities ?? []),
        ...(item.modalities ?? [])
    ].map((value) => value.toLowerCase()))
    const output = new Set(
        (item.architecture?.output_modalities ?? []).map((value) =>
            value.toLowerCase()
        )
    )
    const parameters = new Set(
        (item.supported_parameters ?? []).map((value) => value.toLowerCase())
    )

    if (
        item.tool_call === true ||
        parameters.has('tools') ||
        parameters.has('tool_choice')
    ) {
        result.add(ModelCapabilities.ToolCall)
    }
    if (
        item.reasoning === true ||
        item.supports_reasoning === true ||
        parameters.has('reasoning') ||
        parameters.has('reasoning_effort')
    ) {
        result.add(ModelCapabilities.Thinking)
    }
    if (input.has('image') || item.supports_image_in === true) {
        result.add(ModelCapabilities.ImageInput)
    }
    if (input.has('audio')) result.add(ModelCapabilities.AudioInput)
    if (input.has('video') || item.supports_video_in === true) {
        result.add(ModelCapabilities.VideoInput)
    }
    if (input.has('file') || input.has('pdf')) {
        result.add(ModelCapabilities.FileInput)
    }
    if (output.has('image')) result.add(ModelCapabilities.ImageGeneration)

    return result.size > 0 ? [...result] : undefined
}

function pushUnique(
    result: ProviderModelEntry[],
    seen: Set<string>,
    entry: ProviderModelEntry
) {
    const key = entry.name.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    result.push(entry)
}
