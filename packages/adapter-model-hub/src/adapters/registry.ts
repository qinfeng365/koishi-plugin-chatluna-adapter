import type { ProviderAdapterId } from '../types'
import type { ProviderAdapter } from './types'
import { openAIChatAdapter } from './openai-chat'
import { openAIAdapter } from './openai'
import { geminiAdapter } from './gemini'
import { difyAdapter } from './dify'
import { anthropicAdapter } from './anthropic'

const adapters = new Map<ProviderAdapterId, ProviderAdapter>([
    [openAIChatAdapter.id, openAIChatAdapter],
    [openAIAdapter.id, openAIAdapter],
    [geminiAdapter.id, geminiAdapter],
    [difyAdapter.id, difyAdapter],
    [anthropicAdapter.id, anthropicAdapter]
])

export function getProviderAdapter(id: ProviderAdapterId): ProviderAdapter {
    return adapters.get(id) ?? openAIChatAdapter
}

export {
    anthropicAdapter,
    difyAdapter,
    geminiAdapter,
    openAIAdapter,
    openAIChatAdapter
}
export type { ProviderAdapter }
