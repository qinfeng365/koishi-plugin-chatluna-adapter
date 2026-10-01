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
    if (protocol === 'openai') {
        validateNativeReasoningEffort(body, model)
        return
    }

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
        applyAnthropicReasoning(body, model, effort)
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
    if (normalized === 'none' || normalized === 'max') return normalized
    if (normalized === 'minimal' || normalized === 'low') return 'low'
    if (normalized != null) return 'high'
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

export function anthropicThinkingConfig(
    effort: unknown,
    model = '',
    maxTokens = 4096
) {
    const normalized = normalizeReasoningEffort(effort)
    const alwaysThinking = /opus[-.]5[-.]5/.test(model.toLowerCase())
    if (normalized === 'none') {
        if (alwaysThinking)
            throw new Error(`${model} does not support disabling thinking`)
        return { type: 'disabled' }
    }
    if (normalized == null && !alwaysThinking) return undefined
    if (!supportsAdaptiveThinking(model)) {
        return {
            type: 'enabled',
            budget_tokens: Math.min(
                Math.max(1024, qwenThinkingBudgetForEffort(normalized) ?? 4096),
                Math.max(1024, maxTokens - 1024),
                maxTokens - 1
            )
        }
    }

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
    if (reasoningEffort == null)
        throw new Error(`Unsupported DeepSeek effort: ${effort}`)
    body.reasoning_effort = reasoningEffort
    body.thinking = mergeObject(body.thinking, {
        type: reasoningEffort === 'none' ? 'disabled' : 'enabled'
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
    model: string,
    effort: unknown
) {
    const normalized = anthropicEffortForModel(model, effort)
    const thinking = anthropicThinkingConfig(
        effort,
        model,
        Number(body.max_tokens ?? 4096)
    )
    if (thinking == null) return
    body.thinking = mergeObject(body.thinking, thinking)
    if (normalized != null) {
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

export function normalizeReasoningEffort(
    value: unknown
): ReasoningEffort | undefined {
    if (typeof value !== 'string') return undefined
    const normalized = value
        .trim()
        .toLowerCase()
        .replace(/[-_\s]*thinking$/, '')

    if (normalized === 'tiny') return 'minimal'
    if (normalized === 'ultra') return 'max'
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

export function supportsAdaptiveThinking(model: string) {
    return /claude-(?:(?:opus|sonnet)[-.](?:4[-.][6-9]|[5-9])|(?:fable|mythos)[-.](?:[5-9]|preview))/.test(
        model.toLowerCase()
    )
}

export function anthropicSupportedEfforts(
    model: string
): Exclude<ReasoningEffort, 'none' | 'minimal'>[] | undefined {
    const lower = model.toLowerCase()
    if (/claude-opus[-.]4[-.]5/.test(lower)) return ['low', 'medium', 'high']
    if (!supportsAdaptiveThinking(lower)) return undefined
    const levels: Exclude<ReasoningEffort, 'none' | 'minimal'>[] = [
        'low',
        'medium',
        'high',
        'max'
    ]
    if (!/(?:opus|sonnet)[-.]4[-.]6|mythos[-.]preview/.test(lower))
        levels.splice(3, 0, 'xhigh')
    return levels
}

/** Only emit output_config.effort on model families whose API supports it. */
export function anthropicEffortForModel(model: string, effort: unknown) {
    const value = normalizeReasoningEffort(effort)
    if (value == null || value === 'none') return undefined
    const lower = model.toLowerCase()
    const supported = anthropicSupportedEfforts(lower)
    if (!supported) return undefined
    if (value === 'minimal') return 'low'
    if (!supported.includes(value))
        throw new Error(`${model} does not support effort ${value}`)
    return value
}

export function nativeReasoningEfforts(
    model: string
): ReasoningEffort[] | undefined {
    const lower = model.toLowerCase()
    if (lower.startsWith('gpt-6'))
        return ['low', 'medium', 'high', 'xhigh', 'max']
    if (lower.includes('kimi-k3') || /glm-5\.3/.test(lower))
        return ['low', 'high', 'max']
    if (lower.includes('minimax-m3.1'))
        return ['low', 'medium', 'high', 'xhigh', 'max']
    if (lower.includes('step-5')) return ['low', 'medium', 'high']
    if (lower.includes('step-3.5-flash-2603')) return ['low', 'high']
}

export function validateNativeReasoningEffort(
    body: Record<string, unknown>,
    model: string
) {
    const supported = nativeReasoningEfforts(model)
    if (
        supported &&
        body.reasoning_effort != null &&
        !supported.includes(body.reasoning_effort as ReasoningEffort)
    ) {
        throw new Error(
            `${model} supports reasoning_effort: ${supported.join(', ')}`
        )
    }
    if (model.toLowerCase().includes('kimi-k3')) delete body.thinking
    if (
        supported &&
        !supported.includes('none') &&
        (body.thinking as { type?: string })?.type === 'disabled'
    ) {
        throw new Error(`${model} does not support disabling thinking`)
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
    if (
        normalized === 'high' ||
        normalized === 'xhigh' ||
        normalized === 'max'
    ) {
        return 24576
    }
    return -1
}

function geminiThinkingLevel(effort: unknown) {
    const normalized = normalizeReasoningEffort(effort)
    if (
        normalized === 'none' ||
        normalized === 'minimal' ||
        normalized === 'low'
    ) {
        return 'low'
    }
    if (normalized === 'medium') return 'medium'
    return 'high'
}

function mergeObject(current: unknown, extra: Record<string, unknown>) {
    const object =
        current != null &&
        typeof current === 'object' &&
        !Array.isArray(current)
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
            object[key] = mergeObject(
                object[key],
                value as Record<string, unknown>
            )
            continue
        }
        object[key] = value
    }
    return object
}
