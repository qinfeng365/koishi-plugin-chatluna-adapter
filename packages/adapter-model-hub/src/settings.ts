import { mkdir, readFile, writeFile } from 'fs/promises'
import { dirname, isAbsolute, resolve } from 'path'
import type { Context } from 'koishi'
import { ModelCapabilities } from 'koishi-plugin-chatluna/llm-core/platform/types'
import {
    DEFAULT_PROVIDER_CONFIGS,
    getProviderPreset,
    normalizeId,
    normalizePlatformName,
    targetMatches
} from './providers'
import type {
    AdditionalModelEntry,
    ConsoleHeaderEntry,
    ConsoleProviderEntry,
    HeaderEntry,
    ModelFilterEntry,
    ModelHubConsoleSettings,
    ModelHubKoishiConfig,
    ModelHubResolvedConfig,
    ModelHubSettings,
    OpenAIResponseBuiltinToolType,
    ProviderAdvancedSettings,
    ProviderEntry
} from './types'

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
    expandReasoningVariants: false
}

const DEFAULT_RESPONSE_BUILTIN_TOOL_SUPPORT_MODELS = [
    'gpt-4o',
    'gpt-4.1',
    'gpt-5',
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

    constructor(ctx: Context, settingsPath: string | undefined) {
        this.path = resolveSettingsPath(ctx, settingsPath)
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

        const migrated = pickLegacySettings(legacy)
        const settings = normalizeSettings(migrated ?? {})
        await this.save(settings)
        return settings
    }

    async save(settings: ModelHubSettings) {
        await mkdir(dirname(this.path), { recursive: true })
        await writeFile(
            this.path,
            `${JSON.stringify(normalizeSettings(settings), null, 2)}\n`,
            'utf8'
        )
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

    return {
        providers: arrayOf(value.providers).map((entry) =>
            normalizeProvider(entry, previous, legacyAdvanced)
        ),
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
        expandReasoningVariants: merged.expandReasoningVariants === true
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
    return {
        ...provider,
        customHeaders: provider.customHeaders.map((item) => ({ ...item }))
    }
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
    const previousEntry = findPreviousProvider(previous, preset.id, platform)
    const consoleValue = value as Partial<ConsoleProviderEntry>
    const nextKey = stringOf(value.apiKey).trim()
    const providerAdvanced = normalizeProviderAdvanced(
        value,
        previousEntry,
        legacyAdvanced
    )
    if (value.customHeaders === undefined && previousEntry == null) {
        providerAdvanced.customHeaders = providerAdvanced.customHeaders
            .filter((header) => targetMatches(header.target, platform, preset.id))
            .map((header) => ({ ...header, target: '*' }))
    }

    return {
        ...providerAdvanced,
        ...normalizeProviderSpecific(value, previousEntry, preset.id),
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

function normalizeProviderSpecific(
    input: Record<string, unknown>,
    previous: ProviderEntry | undefined,
    provider: string
): Partial<ProviderEntry> {
    if (provider === 'openai') {
        return {
            responseApi:
                booleanOrUndefined(input.responseApi) ??
                previous?.responseApi ??
                false,
            responseBuiltinTools: arrayOf(
                input.responseBuiltinTools ??
                    previous?.responseBuiltinTools ??
                    []
            ).filter(isResponseBuiltinTool),
            responseBuiltinToolSupportModel: stringArrayOf(
                input.responseBuiltinToolSupportModel ??
                    previous?.responseBuiltinToolSupportModel,
                DEFAULT_RESPONSE_BUILTIN_TOOL_SUPPORT_MODELS
            ),
            responseFileSearchVectorStoreIds: stringArrayOf(
                input.responseFileSearchVectorStoreIds ??
                    previous?.responseFileSearchVectorStoreIds,
                []
            )
        }
    }

    if (provider === 'gemini') {
        return {
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
    const previousEntry = previous?.find(
        (item) =>
            normalizeId(item.target, '*') === normalizeId(target, '*') &&
            item.name.toLowerCase() === name.toLowerCase()
    )
    const consoleValue = value as Partial<ConsoleHeaderEntry>
    const nextValue = stringOf(value.value)

    return {
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
    const providers = arrayOf(input.providers).filter(isMeaningfulLegacyProvider)
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
        'expandReasoningVariants'
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
        value === 'web_search_preview' ||
        value === 'image_generation' ||
        value === 'code_interpreter' ||
        value === 'file_search'
    )
}

function booleanOrUndefined(value: unknown) {
    return typeof value === 'boolean' ? value : undefined
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
