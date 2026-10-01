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
import type {
    OpenAICompatibleReasoningProtocol,
    ProviderModelEntry,
    ProviderPreset,
    ReasoningEffortLevel
} from '../types'
import {
    anthropicSupportedEfforts,
    nativeReasoningEfforts
} from './reasoning-protocols'

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
    supports_audio_in?: boolean
    supports_file_in?: boolean
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

type AnthropicModelObject = {
    id?: string
    display_name?: string
    max_input_tokens?: number
    max_tokens?: number
    context_length?: number
    capabilities?: {
        image_input?: boolean | { supported?: boolean }
        pdf_input?: boolean | { supported?: boolean }
        tool_use?: boolean | { supported?: boolean }
        tools?: boolean | { supported?: boolean }
        thinking?: boolean | { supported?: boolean; effort?: string[] }
        effort?: boolean | { supported?: boolean; values?: string[] }
    }
    reasoning_effort?: boolean | string[]
    reasoning_efforts?: string[]
    supported_reasoning_efforts?: string[]
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

        const suffixes = reasoningVariantSuffixes(provider, base)
        if ((suffixes?.length ?? 0) < 1) continue

        for (const variant of expandReasoningEffortModelVariants(
            id,
            suffixes
        )) {
            pushUnique(result, seen, {
                name: variant,
                type: ModelType.llm,
                maxTokens: base.maxTokens,
                capabilityOverrides: base.capabilityOverrides,
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
    if (model.capabilityOverrides?.[ModelCapabilities.Thinking] === false)
        return false
    if (!provider?.reasoningEffort || provider.reasoningEffort === 'disabled') {
        return false
    }
    if (model.reasoningEfforts != null) {
        return model.reasoningEfforts.length > 0 && isChatModel(model)
    }
    if (model.capabilities?.includes(ModelCapabilities.Thinking)) {
        return isChatModel(model)
    }
    return modelSupportsReasoning(provider.id, model)
}

export function expandReasoningVariantsForProvider(
    provider: Pick<ProviderPreset, 'id' | 'reasoningEffort'> | undefined,
    models: ProviderModelEntry[],
    options: {
        reasoningProtocol?: OpenAICompatibleReasoningProtocol
    } = {}
) {
    const result: ProviderModelEntry[] = []
    const seen = new Set<string>()

    for (const model of models) {
        pushUnique(result, seen, model)

        if (model.reasoningVariantOf) continue
        if (!shouldExpandReasoningVariants(provider, model)) continue

        const suffixes = reasoningVariantSuffixes(
            provider,
            model,
            options.reasoningProtocol
        )
        if ((suffixes?.length ?? 0) < 1) continue

        for (const variant of expandReasoningEffortModelVariants(
            model.name,
            suffixes
        )) {
            pushUnique(result, seen, {
                name: variant,
                type: ModelType.llm,
                maxTokens: model.maxTokens,
                capabilityOverrides: model.capabilityOverrides,
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
            id.startsWith('gpt-5') ||
            id.startsWith('gpt-6')
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
    if (provider === 'anthropic') return false
    if (provider === 'siliconflow') {
        return (
            id.includes('deepseek-v4') ||
            (id.includes('deepseek') && id.includes('reason'))
        )
    }
    return nativeReasoningEfforts(id) != null
}

const DEEPSEEK_REASONING_SUFFIXES = [
    'non-thinking',
    'low-thinking',
    'high-thinking',
    'max-thinking'
] as const
const NO_REASONING_SUFFIXES = [] as const
const QWEN_REASONING_SUFFIXES = [
    'non-thinking',
    'minimal-thinking',
    'low-thinking',
    'medium-thinking',
    'high-thinking',
    'max-thinking'
] as const
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
const REASONING_EFFORT_SUFFIXES: Record<ReasoningEffortLevel, string> = {
    none: 'non-thinking',
    minimal: 'minimal-thinking',
    low: 'low-thinking',
    medium: 'medium-thinking',
    high: 'high-thinking',
    xhigh: 'xhigh-thinking',
    max: 'max-thinking'
}
const REASONING_EFFORT_ORDER: ReasoningEffortLevel[] = [
    'none',
    'minimal',
    'low',
    'medium',
    'high',
    'xhigh',
    'max'
]

function reasoningVariantSuffixes(
    provider: Pick<ProviderPreset, 'id'> | undefined,
    model: ProviderModelEntry,
    reasoningProtocol?: OpenAICompatibleReasoningProtocol
) {
    const id = model.name.toLowerCase()
    const protocol = resolveReasoningProtocol(reasoningProtocol, id)
    if (protocol === 'deepseek') {
        return DEEPSEEK_REASONING_SUFFIXES
    }
    if (protocol === 'qwen') {
        return QWEN_REASONING_SUFFIXES
    }
    if (protocol === 'gemini') {
        return geminiReasoningSuffixes(id)
    }
    if (protocol === 'anthropic') {
        return reasoningEffortSuffixes(
            model.reasoningEfforts ?? ['low', 'medium', 'high']
        )
    }

    if (provider?.id === 'deepseek' || id.includes('deepseek-v4')) {
        return DEEPSEEK_REASONING_SUFFIXES
    }
    if (provider?.id === 'qwen' && id.includes('qwen3')) {
        return QWEN_REASONING_SUFFIXES
    }
    if (model.reasoningEfforts != null) {
        return reasoningEffortSuffixes(model.reasoningEfforts)
    }
    const native = nativeReasoningEfforts(id)
    if (native) return reasoningEffortSuffixes(native)
    if (provider?.id === 'minimax' || id.includes('minimax-m')) {
        return NO_REASONING_SUFFIXES
    }
    if (provider?.id === 'anthropic' || id.includes('claude-')) return undefined
    if (id.includes('gemma-4')) return GEMMA_REASONING_SUFFIXES
    if (
        id.includes('gemini-2.5-flash') ||
        id.includes('gemini-flash-lite-latest')
    ) {
        return geminiReasoningSuffixes(id)
    }
    if (
        id.includes('gemini-2.5') ||
        id.includes('gemini-3') ||
        id.includes('gemini-pro-latest')
    ) {
        return geminiReasoningSuffixes(id)
    }
    return undefined
}

function resolveReasoningProtocol(
    protocol: OpenAICompatibleReasoningProtocol | undefined,
    model: string
) {
    if (!protocol || protocol === 'openai') return 'openai'
    if (protocol !== 'auto') return protocol
    if (model.includes('deepseek')) return 'deepseek'
    if (model.includes('qwen')) return 'qwen'
    if (model.includes('gemini') || model.includes('gemma')) return 'gemini'
    if (model.includes('claude')) return 'anthropic'
    return 'openai'
}

function geminiReasoningSuffixes(model: string) {
    return model.includes('gemini-3')
        ? GEMINI_REASONING_SUFFIXES
        : GEMINI_FLASH_REASONING_SUFFIXES
}

function reasoningEffortSuffixes(efforts: ReasoningEffortLevel[]) {
    const set = new Set(efforts)
    return REASONING_EFFORT_ORDER.filter((effort) => set.has(effort)).map(
        (effort) => REASONING_EFFORT_SUFFIXES[effort]
    )
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
                capabilities: isEmbedding ? [] : geminiCapabilities(name)
            } satisfies ProviderModelEntry
        })
        .filter(Boolean)
}

export function parseAnthropicModels(payload: unknown): ProviderModelEntry[] {
    const items = Array.isArray((payload as { data?: unknown }).data)
        ? ((payload as { data?: AnthropicModelObject[] }).data ?? [])
        : []
    return items
        .map((item) => {
            const name = item.id?.trim()
            if (!name) return undefined

            return {
                name,
                maxTokens:
                    item.max_input_tokens ??
                    item.context_length ??
                    item.max_tokens,
                type: ModelType.llm,
                reasoningEfforts: anthropicReasoningEfforts(item),
                capabilities: anthropicCapabilities(item),
                capabilityOverrides: anthropicCapabilityOverrides(item)
            } satisfies ProviderModelEntry
        })
        .filter(Boolean)
}

function geminiCapabilities(name: string) {
    const lower = name.toLowerCase()
    const result = new Set<ModelCapabilities>([ModelCapabilities.ToolCall])
    if (supportsGeminiMultimodalInput(lower)) {
        result.add(ModelCapabilities.ImageInput)
        result.add(ModelCapabilities.AudioInput)
        result.add(ModelCapabilities.VideoInput)
        result.add(ModelCapabilities.FileInput)
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

function supportsGeminiMultimodalInput(lower: string) {
    if (lower.includes('embedding')) return false
    if (lower.includes('image-generation')) return false
    return (
        lower.includes('vision') ||
        lower.includes('gemini-1.5') ||
        lower.includes('gemini-2') ||
        lower.includes('gemini-3') ||
        lower.includes('gemini-pro-latest') ||
        lower.includes('gemini-flash-latest') ||
        lower.includes('gemini-flash-lite-latest')
    )
}

function anthropicCapabilities(item: AnthropicModelObject) {
    const result = new Set<ModelCapabilities>([ModelCapabilities.ToolCall])
    const capabilities = item.capabilities
    const id = item.id?.toLowerCase() ?? ''
    const reasoningEfforts = anthropicReasoningEfforts(item)

    if (
        isCapabilitySupported(capabilities?.image_input) ||
        id.includes('sonnet') ||
        id.includes('opus') ||
        id.includes('haiku') ||
        id.includes('fable') ||
        id.includes('mythos')
    ) {
        result.add(ModelCapabilities.ImageInput)
    }
    if (
        isCapabilitySupported(capabilities?.pdf_input) ||
        id.includes('sonnet') ||
        id.includes('opus') ||
        id.includes('fable') ||
        id.includes('mythos')
    ) {
        result.add(ModelCapabilities.FileInput)
    }
    if (
        isCapabilitySupported(capabilities?.thinking) ||
        isCapabilitySupported(capabilities?.effort) ||
        reasoningEfforts != null
    ) {
        result.add(ModelCapabilities.Thinking)
    }
    if (
        capabilities != null &&
        (isCapabilitySupported(capabilities.tool_use) ||
            isCapabilitySupported(capabilities.tools))
    ) {
        result.add(ModelCapabilities.ToolCall)
    }

    return [...result]
}

function anthropicReasoningEfforts(
    item: AnthropicModelObject
): ReasoningEffortLevel[] | undefined {
    const capabilities = item.capabilities
    const values = [
        ...capabilityEffortValues(capabilities?.thinking),
        ...capabilityEffortValues(capabilities?.effort),
        ...arrayOf(item.reasoning_effort),
        ...(item.reasoning_efforts ?? []),
        ...(item.supported_reasoning_efforts ?? [])
    ]
        .map(normalizeReasoningEffort)
        .filter((value): value is ReasoningEffortLevel => value != null)

    if (values.length > 0) return [...new Set(values)]

    const fallback = anthropicFallbackReasoningEfforts(item.id ?? '')
    if (fallback) return fallback

    if (
        isCapabilitySupported(capabilities?.thinking) ||
        isCapabilitySupported(capabilities?.effort) ||
        item.reasoning_effort === true
    ) {
        return ['low', 'medium', 'high']
    }
}

function anthropicFallbackReasoningEfforts(
    model: string
): ReasoningEffortLevel[] | undefined {
    return anthropicSupportedEfforts(model)
}

function capabilityEffortValues(value: unknown): unknown[] {
    if (Array.isArray(value)) return value
    if (value == null || typeof value !== 'object') return []

    const object = value as Record<string, unknown>
    return [
        ...arrayOf(object.effort),
        ...arrayOf(object.values),
        ...arrayOf(object.levels),
        ...arrayOf(object.supported_values)
    ]
}

function arrayOf(value: unknown) {
    return Array.isArray(value) ? value : []
}

function normalizeReasoningEffort(
    value: unknown
): ReasoningEffortLevel | undefined {
    if (typeof value !== 'string') return undefined
    const normalized = value
        .trim()
        .toLowerCase()
        .replace(/[-_\s]*thinking$/, '')

    if (normalized === 'tiny') return 'minimal'
    if (
        normalized === 'none' ||
        normalized === 'minimal' ||
        normalized === 'low' ||
        normalized === 'medium' ||
        normalized === 'high' ||
        normalized === 'xhigh' ||
        normalized === 'max'
    ) {
        return normalized
    }
}

function isCapabilitySupported(value: unknown) {
    if (typeof value === 'boolean') return value
    if (value != null && typeof value === 'object') {
        return (value as { supported?: unknown }).supported === true
    }
    return false
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
        capabilities: openAICapabilities(item),
        capabilityOverrides: openAICapabilityOverrides(item)
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
    if (isRerankerModelName(lower)) return ModelType.reranker
    if (isEmbeddingModelName(lower)) return ModelType.embeddings
    return undefined
}

function isEmbeddingModelName(lower: string) {
    return (
        isEmbeddingModel(lower) ||
        lower.includes('gte') ||
        lower.includes('text2vec') ||
        lower.includes('e5-') ||
        lower.includes('e5_') ||
        lower.includes('/e5')
    )
}

function isRerankerModelName(lower: string) {
    return isRerankerModel(lower) || lower.includes('ranker')
}

function openAICapabilityOverrides(
    item: OpenAIModelObject
): ProviderModelEntry['capabilityOverrides'] {
    const result: NonNullable<ProviderModelEntry['capabilityOverrides']> = {}
    const input = item.architecture?.input_modalities ?? item.modalities
    if (Array.isArray(input)) {
        const modalities = new Set(input.map((value) => value.toLowerCase()))
        result[ModelCapabilities.ImageInput] = modalities.has('image')
        result[ModelCapabilities.AudioInput] = modalities.has('audio')
        result[ModelCapabilities.VideoInput] = modalities.has('video')
        result[ModelCapabilities.FileInput] =
            modalities.has('file') || modalities.has('pdf')
    }
    const output = item.architecture?.output_modalities
    if (Array.isArray(output))
        result[ModelCapabilities.ImageGeneration] = output.some(
            (modality) => modality.toLowerCase() === 'image'
        )
    if (Array.isArray(item.supported_parameters)) {
        result[ModelCapabilities.ToolCall] = item.supported_parameters.some(
            (p) => p === 'tools' || p === 'tool_choice'
        )
        if (
            item.supported_parameters.some(
                (p) => p === 'reasoning' || p === 'reasoning_effort'
            )
        ) {
            result[ModelCapabilities.Thinking] = true
        }
    }
    for (const [cap, value] of [
        [ModelCapabilities.ToolCall, item.tool_call],
        [ModelCapabilities.Thinking, item.supports_reasoning ?? item.reasoning],
        [ModelCapabilities.ImageInput, item.supports_image_in],
        [ModelCapabilities.AudioInput, item.supports_audio_in],
        [ModelCapabilities.VideoInput, item.supports_video_in],
        [ModelCapabilities.FileInput, item.supports_file_in]
    ] as [ModelCapabilities, boolean | undefined][]) {
        if (typeof value === 'boolean') result[cap] = value
    }
    return result
}

function anthropicCapabilityOverrides(
    item: AnthropicModelObject
): ProviderModelEntry['capabilityOverrides'] {
    const result: NonNullable<ProviderModelEntry['capabilityOverrides']> = {}
    for (const [cap, value] of [
        [ModelCapabilities.ImageInput, item.capabilities?.image_input],
        [ModelCapabilities.FileInput, item.capabilities?.pdf_input],
        [
            ModelCapabilities.ToolCall,
            item.capabilities?.tool_use ?? item.capabilities?.tools
        ],
        [ModelCapabilities.Thinking, item.capabilities?.thinking]
    ] as const) {
        const supported = typeof value === 'boolean' ? value : value?.supported
        if (typeof supported === 'boolean') result[cap] = supported
    }
    return result
}

function openAICapabilities(item: OpenAIModelObject) {
    const result = new Set<ModelCapabilities>()
    const input = new Set(
        [
            ...(item.architecture?.input_modalities ?? []),
            ...(item.modalities ?? [])
        ].map((value) => value.toLowerCase())
    )
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
