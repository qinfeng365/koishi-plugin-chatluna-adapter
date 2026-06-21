import type {
    AdditionalModelEntry,
    ModelFilterEntry,
    ProviderEntry,
    ProviderPreset,
    RuntimeProvider
} from '../types'
import openaiCompatible from './openai-compatible'
import openai from './openai'
import gemini from './gemini'
import openrouter from './openrouter'
import deepseek from './deepseek'
import qwen from './qwen'
import zhipu from './zhipu'
import moonshot from './moonshot'
import siliconflow from './siliconflow'
import groq from './groq'
import mistral from './mistral'
import together from './together'
import xai from './xai'
import minimax from './minimax'
import stepfun from './stepfun'
import yi from './yi'
import baichuan from './baichuan'
import newapi from './newapi'
import ollama from './ollama'
import lmstudio from './lmstudio'
import vllm from './vllm'
import llamacpp from './llamacpp'
import xinference from './xinference'
import localai from './localai'

export {
    DEFAULT_ICON_CDN,
    audio,
    embedding,
    file,
    geminiProvider,
    image,
    llm,
    openAIChatProvider,
    openAIProvider,
    reranker,
    thinking,
    tool,
    video
} from './helpers'

export const PROVIDER_PRESETS: readonly ProviderPreset[] = [
    openaiCompatible,
    openai,
    gemini,
    openrouter,
    deepseek,
    qwen,
    zhipu,
    moonshot,
    siliconflow,
    groq,
    mistral,
    together,
    xai,
    minimax,
    stepfun,
    yi,
    baichuan,
    newapi,
    ollama,
    lmstudio,
    vllm,
    llamacpp,
    xinference,
    localai
]

const providerMap = new Map(PROVIDER_PRESETS.map((item) => [item.id, item]))

export const DEFAULT_PROVIDER_CONFIGS: ProviderEntry[] = [
    'openai',
    'gemini',
    'openrouter',
    'deepseek',
    'qwen',
    'siliconflow',
    'groq'
].map((id): ProviderEntry => {
    const preset = getProviderPreset(id)
    return {
        provider: preset.id,
        platform: preset.defaultPlatform,
        apiKey: '',
        apiEndpoint: preset.defaultEndpoint,
        enabled: true,
        pullModels: true,
        customHeaders: [],
        chatConcurrentMaxSize: 3,
        chatTimeLimit: 200,
        configMode: 'default',
        maxRetries: 5,
        timeout: 300_000,
        proxyMode: 'system',
        proxyAddress: '',
        maxContextRatio: 0.35,
        temperature: 1,
        presencePenalty: 0,
        frequencyPenalty: 0,
        nonStreaming: false,
        expandReasoningVariants: false
    }
})

export function normalizeId(value: string | undefined, fallback = 'custom') {
    const normalized = (value ?? fallback)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, '-')
        .replace(/^-+|-+$/g, '')
    return normalized || fallback
}

export function normalizePlatformName(value: string | undefined, fallback: string) {
    return normalizeId(value, fallback)
}

export function getProviderPreset(id: string | undefined): ProviderPreset {
    const normalized = normalizeId(id)
    const preset = providerMap.get(normalized)
    if (preset) return preset

    return {
        id: normalized,
        name: id?.trim() || 'Custom Provider',
        icon: normalized,
        kind: 'cloud',
        adapter: 'openai-chat',
        defaultPlatform: `hub-${normalized}`,
        defaultEndpoint: '',
        website: '',
        models: []
    }
}

export function getEndpoint(entry: ProviderEntry, preset: ProviderPreset) {
    return (entry.apiEndpoint || preset.defaultEndpoint || '').trim()
}

export function targetMatches(target: string | undefined, platform: string, provider: string) {
    const normalized = normalizeId(target, '*')
    return (
        normalized === '*' ||
        normalized === normalizeId(platform) ||
        normalized === normalizeId(provider)
    )
}

export function resolveRuntimeProviders(
    entries: readonly ProviderEntry[] | undefined
): RuntimeProvider[] {
    const groups = new Map<string, RuntimeProvider>()

    for (const entry of entries ?? []) {
        const preset = getProviderPreset(entry.provider)
        const platform = normalizePlatformName(entry.platform, preset.defaultPlatform)
        const apiKey = entry.apiKey?.trim() ?? ''
        const apiEndpoint = getEndpoint(entry, preset)

        if (entry.enabled === false) continue
        if (apiKey.length < 1 && !preset.allowEmptyApiKey) continue
        if (apiEndpoint.length < 1) continue

        let group = groups.get(platform)
        if (group == null) {
            group = {
                provider: preset,
                adapter: preset.adapter,
                platform,
                entries: []
            }
            groups.set(platform, group)
        }

        group.entries.push({
            ...entry,
            apiKey,
            apiEndpoint,
            provider: preset.id,
            providerName: entry.name?.trim() || preset.name,
            icon: preset.icon,
            platform,
            enabled: true,
            pullModels: entry.pullModels === true
        })
    }

    return [...groups.values()]
}

export function getTargetedAdditionalModels(
    models: readonly AdditionalModelEntry[] | undefined,
    platform: string,
    provider: string
) {
    return (models ?? []).filter(
        (item) =>
            item.model?.trim().length > 0 &&
            targetMatches(item.target, platform, provider)
    )
}

export function getTargetedBlacklist(
    filters: readonly ModelFilterEntry[] | undefined,
    platform: string,
    provider: string
) {
    return (filters ?? [])
        .filter((item) => targetMatches(item.target, platform, provider))
        .map((item) => item.keyword?.trim().toLowerCase())
        .filter(Boolean)
}
