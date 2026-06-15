import { expandReasoningEffortModelVariants } from '@chatluna/v1-shared-adapter'
import type { ProviderModelEntry } from '../types'

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
    modalities?: string[]
    reasoning?: boolean
    tool_call?: boolean
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

export function parseOpenAIModels(payload: unknown): ProviderModelEntry[] {
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

        for (const variant of expandReasoningEffortModelVariants(id)) {
            pushUnique(result, seen, {
                name: variant,
                maxTokens: base.maxTokens,
                capabilities: base.capabilities
            })
        }
    }

    return result
}

export function parseGeminiModels(payload: unknown): ProviderModelEntry[] {
    const items = Array.isArray((payload as { models?: unknown }).models)
        ? ((payload as { models?: GeminiModelObject[] }).models ?? [])
        : []
    return items
        .map((item) => {
            const name = item.name?.replace(/^models\//, '').trim()
            if (!name) return undefined
            return {
                name,
                maxTokens:
                    item.inputTokenLimit ??
                    item.metadata?.inputTokenLimit ??
                    item.outputTokenLimit ??
                    item.metadata?.outputTokenLimit
            } satisfies ProviderModelEntry
        })
        .filter(Boolean)
}

function makeOpenAIEntry(
    id: string,
    item: OpenAIModelObject
): ProviderModelEntry {
    return {
        name: id,
        maxTokens:
            item.context_length ??
            item.max_context_length ??
            item.input_token_limit ??
            item.limit?.context ??
            item.limit?.input ??
            item.token_limit
    }
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
