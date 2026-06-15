import type { Context } from 'koishi';
import type { ModelHubConsoleSettings, ModelHubKoishiConfig, ModelHubResolvedConfig, ModelHubSettings, ProviderAdvancedSettings } from './types';
export declare const DEFAULT_SETTINGS_PATH = "data/chatluna-model-hub/config.json";
export declare const DEFAULT_PROVIDER_ADVANCED_SETTINGS: ProviderAdvancedSettings;
export declare const DEFAULT_MODEL_HUB_SETTINGS: ModelHubSettings;
export declare class ModelHubSettingsStore {
    readonly path: string;
    constructor(ctx: Context, settingsPath: string | undefined);
    load(legacy?: unknown): Promise<ModelHubSettings>;
    save(settings: ModelHubSettings): Promise<void>;
}
export declare function resolveSettingsPath(ctx: Context, settingsPath: string | undefined): string;
export declare function createResolvedConfig(config: ModelHubKoishiConfig, settings: ModelHubSettings, advanced?: ProviderAdvancedSettings): ModelHubResolvedConfig;
export declare function toConsoleSettings(settings: ModelHubSettings): ModelHubConsoleSettings;
export declare function normalizeSettings(input: unknown, previous?: ModelHubSettings): ModelHubSettings;
