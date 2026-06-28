import type { OpenAICompatibleReasoningProtocol } from '../types'

type ReasoningEffort =
    | 'none'
    | 'minimal'
    | 'low'
    | 'medium'
    | 'high'
    | 'xhigh'
    | 'max'

export function applyReasoningProtocol(
    protocol: OpenAICompatibleReasoningProtocol,
    body: Record<string, unknown>,
    model: string
) {
    if (protocol === 'openai') return

    const effort = body.reasoning_effort
    if (effort == null) return

    delete body.reasoning_effort

    if (protocol === 'deepseek') {
        applyDeepSeekReasoning(body, effort)
        return
    }

    if (protocol === 'qwen') {
        applyQwenReasoning(body, effort)
        return
    }

    if (protocol === 'gemini') {
        applyGeminiReasoning(body, model, effort)
        return
    }

    if (protocol === 'anthropic') {
        applyAnthropicReasoning(body, effort)
        return
    }

    if (protocol === 'openrouter') {
        applyOpenRouterReasoning(body, effort)
    }
}

export function resolveReasoningProtocol(
    configured: OpenAICompatibleReasoningProtocol | undefined,
    model: string
): OpenAICompatibleReasoningProtocol {
    if (configured == null || configured === 'openai') return 'openai'
    if (configured !== 'auto') return configured

    const lower = model.toLowerCase()
    if (lower.includes('deepseek')) return 'deepseek'
    if (lower.includes('qwen') || lower.includes('qwq')) return 'qwen'
    if (lower.includes('gemini') || lower.includes('gemma')) return 'gemini'
    if (lower.includes('claude')) return 'anthropic'
    return 'openai'
}

export function normalizeDeepSeekReasoningEffort(effort: unknown) {
    const normalized = normalizeReasoningEffort(effort)
    if (normalized === 'none') return undefined
    if (normalized === 'max' || normalized === 'xhigh' || normalized === 'high') {
        return normalized === 'xhigh' ? 'max' : normalized
    }
    return 'high'
}

export function qwenThinkingBudgetForEffort(effort: unknown) {
    const normalized = normalizeReasoningEffort(effort)
    if (normalized === 'none') return 0
    if (normalized === 'minimal') return 512
    if (normalized === 'low') return 1024
    if (normalized === 'medium') return 4096
    if (normalized === 'high') return 8192
    if (normalized === 'xhigh' || normalized === 'max') return 16384
}

export function geminiThinkingConfig(model: string, effort: unknown) {
    if (isGemini3CompatibleModel(model)) {
        return {
            thinking_level: geminiThinkingLevel(effort),
            ...(normalizeReasoningEffort(effort) === 'none'
                ? { include_thoughts: false }
                : {})
        }
    }

    return {
        thinking_budget: geminiThinkingBudget(effort)
    }
}

export function anthropicThinkingConfig(effort: unknown) {
    const normalized = normalizeReasoningEffort(effort)
    if (normalized === 'none') return { type: 'disabled' }
    if (normalized == null) return undefined

    return {
        type: 'adaptive',
        display: 'summarized'
    }
}

function applyDeepSeekReasoning(
    body: Record<string, unknown>,
    effort: unknown
) {
    const reasoningEffort = normalizeDeepSeekReasoningEffort(effort)
    if (reasoningEffort == null) {
        body.thinking = { type: 'disabled' }
        return
    }
    body.thinking = mergeObject(body.thinking, {
        type: 'enabled',
        reasoning_effort: reasoningEffort
    })
}

function applyQwenReasoning(body: Record<string, unknown>, effort: unknown) {
    const normalized = normalizeReasoningEffort(effort)
    body.enable_thinking = normalized !== 'none'
    const thinkingBudget = qwenThinkingBudgetForEffort(normalized)
    if (thinkingBudget != null) body.thinking_budget = thinkingBudget
}

function applyGeminiReasoning(
    body: Record<string, unknown>,
    model: string,
    effort: unknown
) {
    body.extra_body = mergeObject(body.extra_body, {
        google: {
            thinking_config: geminiThinkingConfig(model, effort)
        }
    })
}

function applyAnthropicReasoning(
    body: Record<string, unknown>,
    effort: unknown
) {
    const normalized = normalizeReasoningEffort(effort)
    const thinking = anthropicThinkingConfig(effort)
    if (thinking == null) return
    body.thinking = mergeObject(body.thinking, thinking)
    if (normalized != null && normalized !== 'none') {
        body.output_config = mergeObject(body.output_config, {
            effort: normalized
        })
    }
}

function applyOpenRouterReasoning(
    body: Record<string, unknown>,
    effort: unknown
) {
    const normalized = normalizeReasoningEffort(effort)
    if (normalized == null) return

    body.reasoning = mergeObject(body.reasoning, { effort: normalized })
}

function normalizeReasoningEffort(value: unknown): ReasoningEffort | undefined {
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

function isGemini3CompatibleModel(model: string) {
    return model.toLowerCase().includes('gemini-3')
}

function geminiThinkingBudget(effort: unknown) {
    const normalized = normalizeReasoningEffort(effort)
    if (normalized === 'none') return 0
    if (normalized === 'minimal') return 128
    if (normalized === 'low') return 1024
    if (normalized === 'medium') return 8192
    if (normalized === 'high' || normalized === 'xhigh' || normalized === 'max') {
        return 24576
    }
    return -1
}

function geminiThinkingLevel(effort: unknown) {
    const normalized = normalizeReasoningEffort(effort)
    if (normalized === 'none' || normalized === 'minimal' || normalized === 'low') {
        return 'low'
    }
    if (normalized === 'medium') return 'medium'
    return 'high'
}

function mergeObject(current: unknown, extra: Record<string, unknown>) {
    const object =
        current != null && typeof current === 'object' && !Array.isArray(current)
            ? { ...(current as Record<string, unknown>) }
            : {}

    for (const [key, value] of Object.entries(extra)) {
        if (
            value != null &&
            typeof value === 'object' &&
            !Array.isArray(value) &&
            object[key] != null &&
            typeof object[key] === 'object' &&
            !Array.isArray(object[key])
        ) {
            object[key] = mergeObject(object[key], value as Record<string, unknown>)
            continue
        }
        object[key] = value
    }
    return object
}
