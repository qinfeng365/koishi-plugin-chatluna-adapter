import {
    copyFile,
    mkdir,
    readFile,
    rename,
    unlink,
    writeFile
} from 'fs/promises'
import { randomUUID } from 'crypto'
import { dirname, isAbsolute, resolve } from 'path'
import type { Context } from 'koishi'
import { ModelCapabilities } from 'koishi-plugin-chatluna/llm-core/platform/types'
import {
    DEFAULT_PROVIDER_CONFIGS,
    getProviderPreset,
    normalizeId,
    normalizePlatformName,
    resolveRuntimeProviders,
    targetMatches
} from './providers'
import type {
    AdditionalModelEntry,
    AnthropicPromptCacheTtl,
    ConsoleHeaderEntry,
    ConsoleProviderEntry,
    HeaderEntry,
    ModelFilterEntry,
    ModelHubConsoleSettings,
    ModelHubKoishiConfig,
    ModelHubResolvedConfig,
    ModelHubSettings,
    OpenAICompatibleReasoningProtocol,
    OpenAIResponseBuiltinToolType,
    ProviderAdvancedSettings,
    ProviderEntry
} from './types'
import {
    maskSources,
    normalizeSources,
    normalizeRoutes
} from './source-settings'

export const DEFAULT_SETTINGS_PATH = 'data/chatluna-model-hub/config.json'

export const DEFAULT_PROVIDER_ADVANCED_SETTINGS: ProviderAdvancedSettings = {
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
    expandReasoningVariants: false,
    nonLlmInputTokenLimit: 8192
}

const DEFAULT_RESPONSE_BUILTIN_TOOL_SUPPORT_MODELS = [
    'gpt-4o',
    'gpt-4.1',
    'gpt-5',
    'gpt-6',
    'o3',
    'o4'
]

export const DEFAULT_MODEL_HUB_SETTINGS: ModelHubSettings = {
    providers: [],
    additionalModels: [],
    blacklistModels: []
}

export class ModelHubSettingsStore {
    readonly path: string
    readonly legacyPath: string

    constructor(ctx: Context, settingsPath: string | undefined) {
        this.legacyPath = resolveSettingsPath(ctx, settingsPath)
        // An older binary must not overwrite the only copy of the new schema.
        this.path = `${this.legacyPath}.v2`
    }

    async load(legacy?: unknown): Promise<ModelHubSettings> {
        try {
            const raw = await readFile(this.path, 'utf8')
            return normalizeSettings(JSON.parse(raw))
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
                throw error
            }
        }

        try {
            const raw = await readFile(this.legacyPath, 'utf8')
            const settings = normalizeSettings(JSON.parse(raw))
            await copyFile(
                this.legacyPath,
                `${this.legacyPath}.pre-v2.bak`,
                1
            ).catch((error) => {
                if (error.code !== 'EEXIST') throw error
            })
            await this.save(settings)
            return settings
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
        }

        const migrated = pickLegacySettings(legacy)
        const settings = normalizeSettings(migrated ?? {})
        await this.save(settings)
        return settings
    }

    async save(settings: ModelHubSettings) {
        await mkdir(dirname(this.path), { recursive: true })
        const temp = `${this.path}.${randomUUID()}.tmp`
        try {
            await writeFile(
                temp,
                `${JSON.stringify(normalizeSettings(settings), null, 2)}\n`,
                { encoding: 'utf8', mode: 0o600, flag: 'wx' }
            )
            await rename(temp, this.path)
        } finally {
            await unlink(temp).catch(() => {})
        }
    }
}

export function resolveSettingsPath(
    ctx: Context,
    settingsPath: string | undefined
) {
    const value = (settingsPath || DEFAULT_SETTINGS_PATH).trim()
    return isAbsolute(value) ? value : resolve(ctx.baseDir, value)
}

export function createResolvedConfig(
    config: ModelHubKoishiConfig,
    settings: ModelHubSettings,
    advanced: ProviderAdvancedSettings = DEFAULT_PROVIDER_ADVANCED_SETTINGS
): ModelHubResolvedConfig {
    return {
        ...settings,
        ...advanced,
        ...config
    } as ModelHubResolvedConfig
}

export function toConsoleSettings(
    settings: ModelHubSettings
): ModelHubConsoleSettings {
    return {
        ...cloneSettings(settings),
        providers: settings.providers.map((provider) => ({
            ...provider,
            apiKey: '',
            apiKeyPreview: previewSecret(provider.apiKey),
            hasApiKey: provider.apiKey.trim().length > 0,
            clearApiKey: false,
            customHeaders: provider.customHeaders.map((header) =>
                toConsoleHeader(header)
            ),
            sources: maskSources(
                provider.sources ?? [],
                previewSecret,
                toConsoleHeader
            )
        }))
    }
}

export function normalizeSettings(
    input: unknown,
    previous?: ModelHubSettings
): ModelHubSettings {
    const value = isRecord(input) ? input : {}
    const legacyAdvanced = normalizeProviderAdvanced(value)
    if (Number(value.schemaVersion) > 2)
        throw new Error('配置版本高于当前插件，请升级插件')
    let providers = arrayOf(value.providers).map((entry) =>
        normalizeProvider(entry, previous, legacyAdvanced)
    )
    if (
        value.schemaVersion !== 2 &&
        providers.every((entry) => !entry.sources)
    ) {
        const groups = resolveRuntimeProviders(providers)
        const consumed = new Set<number>()
        const migrated: ProviderEntry[] = []
        for (const group of groups) {
            const first = providers[group.entries[0].configIndex!]
            const sources: ProviderEntry['sources'] = [
                {
                    id: randomUUID(),
                    name: '默认连接',
                    provider: first.provider,
                    apiEndpoint: first.apiEndpoint,
                    enabled: true,
                    pullModels: first.pullModels,
                    priority: 0,
                    weight: 1,
                    settings: {},
                    credentials: group.entries.map((entry, index) => {
                        consumed.add(entry.configIndex!)
                        return {
                            id: randomUUID(),
                            name: `Key ${index + 1}`,
                            apiKey: entry.apiKey,
                            enabled: true,
                            generation: 1
                        }
                    })
                }
            ]
            if (group.adapter === 'dify') {
                const names = new Map<string, number>()
                sources.splice(
                    0,
                    sources.length,
                    ...group.entries.map((entry) => {
                        const base =
                            entry.difyModelName?.trim() ||
                            entry.providerName ||
                            entry.platform
                        const n = names.get(base) ?? 0
                        names.set(base, n + 1)
                        return {
                            id: randomUUID(),
                            name: entry.providerName,
                            provider: entry.provider,
                            apiEndpoint: entry.apiEndpoint,
                            enabled: true,
                            pullModels: true,
                            priority: 0,
                            weight: 1,
                            settings: {
                                ...normalizeProviderAdvanced(entry),
                                ...normalizeProviderSpecific(
                                    entry as unknown as Record<string, unknown>,
                                    undefined,
                                    'dify'
                                ),
                                difyModelName:
                                    n === 0 ? base : `${base}-${n + 1}`
                            },
                            credentials: [
                                {
                                    id: randomUUID(),
                                    name: 'Key 1',
                                    apiKey: entry.apiKey,
                                    enabled: true,
                                    generation: 1
                                }
                            ]
                        }
                    })
                )
            }
            migrated.push({ ...first, platform: group.platform, sources })
        }
        providers.forEach((entry, index) => {
            if (!consumed.has(index)) migrated.push(entry)
        })
        providers = migrated
    }
    const platforms = new Set<string>()
    const ids = new Set<string>()
    providers = providers.map((entry) => {
        if (platforms.has(entry.platform)) {
            if (value.schemaVersion === 2)
                throw new Error(`重复平台入口：${entry.platform}`)
            const base = entry.platform
            let n = 2
            while (platforms.has(entry.platform))
                entry.platform = `${base}-${n++}`
        }
        platforms.add(entry.platform)
        const old = previous?.providers.find((item) => item.id === entry.id)
        const rawSources = entry.sources
        entry.sources = normalizeSources(
            entry,
            old,
            previous,
            ids,
            (input, prior) => {
                const specific = normalizeProviderSpecific(
                    input,
                    prior as ProviderEntry,
                    String(input.provider ?? entry.provider)
                )
                const full = {
                    ...normalizeProviderAdvanced(
                        input,
                        previous
                            ? ({
                                  ...prior,
                                  customHeaders:
                                      prior?.customHeaders ??
                                      entry.customHeaders
                              } as ProviderEntry)
                            : undefined
                    ),
                    ...specific
                }
                const keys =
                    input.provider !== entry.provider
                        ? [...Object.keys(specific), ...Object.keys(input)]
                        : Object.keys(input)
                return Object.fromEntries(
                    [...new Set(keys)]
                        .filter((key) => key in full)
                        .map((key) => [key, full[key]])
                )
            }
        )
        entry.routes = normalizeRoutes(
            entry.routes?.map((route) => ({
                ...route,
                candidates: route.candidates.map((candidate) => {
                    const index =
                        rawSources?.findIndex(
                            (source) => source.id === candidate.sourceId
                        ) ?? -1
                    if (index < 0) return candidate
                    return {
                        ...candidate,
                        sourceId: entry.sources[index].id,
                        credentialIds: candidate.credentialIds?.map((id) => {
                            const ci = rawSources[index].credentials.findIndex(
                                (c) => c.id === id
                            )
                            return ci < 0
                                ? id
                                : entry.sources[index].credentials[ci].id
                        })
                    }
                })
            })),
            entry.sources
        )
        // Retain legacy fields for API compatibility, with the primary connection as authority.
        entry.apiKey = entry.sources[0]?.credentials[0]?.apiKey ?? ''
        entry.apiEndpoint = entry.sources[0]?.apiEndpoint ?? entry.apiEndpoint
        return entry
    })
    return {
        schemaVersion: 2,
        revision: Math.max(0, Number(value.revision) || 0),
        providers,
        additionalModels: arrayOf(value.additionalModels).map(
            normalizeAdditionalModel
        ),
        blacklistModels: arrayOf(value.blacklistModels).map(normalizeFilter)
    }
}

function normalizeProviderAdvanced(
    input: unknown,
    previous?: ProviderEntry,
    fallback: ProviderAdvancedSettings = DEFAULT_PROVIDER_ADVANCED_SETTINGS
): ProviderAdvancedSettings {
    const value = isRecord(input) ? input : {}
    const merged = {
        ...fallback,
        ...previous,
        ...value
    }
    const headerSource =
        value.customHeaders === undefined
            ? (previous?.customHeaders ?? fallback.customHeaders)
            : value.customHeaders

    return {
        customHeaders: arrayOf(headerSource).map((entry) =>
            normalizeHeader(entry, previous?.customHeaders)
        ),
        chatConcurrentMaxSize: clampNumber(
            merged.chatConcurrentMaxSize,
            3,
            1,
            8
        ),
        chatTimeLimit: clampNumber(merged.chatTimeLimit, 200, 1, 2000),
        configMode: merged.configMode === 'balance' ? 'balance' : 'default',
        maxRetries: clampNumber(merged.maxRetries, 5, 0, 6),
        timeout: clampNumber(merged.timeout, 300_000, 1000),
        proxyMode:
            merged.proxyMode === 'on' || merged.proxyMode === 'off'
                ? merged.proxyMode
                : 'system',
        proxyAddress: stringOf(merged.proxyAddress),
        maxContextRatio: clampNumber(merged.maxContextRatio, 0.35, 0, 1),
        temperature: clampNumber(merged.temperature, 1, 0, 2),
        presencePenalty: clampNumber(merged.presencePenalty, 0, -2, 2),
        frequencyPenalty: clampNumber(merged.frequencyPenalty, 0, -2, 2),
        nonStreaming: merged.nonStreaming === true,
        expandReasoningVariants: merged.expandReasoningVariants === true,
        nonLlmInputTokenLimit: clampNumber(
            merged.nonLlmInputTokenLimit,
            8192,
            1
        )
    }
}

function cloneSettings(settings: ModelHubSettings): ModelHubSettings {
    return {
        ...settings,
        providers: settings.providers.map((item) => cloneProvider(item)),
        additionalModels: settings.additionalModels.map((item) => ({
            ...item,
            modelCapabilities: [...item.modelCapabilities]
        })),
        blacklistModels: settings.blacklistModels.map((item) => ({ ...item }))
    }
}

function cloneProvider(provider: ProviderEntry): ProviderEntry {
    return structuredClone(provider)
}

function normalizeProvider(
    input: unknown,
    previous?: ModelHubSettings,
    legacyAdvanced: ProviderAdvancedSettings = DEFAULT_PROVIDER_ADVANCED_SETTINGS
): ProviderEntry {
    const value = isRecord(input) ? input : {}
    const preset = getProviderPreset(stringOf(value.provider, 'openai'))
    const platform = normalizePlatformName(
        stringOf(value.platform),
        preset.defaultPlatform
    )
    const previousEntry =
        typeof value.id === 'string'
            ? previous?.providers.find((entry) => entry.id === value.id)
            : previous?.schemaVersion === 2
              ? undefined
              : findPreviousProvider(previous, preset.id, platform)
    const consoleValue = value as Partial<ConsoleProviderEntry>
    const nextKey = stringOf(value.apiKey).trim()
    const providerAdvanced = normalizeProviderAdvanced(
        value,
        previousEntry,
        legacyAdvanced
    )
    if (value.customHeaders === undefined && previousEntry == null) {
        providerAdvanced.customHeaders = providerAdvanced.customHeaders
            .filter((header) =>
                targetMatches(header.target, platform, preset.id)
            )
            .map((header) => ({ ...header, target: '*' }))
    }

    return {
        ...providerAdvanced,
        ...normalizeProviderSpecific(value, previousEntry, preset.id),
        id:
            previousEntry?.id ??
            (previous
                ? randomUUID()
                : stringOf(value.id).trim() || randomUUID()),
        sources: Array.isArray(value.sources)
            ? (value.sources as ProviderEntry['sources'])
            : undefined,
        routes: Array.isArray(value.routes)
            ? (value.routes as ProviderEntry['routes'])
            : [],
        provider: preset.id,
        name: stringOf(value.name).trim() || undefined,
        platform,
        apiKey:
            consoleValue.clearApiKey === true
                ? ''
                : nextKey || previousEntry?.apiKey || '',
        apiEndpoint: stringOf(value.apiEndpoint, preset.defaultEndpoint).trim(),
        enabled: value.enabled !== false,
        pullModels: value.pullModels !== false
    }
}

function enumOf<T extends string>(
    value: unknown,
    choices: readonly T[],
    fallback: T
): T {
    return choices.includes(value as T) ? (value as T) : fallback
}

function jsonObject(value: unknown): Record<string, unknown> | undefined {
    if (value == null) return undefined
    if (typeof value !== 'object' || Array.isArray(value))
        throw new Error('JSON Schema must be an object')
    return structuredClone(value as Record<string, unknown>)
}

function normalizeProviderSpecific(
    input: Record<string, unknown>,
    previous: ProviderEntry | undefined,
    provider: string
): Partial<ProviderEntry> {
    const cache = {
        promptCacheMode: enumOf(
            input.promptCacheMode ?? previous?.promptCacheMode,
            ['default', 'implicit', 'explicit'] as const,
            'default'
        ),
        promptCacheTtl: enumOf(
            input.promptCacheTtl ?? previous?.promptCacheTtl,
            ['5m', '30m', '1h'] as const,
            provider === 'moonshot' ? '5m' : '30m'
        ),
        promptCacheRetention:
            input.promptCacheRetention == null
                ? previous?.promptCacheRetention
                : enumOf(
                      input.promptCacheRetention,
                      ['24h', 'in-memory'] as const,
                      'in-memory'
                  ),
        promptCacheKey: stringOf(
            input.promptCacheKey ?? previous?.promptCacheKey,
            ''
        )
    }
    if (provider === 'openai' || provider === 'xai') {
        return {
            ...cache,
            reasoningProtocol: normalizeReasoningProtocol(
                input.reasoningProtocol ?? previous?.reasoningProtocol,
                defaultReasoningProtocol(provider)
            ),
            responseApi:
                booleanOrUndefined(input.responseApi) ??
                previous?.responseApi ??
                provider === 'xai',
            responseBuiltinTools: arrayOf(
                input.responseBuiltinTools ??
                    previous?.responseBuiltinTools ??
                    []
            ).filter(isResponseBuiltinTool),
            responseBuiltinToolSupportModel: stringArrayOf(
                input.responseBuiltinToolSupportModel ??
                    previous?.responseBuiltinToolSupportModel,
                provider === 'xai'
                    ? ['grok']
                    : DEFAULT_RESPONSE_BUILTIN_TOOL_SUPPORT_MODELS
            ),
            responseFileSearchVectorStoreIds: stringArrayOf(
                input.responseFileSearchVectorStoreIds ??
                    previous?.responseFileSearchVectorStoreIds,
                []
            )
        }
    }

    if (isOpenAICompatibleProvider(provider)) {
        return {
            ...cache,
            reasoningProtocol: normalizeReasoningProtocol(
                input.reasoningProtocol ?? previous?.reasoningProtocol,
                defaultReasoningProtocol(provider)
            )
        }
    }

    if (provider === 'gemini') {
        return {
            geminiApi: enumOf(
                input.geminiApi ?? previous?.geminiApi,
                ['generateContent', 'interactions'] as const,
                'generateContent'
            ),
            geminiFileUpload:
                booleanOrUndefined(input.geminiFileUpload) ??
                previous?.geminiFileUpload ??
                false,
            geminiMaxFileSizeMb: clampNumber(
                input.geminiMaxFileSizeMb ?? previous?.geminiMaxFileSizeMb,
                64,
                1,
                2048
            ),
            geminiCachedContent: stringOf(
                input.geminiCachedContent ?? previous?.geminiCachedContent,
                ''
            ),
            geminiResponseMimeType: stringOf(
                input.geminiResponseMimeType ??
                    previous?.geminiResponseMimeType,
                ''
            ),
            geminiResponseJsonSchema: jsonObject(
                input.geminiResponseJsonSchema ??
                    previous?.geminiResponseJsonSchema
            ),
            agenticVideo:
                booleanOrUndefined(input.agenticVideo) ??
                previous?.agenticVideo ??
                false,
            useCamelCaseMediaFields:
                booleanOrUndefined(input.useCamelCaseMediaFields) ??
                previous?.useCamelCaseMediaFields ??
                false,
            googleSearch:
                booleanOrUndefined(input.googleSearch) ??
                previous?.googleSearch ??
                false,
            codeExecution:
                booleanOrUndefined(input.codeExecution) ??
                previous?.codeExecution ??
                false,
            urlContext:
                booleanOrUndefined(input.urlContext) ??
                previous?.urlContext ??
                false,
            imageGeneration:
                booleanOrUndefined(input.imageGeneration) ??
                previous?.imageGeneration ??
                false,
            thinkingBudget: clampNumber(
                input.thinkingBudget ?? previous?.thinkingBudget,
                -1,
                -1,
                24576
            ),
            includeThoughts:
                booleanOrUndefined(input.includeThoughts) ??
                previous?.includeThoughts ??
                false,
            groundingContentDisplay:
                booleanOrUndefined(input.groundingContentDisplay) ??
                previous?.groundingContentDisplay ??
                false
        }
    }

    if (provider === 'anthropic') {
        return {
            anthropicPromptCache:
                booleanOrUndefined(input.anthropicPromptCache) ??
                previous?.anthropicPromptCache ??
                false,
            anthropicPromptCacheTtl: normalizeAnthropicPromptCacheTtl(
                input.anthropicPromptCacheTtl ??
                    previous?.anthropicPromptCacheTtl
            )
        }
    }

    if (provider === 'dify') {
        return {
            difyAppType: normalizeDifyAppType(
                input.difyAppType ?? previous?.difyAppType
            ),
            difyModelName: stringOf(
                input.difyModelName,
                previous?.difyModelName
            ).trim(),
            difyWorkflowId: stringOf(
                input.difyWorkflowId,
                previous?.difyWorkflowId
            ).trim(),
            difyOutputVariable: stringOf(
                input.difyOutputVariable,
                previous?.difyOutputVariable
            ).trim(),
            difyEnableFileUpload:
                booleanOrUndefined(input.difyEnableFileUpload) ??
                previous?.difyEnableFileUpload ??
                true,
            difyContextSize: clampNumber(
                input.difyContextSize ?? previous?.difyContextSize,
                128_000,
                1
            )
        }
    }

    return {}
}

function normalizeAdditionalModel(input: unknown): AdditionalModelEntry {
    const value = isRecord(input) ? input : {}
    const capabilities = new Set(Object.values(ModelCapabilities))

    return {
        target: stringOf(value.target, '*'),
        model: stringOf(value.model).trim(),
        modelType: stringOf(value.modelType, 'LLM 大语言模型'),
        modelCapabilities: stringArrayOf(value.modelCapabilities, [
            ModelCapabilities.TextInput,
            ModelCapabilities.ToolCall
        ]).filter((item): item is ModelCapabilities =>
            capabilities.has(item as ModelCapabilities)
        ),
        contextSize: clampNumber(value.contextSize, 128_000, 1)
    }
}

function normalizeFilter(input: unknown): ModelFilterEntry {
    const value = isRecord(input) ? input : {}

    return {
        target: stringOf(value.target, '*'),
        keyword: stringOf(value.keyword).trim()
    }
}

function normalizeHeader(
    input: unknown,
    previous?: readonly HeaderEntry[]
): HeaderEntry {
    const value = isRecord(input) ? input : {}
    const target = stringOf(value.target, '*')
    const name = stringOf(value.name).trim()
    const previousEntry =
        typeof value.id === 'string'
            ? previous?.find((item) => item.id === value.id)
            : previous?.some((item) => item.id)
              ? undefined
              : previous?.find(
                    (item) =>
                        normalizeId(item.target, '*') ===
                            normalizeId(target, '*') &&
                        item.name.toLowerCase() === name.toLowerCase()
                )
    const consoleValue = value as Partial<ConsoleHeaderEntry>
    const nextValue = stringOf(value.value)

    return {
        id:
            previousEntry?.id ??
            (previous ? randomUUID() : stringOf(value.id) || randomUUID()),
        target,
        name,
        value:
            consoleValue.clearValue === true
                ? ''
                : nextValue || previousEntry?.value || ''
    }
}

function toConsoleHeader(header: HeaderEntry): ConsoleHeaderEntry {
    return {
        ...header,
        value: '',
        valuePreview: previewSecret(header.value),
        hasValue: header.value.trim().length > 0,
        clearValue: false
    }
}

function findPreviousProvider(
    previous: ModelHubSettings | undefined,
    provider: string,
    platform: string
) {
    if (!previous) return undefined
    return (
        previous.providers.find(
            (entry) =>
                normalizeId(entry.provider) === normalizeId(provider) &&
                normalizeId(entry.platform) === normalizeId(platform)
        ) ??
        previous.providers.find(
            (entry) => normalizeId(entry.platform) === normalizeId(platform)
        )
    )
}

function pickLegacySettings(input: unknown): Partial<ModelHubSettings> | null {
    if (!isRecord(input)) return null

    const result: Partial<ModelHubSettings> = {}
    const providers = arrayOf(input.providers).filter(
        isMeaningfulLegacyProvider
    )
    if (providers.length > 0) {
        result.providers = providers.map((provider) => ({
            ...(provider as Record<string, unknown>)
        })) as unknown as ProviderEntry[]
    }

    for (const key of [
        'additionalModels',
        'blacklistModels',
        'customHeaders',
        'chatConcurrentMaxSize',
        'chatTimeLimit',
        'configMode',
        'maxRetries',
        'timeout',
        'proxyMode',
        'proxyAddress',
        'maxContextRatio',
        'temperature',
        'presencePenalty',
        'frequencyPenalty',
        'nonStreaming',
        'expandReasoningVariants',
        'nonLlmInputTokenLimit'
    ] as const) {
        if (input[key] !== undefined) {
            ;(result as Record<string, unknown>)[key] = input[key]
        }
    }

    return Object.keys(result).length > 0 ? result : null
}

function isResponseBuiltinTool(
    value: unknown
): value is OpenAIResponseBuiltinToolType {
    return (
        value === 'web_search' ||
        value === 'x_search' ||
        value === 'web_search_preview' ||
        value === 'image_generation' ||
        value === 'code_interpreter' ||
        value === 'file_search'
    )
}

function booleanOrUndefined(value: unknown) {
    return typeof value === 'boolean' ? value : undefined
}

function normalizeDifyAppType(value: unknown) {
    return value === 'agent' || value === 'workflow' || value === 'completion'
        ? value
        : 'chat'
}

function normalizeAnthropicPromptCacheTtl(
    value: unknown
): AnthropicPromptCacheTtl {
    return value === '1h' ? '1h' : '5m'
}

function normalizeReasoningProtocol(
    value: unknown,
    fallback: OpenAICompatibleReasoningProtocol = 'openai'
): OpenAICompatibleReasoningProtocol {
    return value === 'deepseek' ||
        value === 'qwen' ||
        value === 'gemini' ||
        value === 'anthropic' ||
        value === 'openrouter' ||
        value === 'auto'
        ? value
        : fallback
}

function isOpenAICompatibleProvider(provider: string) {
    return (
        provider === 'openai-compatible' ||
        provider === 'newapi' ||
        provider === 'openrouter' ||
        provider === 'siliconflow' ||
        provider === 'modelscope'
    )
}

function defaultReasoningProtocol(
    provider: string
): OpenAICompatibleReasoningProtocol {
    if (provider === 'openrouter') return 'openrouter'
    if (provider === 'modelscope') return 'auto'
    return 'openai'
}

function isMeaningfulLegacyProvider(input: unknown) {
    if (!isRecord(input)) return false
    const provider = stringOf(input.provider)
    const preset = getProviderPreset(provider)
    if (stringOf(input.apiKey).trim()) return true
    if (preset.allowEmptyApiKey) return true

    const equivalentDefault = DEFAULT_PROVIDER_CONFIGS.some(
        (item) =>
            item.provider === preset.id &&
            normalizeId(item.platform) ===
                normalizeId(stringOf(input.platform, item.platform)) &&
            item.apiEndpoint ===
                stringOf(input.apiEndpoint, item.apiEndpoint).trim() &&
            input.enabled !== false
    )

    return !equivalentDefault
}

function previewSecret(value: string) {
    const secret = value?.trim()
    if (!secret) return ''
    if (secret.length <= 8) return '已保存'
    return `${secret.slice(0, 3)}...${secret.slice(-4)}`
}

function arrayOf(value: unknown): unknown[] {
    return Array.isArray(value) ? value : []
}

function stringArrayOf(value: unknown, fallback: readonly string[]) {
    const source = Array.isArray(value) ? value : fallback
    return source.map((item) => stringOf(item).trim()).filter(Boolean)
}

function stringOf(value: unknown, fallback = '') {
    return typeof value === 'string' ? value : fallback
}

function clampNumber(
    value: unknown,
    fallback: number,
    min = Number.NEGATIVE_INFINITY,
    max = Number.POSITIVE_INFINITY
) {
    const number = Number(value)
    if (!Number.isFinite(number)) return fallback
    return Math.min(max, Math.max(min, number))
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return value != null && typeof value === 'object' && !Array.isArray(value)
}
