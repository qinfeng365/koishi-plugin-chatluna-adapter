import { DataService } from '@koishijs/plugin-console';
import { Context, Logger, Schema } from 'koishi';
import { PROVIDER_PRESETS } from './providers';
import type { ModelHubActionResult, ModelHubConsoleData, ModelHubConsoleModel, ModelHubConsoleSettings, ModelHubKoishiConfig, ModelHubRuntimeState, ModelHubSettings } from './types';
export declare let logger: Logger;
declare class ModelHubConsoleService extends DataService<ModelHubConsoleData> {
    private _options;
    constructor(ctx: Context, _options: {
        config: Config;
        settingsPath: string;
        runtime: ModelHubRuntimeState;
        getSettings: () => ModelHubSettings;
        saveSettings: (settings: ModelHubConsoleSettings) => Promise<ModelHubActionResult>;
    });
    private get _settings();
    private get _runtime();
    get(): Promise<{
        iconCdn: string;
        settingsPath: string;
        revision: number;
        settings: ModelHubConsoleSettings;
        providers: {
            id: string;
            name: string;
            icon: string;
            platform: string;
            endpoint: string;
            website: string;
            enabled: boolean;
            configured: boolean;
            pullModels: boolean;
            status: "disabled" | "error" | "loaded" | "configured" | "missing-key";
            modelCount: number;
            error: string;
        }[];
        models: ModelHubConsoleModel[];
        presets: {
            id: string;
            name: string;
            icon: string;
            kind: "cloud" | "local";
            adapter: import("./types").ProviderAdapterId;
            defaultPlatform: string;
            defaultEndpoint: string;
            website: string;
            allowEmptyApiKey: boolean;
            modelCount: number;
        }[];
        totals: {
            configured: number;
            loaded: number;
            models: number;
            presets: number;
        };
        frontendMode: "performance" | "polished";
    }>;
    saveSettings(settings: ModelHubConsoleSettings): Promise<ModelHubActionResult>;
    refreshProvider(platform?: string): Promise<ModelHubActionResult>;
    private _modelsFor;
    private _platformOf;
}
export declare function apply(ctx: Context, config: Config): void;
export interface Config extends ModelHubKoishiConfig {
}
export declare const Config: Schema<Config>;
export declare const usage = "\n## ChatLuna Model Hub Adapter\n\n\u7EDF\u4E00\u7BA1\u7406\u591A\u4E2A\u6A21\u578B\u670D\u52A1\u5546\u3002Koishi \u914D\u7F6E\u9875\u53EA\u4FDD\u7559 WebUI \u5165\u53E3\uFF1B\u4F9B\u5E94\u5546\u3001\u8BF7\u6C42\u53C2\u6570\u548C\u5BC6\u94A5\u8BF7\u5728\u300CModel Hub\u300DWebUI \u4E2D\u914D\u7F6E\u3002\n\nOpenAI-compatible \u670D\u52A1\u5546\u9ED8\u8BA4\u53EA\u8D70 Chat Completions\uFF08/chat/completions\uFF09\u3002OpenAI \u672C\u5BB6\u53EF\u5728\u670D\u52A1\u5546\u8BE6\u60C5\u91CC\u5355\u72EC\u542F\u7528 Responses API\uFF1BGemini \u672C\u5BB6\u53EF\u5728\u670D\u52A1\u5546\u8BE6\u60C5\u91CC\u5355\u72EC\u542F\u7528 Google Search \u7B49 Gemini \u5DE5\u5177\u3002\n\n\u914D\u7F6E\u6587\u4EF6\u9ED8\u8BA4\u4FDD\u5B58\u5728 `data/chatluna-model-hub/config.json`\u3002WebUI \u4E0D\u4F1A\u628A\u5DF2\u4FDD\u5B58\u7684 API Key \u660E\u6587\u56DE\u4F20\u5230\u6D4F\u89C8\u5668\uFF0C\u7559\u7A7A\u5BC6\u94A5\u8F93\u5165\u6846\u4F1A\u4FDD\u7559\u539F\u503C\u3002\n\u6A21\u578B\u4E0A\u4E0B\u6587\u5927\u5C0F\u548C\u601D\u8003\u80FD\u529B\u4F18\u5148\u8BFB\u53D6\u670D\u52A1\u5546 /models \u8FD4\u56DE\u503C\u3002\u672A\u63D0\u4F9B\u65F6\uFF0C\u518D\u7528 models.dev \u7684\u672C\u5730\u7F13\u5B58\u8865\u5168\uFF1B\u53EF\u5728\u914D\u7F6E\u9875\u8C03\u6574\u66F4\u65B0\u95F4\u9694\u3002\n";
export declare const inject: {
    required: string[];
    optional: string[];
};
export declare const reusable = true;
export declare const name = "chatluna-model-hub-adapter";
export { PROVIDER_PRESETS };
export type * from './types';
declare module '@koishijs/plugin-console' {
    namespace Console {
        interface Services {
            chatluna_model_hub: ModelHubConsoleService;
        }
    }
    interface Events {
        'chatluna-model-hub/getData': () => Promise<ModelHubConsoleData>;
        'chatluna-model-hub/saveSettings': (settings: ModelHubConsoleSettings) => Promise<ModelHubActionResult>;
        'chatluna-model-hub/refresh': (platform?: string) => Promise<ModelHubActionResult>;
    }
}
