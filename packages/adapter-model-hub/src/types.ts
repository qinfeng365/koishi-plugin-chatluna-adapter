import type { ClientConfig } from 'koishi-plugin-chatluna/llm-core/platform/config'
import type {
    ModelCapabilities,
    ModelType
} from 'koishi-plugin-chatluna/llm-core/platform/types'
import type { ChatLunaPlugin } from 'koishi-plugin-chatluna/services/chat'
import type { ModelHubClient } from './client'

export type ProviderAdapterId =
    | 'openai-chat'
    | 'openai'
    | 'gemini'
    | 'dify'
    | 'anthropic'

export type ModelHubProviderStatus =
    | 'loaded'
    | 'partial'
    | 'configured'
    | 'missing-key'
    | 'disabled'
    | 'error'
    | 'preset'

export interface ModelHubKoishiConfig {
    webui: boolean
    iconCdn: string
    settingsPath: string
    frontendMode?: 'performance' | 'polished'
    metadataUrl?: string
    metadataCachePath?: string
    metadataUpdateHours?: number
}

export interface AdditionalModelEntry {
    target: string
    model: string
    modelType: string
    modelCapabilities: ModelCapabilities[]
    contextSize: number
}

export interface ModelFilterEntry {
    target: string
    keyword: string
}

export interface HeaderEntry {
    id?: string
    target: string
    name: string
    value: string
}

export interface ProviderAdvancedSettings {
    customHeaders: HeaderEntry[]
    chatConcurrentMaxSize: number
    chatTimeLimit: number
    configMode: 'default' | 'balance'
    maxRetries: number
    timeout: number
    proxyMode: 'system' | 'off' | 'on'
    proxyAddress: string
    maxContextRatio: number
    temperature: number
    presencePenalty: number
    frequencyPenalty: number
    nonStreaming: boolean
    expandReasoningVariants: boolean
    nonLlmInputTokenLimit: number
}

export type OpenAICompatibleReasoningProtocol =
    | 'openai'
    | 'deepseek'
    | 'qwen'
    | 'gemini'
    | 'anthropic'
    | 'openrouter'
    | 'auto'

export interface OpenAICompatibleProviderSettings {
    reasoningProtocol?: OpenAICompatibleReasoningProtocol
}

export type OpenAIResponseBuiltinToolType =
    | 'web_search'
    | 'x_search'
    | 'web_search_preview'
    | 'image_generation'
    | 'code_interpreter'
    | 'file_search'

export interface OpenAIProviderSettings {
    promptCacheMode?: 'default' | 'implicit' | 'explicit'
    promptCacheTtl?: '5m' | '30m' | '1h'
    promptCacheRetention?: 'in-memory' | '24h'
    promptCacheKey?: string
    responseApi?: boolean
    responseBuiltinTools?: OpenAIResponseBuiltinToolType[]
    responseBuiltinToolSupportModel?: string[]
    responseFileSearchVectorStoreIds?: string[]
}

export interface GeminiProviderSettings {
    geminiApi?: 'generateContent' | 'interactions'
    geminiFileUpload?: boolean
    geminiMaxFileSizeMb?: number
    geminiCachedContent?: string
    geminiResponseMimeType?: string
    geminiResponseJsonSchema?: Record<string, unknown>
    agenticVideo?: boolean
    useCamelCaseMediaFields?: boolean
    googleSearch?: boolean
    codeExecution?: boolean
    urlContext?: boolean
    imageGeneration?: boolean
    thinkingBudget?: number
    includeThoughts?: boolean
    groundingContentDisplay?: boolean
}

export type AnthropicPromptCacheTtl = '5m' | '1h'

export interface AnthropicProviderSettings {
    anthropicPromptCache?: boolean
    anthropicPromptCacheTtl?: AnthropicPromptCacheTtl
}

export type DifyAppType = 'chat' | 'agent' | 'workflow' | 'completion'

export interface DifyProviderSettings {
    difyAppType?: DifyAppType
    difyModelName?: string
    difyWorkflowId?: string
    difyOutputVariable?: string
    difyEnableFileUpload?: boolean
    difyContextSize?: number
}

export interface DifyInputControl {
    variable: string
    type: string
    required?: boolean
    defaultValue?: unknown
}

export interface DifyFileHandlingLimits {
    supportedMimeTypes: string[]
    maxTotalSizeBytes: number
    maxFileSizeBytes: number
    maxFileSizeBytesOverrides?: Record<string, number>
    maxFileCount?: number
    allowedFileTypes?: DifyFileType[]
    allowedTransferMethods?: DifyTransferMethod[]
}

export type DifyFileType = 'image' | 'document' | 'audio' | 'video' | 'custom'
export type DifyTransferMethod = 'remote_url' | 'local_file'

export interface DifyAppParameters {
    inputControls: DifyInputControl[]
    fileHandling?: DifyFileHandlingLimits
}

export interface DifyRuntimeAppConfig {
    connectionScope?: string
    apiKey: string
    apiEndpoint: string
    platform: string
    providerName: string
    modelName: string
    appType: DifyAppType
    workflowId?: string
    outputVariable?: string
    enableFileUpload: boolean
    contextSize: number
    parameters?: DifyAppParameters
}

export interface ModelHubSettings {
    schemaVersion?: number
    revision?: number
    providers: ProviderEntry[]
    additionalModels: AdditionalModelEntry[]
    blacklistModels: ModelFilterEntry[]
}

export interface ProviderEntry
    extends
        ProviderAdvancedSettings,
        OpenAICompatibleProviderSettings,
        OpenAIProviderSettings,
        GeminiProviderSettings,
        AnthropicProviderSettings,
        DifyProviderSettings {
    id?: string
    sources?: SourceConnection[]
    routes?: ModelRoute[]
    provider: string
    name?: string
    platform: string
    apiKey: string
    apiEndpoint: string
    enabled: boolean
    pullModels: boolean
}

export interface ConsoleProviderEntry extends Omit<
    ProviderEntry,
    'apiKey' | 'customHeaders' | 'sources'
> {
    sources?: ConsoleSourceConnection[]
    apiKey: string
    apiKeyPreview: string
    hasApiKey: boolean
    clearApiKey?: boolean
    customHeaders: ConsoleHeaderEntry[]
}

export type ConnectionSettings = ProviderAdvancedSettings &
    OpenAICompatibleProviderSettings &
    OpenAIProviderSettings &
    GeminiProviderSettings &
    AnthropicProviderSettings &
    DifyProviderSettings

export interface SourceConnection {
    resourceCredentialId?: string
    resourceCredentialGeneration?: number
    id: string
    name: string
    provider: string
    apiEndpoint: string
    enabled: boolean
    pullModels: boolean
    priority: number
    weight: number
    settings: Partial<ConnectionSettings>
    credentials: SourceCredential[]
}

export interface SourceCredential {
    id: string
    name: string
    apiKey: string
    enabled: boolean
    generation: number
    organization?: string
    project?: string
    quotaGroup?: string
    concurrentMaxSize?: number
    hourlyLimit?: number
}

export interface ConsoleSourceCredential extends Omit<
    SourceCredential,
    'apiKey'
> {
    apiKey: string
    hasApiKey: boolean
    apiKeyPreview: string
    secretAction?: 'keep' | 'replace' | 'clear'
}

export interface ConsoleSourceConnection extends Omit<
    SourceConnection,
    'credentials' | 'settings'
> {
    credentials: ConsoleSourceCredential[]
    settings: Omit<Partial<ConnectionSettings>, 'customHeaders'> & {
        customHeaders?: ConsoleHeaderEntry[]
    }
}

export interface ModelRouteCandidate {
    sourceId: string
    credentialIds?: string[]
    upstreamModel: string
    /** Required for cross-source embeddings; same dimension alone is insufficient. */
    embeddingSpace?: string
}

export interface ModelRoute {
    model: string
    candidates: ModelRouteCandidate[]
    allowFallback: boolean
    capabilities?: ModelCapabilities[]
    modelType?: 'llm' | 'embeddings' | 'reranker'
    contextSize?: number
}

export interface ConsoleHeaderEntry extends Omit<HeaderEntry, 'value'> {
    value: string
    valuePreview: string
    hasValue: boolean
    clearValue?: boolean
}

export interface ModelHubConsoleSettings extends Omit<
    ModelHubSettings,
    'providers'
> {
    providers: ConsoleProviderEntry[]
}

export type ModelHubResolvedConfig = ModelHubKoishiConfig &
    ModelHubSettings &
    ProviderAdvancedSettings &
    OpenAICompatibleProviderSettings &
    OpenAIProviderSettings &
    GeminiProviderSettings &
    AnthropicProviderSettings &
    DifyProviderSettings &
    ChatLunaPlugin.Config

export interface ProviderModelPreset {
    name: string
    type: ModelType
    maxTokens: number
    capabilities: readonly ModelCapabilities[]
}

export type ReasoningEffortLevel =
    | 'none'
    | 'minimal'
    | 'low'
    | 'medium'
    | 'high'
    | 'xhigh'
    | 'max'

export interface ProviderModelEntry {
    name: string
    type?: ModelType
    maxTokens?: number
    capabilities?: ModelCapabilities[]
    /** Explicit API/catalog declarations take precedence over name heuristics. */
    capabilityOverrides?: Partial<Record<ModelCapabilities, boolean>>
    reasoningEfforts?: ReasoningEffortLevel[]
    reasoningVariantOf?: string
}

export interface ProviderPreset {
    id: string
    name: string
    icon: string
    kind: 'cloud' | 'local'
    adapter: ProviderAdapterId
    defaultPlatform: string
    defaultEndpoint: string
    website: string
    allowEmptyApiKey?: boolean
    reasoningEffort?: 'passthrough' | 'deepseek' | 'qwen' | 'disabled'
    models: readonly ProviderModelPreset[]
    patchCompletionBody?: (body: Record<string, unknown>, model: string) => void
    patchEmbeddingsBody?: (body: Record<string, unknown>, model: string) => void
    patchRerankBody?: (body: Record<string, unknown>, model: string) => void
}

export interface RuntimeProviderEntry extends ProviderEntry {
    resourceCredentialId?: string
    resourceCredentialGeneration?: number
    sourceId?: string
    credentialId?: string
    credentialGeneration?: number
    sourcePriority?: number
    sourceWeight?: number
    quotaGroup?: string
    credentialConcurrentMaxSize?: number
    credentialHourlyLimit?: number
    organization?: string
    project?: string
    provider: string
    providerName: string
    icon: string
    platform: string
    apiEndpoint: string
    configIndex?: number
}

export interface RuntimeProvider {
    provider: ProviderPreset
    adapter: ProviderAdapterId
    platform: string
    configSignature?: string
    entries: RuntimeProviderEntry[]
}

export interface ModelHubClientConfig
    extends
        ClientConfig,
        ProviderAdvancedSettings,
        OpenAICompatibleProviderSettings,
        OpenAIProviderSettings,
        GeminiProviderSettings,
        AnthropicProviderSettings,
        DifyProviderSettings {
    resourceCredentialId?: string
    resourceCredentialGeneration?: number
    sourceId?: string
    credentialId?: string
    credentialGeneration?: number
    sourcePriority?: number
    sourceWeight?: number
    quotaGroup?: string
    credentialConcurrentMaxSize?: number
    credentialHourlyLimit?: number
    organization?: string
    project?: string
    provider: string
    providerName: string
    icon: string
    pullModels: boolean
    difyApps?: Record<string, DifyRuntimeAppConfig>
}

export type ModelHubPlugin = ChatLunaPlugin<
    ModelHubClientConfig,
    ModelHubResolvedConfig
>

export interface ModelHubRuntimeState {
    providers: RuntimeProvider[]
    clients: Map<string, ModelHubClient>
    errors: Map<string, string>
    plugins: Map<string, ModelHubPlugin>
    revision: number
}

export interface ModelHubConsoleProvider {
    id: string
    name: string
    icon: string
    platform: string
    endpoint: string
    website: string
    enabled: boolean
    configured: boolean
    pullModels: boolean
    status: ModelHubProviderStatus
    modelCount: number
    modelsUpdatedAt?: number
    error?: string
    connections?: ConnectionStatus[]
}

export interface ConnectionStatus {
    sourceId: string
    credentialId: string
    state: 'ready' | 'stale' | 'error' | 'cooldown' | 'disabled'
    updatedAt?: number
    retryAt?: number
    modelCount: number
    error?: string
}

export interface ModelHubConsoleModel {
    platform: string
    provider: string
    providerId?: string
    name: string
    type: keyof typeof ModelType | string
    maxTokens: number
    capabilities: ModelCapabilities[]
    source: 'api' | 'custom'
    reasoningVariantOf?: string
    lastUsedAt?: number
    candidates?: {
        sourceId: string
        credentialId: string
        upstreamModel: string
        sourceName?: string
        credentialName?: string
        capabilities?: ModelCapabilities[]
        available?: boolean
    }[]
}

export interface ModelHubConsolePreset {
    id: string
    name: string
    icon: string
    kind: 'cloud' | 'local'
    adapter: ProviderAdapterId
    defaultPlatform: string
    defaultEndpoint: string
    website: string
    allowEmptyApiKey: boolean
    modelCount: number
}

export interface ModelHubConsoleData {
    iconCdn: string
    settingsPath: string
    revision: number
    settings: ModelHubConsoleSettings
    providers: ModelHubConsoleProvider[]
    models: ModelHubConsoleModel[]
    presets: ModelHubConsolePreset[]
    totals: {
        configured: number
        loaded: number
        models: number
        presets: number
    }
    frontendMode?: 'performance' | 'polished'
}

export interface ModelHubActionResult {
    success: boolean
    message?: string
    models?: number
    errors?: Record<string, string>
}
