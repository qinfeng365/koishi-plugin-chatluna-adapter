import type { ProviderAdapterId } from '../types'
import type { ProviderAdapter } from './types'
import { openAIChatAdapter } from './openai-chat'
import { openAIAdapter } from './openai'
import { geminiAdapter } from './gemini'

const adapters = new Map<ProviderAdapterId, ProviderAdapter>([
    [openAIChatAdapter.id, openAIChatAdapter],
    [openAIAdapter.id, openAIAdapter],
    [geminiAdapter.id, geminiAdapter]
])

export function getProviderAdapter(id: ProviderAdapterId): ProviderAdapter {
    return adapters.get(id) ?? openAIChatAdapter
}

export { geminiAdapter, openAIAdapter, openAIChatAdapter }
export type { ProviderAdapter }
