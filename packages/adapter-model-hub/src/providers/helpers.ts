import {
    ModelCapabilities,
    ModelType
} from 'koishi-plugin-chatluna/llm-core/platform/types'
import type { ProviderModelPreset, ProviderPreset } from '../types'

export const DEFAULT_ICON_CDN =
    'https://cdn.jsdelivr.net/npm/@lobehub/icons-static-svg@latest/icons'

export const tool = ModelCapabilities.ToolCall
export const image = ModelCapabilities.ImageInput
export const audio = ModelCapabilities.AudioInput
export const thinking = ModelCapabilities.Thinking
export const video = ModelCapabilities.VideoInput
export const file = ModelCapabilities.FileInput

export function llm(
    name: string,
    maxTokens: number,
    capabilities: readonly ModelCapabilities[] = [tool]
): ProviderModelPreset {
    return {
        name,
        type: ModelType.llm,
        maxTokens,
        capabilities
    }
}

export function embedding(
    name: string,
    maxTokens: number
): ProviderModelPreset {
    return {
        name,
        type: ModelType.embeddings,
        maxTokens,
        capabilities: []
    }
}

export function reranker(
    name: string,
    maxTokens: number
): ProviderModelPreset {
    return {
        name,
        type: ModelType.reranker,
        maxTokens,
        capabilities: []
    }
}

export function openAIChatProvider(
    preset: Omit<ProviderPreset, 'adapter'>
): ProviderPreset {
    return {
        ...preset,
        adapter: 'openai-chat'
    }
}

export function openAIProvider(
    preset: Omit<ProviderPreset, 'adapter'>
): ProviderPreset {
    return {
        ...preset,
        adapter: 'openai'
    }
}

export function geminiProvider(
    preset: Omit<ProviderPreset, 'adapter'>
): ProviderPreset {
    return {
        ...preset,
        adapter: 'gemini'
    }
}
