import type { ClientConfig } from 'koishi-plugin-chatluna/llm-core/platform/config';
import type { ModelCapabilities, ModelType } from 'koishi-plugin-chatluna/llm-core/platform/types';
import type { ChatLunaPlugin } from 'koishi-plugin-chatluna/services/chat';
import type { ModelHubClient } from './client';
export type ProviderAdapterId = 'openai-chat' | 'openai' | 'gemini';
export type ModelHubProviderStatus = 'loaded' | 'configured' | 'missing-key' | 'disabled' | 'error' | 'preset';
export interface ModelHubKoishiConfig {
    webui: boolean;
    iconCdn: string;
    settingsPath: string;
    frontendMode?: 'performance' | 'polished';
    metadataUrl?: string;
    metadataCachePath?: string;
    metadataUpdateHours?: number;
}
export interface AdditionalModelEntry {
    target: string;
    model: string;
    modelType: string;
    modelCapabilities: ModelCapabilities[];
    contextSize: number;
}
export interface ModelFilterEntry {
    target: string;
    keyword: string;
}
export interface HeaderEntry {
    target: string;
    name: string;
    value: string;
}
export interface ProviderAdvancedSettings {
    customHeaders: HeaderEntry[];
    chatConcurrentMaxSize: number;
    chatTimeLimit: number;
    configMode: 'default' | 'balance';
    maxRetries: number;
    timeout: number;
    proxyMode: 'system' | 'off' | 'on';
    proxyAddress: string;
    maxContextRatio: number;
    temperature: number;
    presencePenalty: number;
    frequencyPenalty: number;
    nonStreaming: boolean;
}
export type OpenAIResponseBuiltinToolType = 'web_search_preview' | 'image_generation' | 'code_interpreter' | 'file_search';
export interface OpenAIProviderSettings {
    responseApi?: boolean;
    responseBuiltinTools?: OpenAIResponseBuiltinToolType[];
    responseBuiltinToolSupportModel?: string[];
    responseFileSearchVectorStoreIds?: string[];
}
export interface GeminiProviderSettings {
    googleSearch?: boolean;
    codeExecution?: boolean;
    urlContext?: boolean;
    imageGeneration?: boolean;
    thinkingBudget?: number;
    includeThoughts?: boolean;
    groundingContentDisplay?: boolean;
}
export interface ModelHubSettings {
    providers: ProviderEntry[];
    additionalModels: AdditionalModelEntry[];
    blacklistModels: ModelFilterEntry[];
}
export interface ProviderEntry extends ProviderAdvancedSettings, OpenAIProviderSettings, GeminiProviderSettings {
    provider: string;
    name?: string;
    platform: string;
    apiKey: string;
    apiEndpoint: string;
    enabled: boolean;
    pullModels: boolean;
}
export interface ConsoleProviderEntry extends Omit<ProviderEntry, 'apiKey' | 'customHeaders'> {
    apiKey: string;
    apiKeyPreview: string;
    hasApiKey: boolean;
    clearApiKey?: boolean;
    customHeaders: ConsoleHeaderEntry[];
}
export interface ConsoleHeaderEntry extends Omit<HeaderEntry, 'value'> {
    value: string;
    valuePreview: string;
    hasValue: boolean;
    clearValue?: boolean;
}
export interface ModelHubConsoleSettings extends Omit<ModelHubSettings, 'providers'> {
    providers: ConsoleProviderEntry[];
}
export type ModelHubResolvedConfig = ModelHubKoishiConfig & ModelHubSettings & ProviderAdvancedSettings & OpenAIProviderSettings & GeminiProviderSettings & ChatLunaPlugin.Config;
export interface ProviderModelPreset {
    name: string;
    type: ModelType;
    maxTokens: number;
    capabilities: readonly ModelCapabilities[];
}
export interface ProviderModelEntry {
    name: string;
    maxTokens?: number;
    capabilities?: ModelCapabilities[];
}
export interface ProviderPreset {
    id: string;
    name: string;
    icon: string;
    kind: 'cloud' | 'local';
    adapter: ProviderAdapterId;
    defaultPlatform: string;
    defaultEndpoint: string;
    website: string;
    allowEmptyApiKey?: boolean;
    models: readonly ProviderModelPreset[];
    patchCompletionBody?: (body: Record<string, unknown>, model: string) => void;
}
export interface RuntimeProviderEntry extends ProviderEntry {
    provider: string;
    providerName: string;
    icon: string;
    platform: string;
    apiEndpoint: string;
}
export interface RuntimeProvider {
    provider: ProviderPreset;
    adapter: ProviderAdapterId;
    platform: string;
    entries: RuntimeProviderEntry[];
}
export interface ModelHubClientConfig extends ClientConfig, ProviderAdvancedSettings, OpenAIProviderSettings, GeminiProviderSettings {
    provider: string;
    providerName: string;
    icon: string;
    pullModels: boolean;
}
export type ModelHubPlugin = ChatLunaPlugin<ModelHubClientConfig, ModelHubResolvedConfig>;
export interface ModelHubRuntimeState {
    providers: RuntimeProvider[];
    clients: Map<string, ModelHubClient>;
    errors: Map<string, string>;
    plugins: Map<string, ModelHubPlugin>;
    revision: number;
}
export interface ModelHubConsoleProvider {
    id: string;
    name: string;
    icon: string;
    platform: string;
    endpoint: string;
    website: string;
    enabled: boolean;
    configured: boolean;
    pullModels: boolean;
    status: ModelHubProviderStatus;
    modelCount: number;
    error?: string;
}
export interface ModelHubConsoleModel {
    platform: string;
    provider: string;
    name: string;
    type: keyof typeof ModelType | string;
    maxTokens: number;
    capabilities: ModelCapabilities[];
    source: 'api' | 'custom';
}
export interface ModelHubConsolePreset {
    id: string;
    name: string;
    icon: string;
    kind: 'cloud' | 'local';
    adapter: ProviderAdapterId;
    defaultPlatform: string;
    defaultEndpoint: string;
    website: string;
    allowEmptyApiKey: boolean;
    modelCount: number;
}
export interface ModelHubConsoleData {
    iconCdn: string;
    settingsPath: string;
    revision: number;
    settings: ModelHubConsoleSettings;
    providers: ModelHubConsoleProvider[];
    models: ModelHubConsoleModel[];
    presets: ModelHubConsolePreset[];
    totals: {
        configured: number;
        loaded: number;
        models: number;
        presets: number;
    };
    frontendMode?: 'performance' | 'polished';
}
export interface ModelHubActionResult {
    success: boolean;
    message?: string;
    models?: number;
    errors?: Record<string, string>;
}
