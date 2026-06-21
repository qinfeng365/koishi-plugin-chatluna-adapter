import { DataService } from '@koishijs/plugin-console'
import { resolve } from 'path'
import { Context, Logger, Schema } from 'koishi'
import { ChatLunaPlugin } from 'koishi-plugin-chatluna/services/chat'
import { ModelType } from 'koishi-plugin-chatluna/llm-core/platform/types'
import { createLogger } from 'koishi-plugin-chatluna/utils/logger'
import { ModelHubClient } from './client'
import {
    DEFAULT_ICON_CDN,
    PROVIDER_PRESETS,
    getProviderPreset,
    resolveRuntimeProviders,
    targetMatches
} from './providers'
import { ModelMetadataStore } from './metadata'
import {
    DEFAULT_SETTINGS_PATH,
    ModelHubSettingsStore,
    createResolvedConfig,
    normalizeSettings,
    toConsoleSettings
} from './settings'
import type {
    ModelHubActionResult,
    ModelHubClientConfig,
    ModelHubConsoleData,
    ModelHubConsoleModel,
    ModelHubConsoleSettings,
    ModelHubKoishiConfig,
    ModelHubResolvedConfig,
    ModelHubRuntimeState,
    ModelHubSettings,
    ProviderEntry,
    RuntimeProvider
} from './types'

export let logger: Logger

class ModelHubConsoleService extends DataService<ModelHubConsoleData> {
    constructor(
        ctx: Context,
        private _options: {
            config: Config
            settingsPath: string
            runtime: ModelHubRuntimeState
            getSettings: () => ModelHubSettings
            saveSettings: (
                settings: ModelHubConsoleSettings
            ) => Promise<ModelHubActionResult>
        }
    ) {
        super(ctx, 'chatluna_model_hub', {
            immediate: true,
            authority: 1
        })
    }

    private get _settings() {
        return this._options.getSettings()
    }

    private get _runtime() {
        return this._options.runtime
    }

    async get() {
        const settings = this._settings
        const configured = settings.providers ?? []
        const providers = configured.map((entry) => {
            const preset = getProviderPreset(entry.provider)
            const platform = this._platformOf(entry)
            const endpoint = entry.apiEndpoint || preset.defaultEndpoint
            const readyForLoad =
                entry.enabled !== false &&
                endpoint.length > 0 &&
                (entry.apiKey.length > 0 || preset.allowEmptyApiKey === true)
            const error = this._runtime.errors.get(platform)
            const loaded = this._runtime.clients.has(platform)
            const models = this.ctx.chatluna.platform.listPlatformModels(
                platform,
                ModelType.all
            ).value

            return {
                id: preset.id,
                name: entry.name?.trim() || preset.name,
                icon: preset.icon,
                platform,
                endpoint,
                website: preset.website,
                enabled: entry.enabled !== false,
                configured: readyForLoad,
                pullModels: entry.pullModels === true,
                status:
                    entry.enabled === false
                        ? 'disabled'
                        : error
                          ? 'error'
                          : loaded
                            ? 'loaded'
                            : readyForLoad
                              ? 'configured'
                              : 'missing-key',
                modelCount: models.length,
                error
            } satisfies ModelHubConsoleData['providers'][number]
        })

        const models = this._runtime.providers.flatMap((runtime) =>
            this._modelsFor(runtime)
        )

        const presets = PROVIDER_PRESETS.map((preset) => ({
            id: preset.id,
            name: preset.name,
            icon: preset.icon,
            kind: preset.kind,
            adapter: preset.adapter,
            defaultPlatform: preset.defaultPlatform,
            defaultEndpoint: preset.defaultEndpoint,
            website: preset.website,
            allowEmptyApiKey: preset.allowEmptyApiKey === true,
            modelCount: 0
        }))

        return {
            iconCdn: this._options.config.iconCdn || DEFAULT_ICON_CDN,
            settingsPath: this._options.settingsPath,
            revision: this._runtime.revision,
            settings: toConsoleSettings(settings),
            providers,
            models,
            presets,
            totals: {
                configured: providers.filter((item) => item.configured).length,
                loaded: providers.filter((item) => item.status === 'loaded')
                    .length,
                models: models.length,
                presets: presets.length
            },
            frontendMode: this._options.config.frontendMode || 'performance'
        }
    }

    async saveSettings(
        settings: ModelHubConsoleSettings
    ): Promise<ModelHubActionResult> {
        const result = await this._options.saveSettings(settings)
        await this.refresh()
        return result
    }

    async refreshProvider(platform?: string): Promise<ModelHubActionResult> {
        const targets = platform
            ? [[platform, this._runtime.clients.get(platform)] as const]
            : [...this._runtime.clients.entries()]

        let models = 0
        for (const [name, client] of targets) {
            if (!client) continue
            try {
                const refreshed = await client.reloadModels()
                await this.ctx.chatluna.platform.refreshClient(client, name)
                this._runtime.errors.delete(name)
                models += refreshed.length
            } catch (error) {
                this._runtime.errors.set(name, errorMessage(error))
                logger.warn(error)
            }
        }

        this._runtime.revision = Date.now()
        await this.refresh()
        return {
            success: this._runtime.errors.size === 0,
            models,
            errors: Object.fromEntries(this._runtime.errors)
        }
    }

    private _modelsFor(runtime: RuntimeProvider): ModelHubConsoleModel[] {
        const settings = this._settings
        const platformModels = this.ctx.chatluna.platform.listPlatformModels(
            runtime.platform,
            ModelType.all
        ).value
        const additional = settings.additionalModels.filter((item) =>
            targetMatches(item.target, runtime.platform, runtime.provider.id)
        )

        return platformModels.map((model) => {
            const custom = additional.some((item) => item.model === model.name)

            return {
                platform: runtime.platform,
                provider: runtime.provider.name,
                name: model.name,
                type: ModelType[model.type],
                maxTokens: model.maxTokens,
                capabilities: model.capabilities,
                source: custom ? 'custom' : 'api'
            }
        })
    }

    private _platformOf(entry: ProviderEntry) {
        const preset = getProviderPreset(entry.provider)
        return (entry.platform || preset.defaultPlatform).trim()
    }
}

export function apply(ctx: Context, config: Config) {
    logger = createLogger(ctx, 'chatluna-model-hub-adapter')

    const koishiConfig = normalizeKoishiConfig(config)
    const settingsStore = new ModelHubSettingsStore(
        ctx,
        koishiConfig.settingsPath
    )
    const metadataStore = new ModelMetadataStore(ctx, {
        url: koishiConfig.metadataUrl,
        cachePath: koishiConfig.metadataCachePath,
        updateHours: koishiConfig.metadataUpdateHours
    })
    const runtime: ModelHubRuntimeState = {
        providers: [],
        clients: new Map(),
        errors: new Map(),
        plugins: new Map(),
        revision: Date.now()
    }

    let settings = normalizeSettings({})

    const reloadRuntime = async (): Promise<ModelHubActionResult> => {
        unregisterRuntime(ctx, runtime)
        runtime.providers = resolveRuntimeProviders(settings.providers)

        for (const provider of runtime.providers) {
            const providerConfig = createResolvedConfig(
                koishiConfig,
                settings,
                provider.entries[0]
            )
            const plugin = new ChatLunaPlugin<
                ModelHubClientConfig,
                ModelHubResolvedConfig
            >(ctx, providerConfig, provider.platform)

            plugin.parseConfig(() =>
                provider.entries.map((entry) => ({
                    ...entry,
                    apiKey: entry.apiKey,
                    apiEndpoint: entry.apiEndpoint,
                    platform: provider.platform,
                    provider: entry.provider,
                    providerName: entry.providerName,
                    icon: entry.icon,
                    pullModels: entry.pullModels,
                    chatLimit: entry.chatTimeLimit,
                    timeout: entry.timeout,
                    maxRetries: entry.maxRetries,
                    concurrentMaxSize: entry.chatConcurrentMaxSize,
                    difyApps:
                        provider.provider.adapter === 'dify'
                            ? createDifyApps(provider.entries)
                            : undefined
                }))
            )

            plugin.registerClient(() => {
                const client = new ModelHubClient(
                    ctx,
                    providerConfig,
                    plugin,
                    provider,
                    metadataStore
                )
                runtime.clients.set(provider.platform, client)
                return client
            })

            try {
                runtime.plugins.set(provider.platform, plugin)
                await plugin.initClient()
                runtime.errors.delete(provider.platform)
            } catch (error) {
                runtime.errors.set(provider.platform, errorMessage(error))
                ctx.chatluna.uninstallPlugin(provider.platform)
                ctx.chatluna.platform.unregisterClient(provider.platform)
                runtime.clients.delete(provider.platform)
                runtime.plugins.delete(provider.platform)
                logger.warn(error)
            }
        }

        runtime.revision = Date.now()
        return {
            success: runtime.errors.size === 0,
            errors: Object.fromEntries(runtime.errors)
        }
    }

    ctx.on('ready', async () => {
        try {
            await metadataStore.start()
        } catch (error) {
            runtime.errors.set('__metadata__', errorMessage(error))
            logger.warn(error)
        }

        try {
            settings = await settingsStore.load(config)
        } catch (error) {
            runtime.errors.set('__settings__', errorMessage(error))
            logger.warn(error)
        }

        await reloadRuntime()
        await ctx.get('console.services.chatluna_model_hub')?.refresh()
    })

    if (!koishiConfig.webui) return

    ctx.inject(['console'], (ctx) => {
        ctx.plugin(ModelHubConsoleService, {
            config: koishiConfig,
            settingsPath: settingsStore.path,
            runtime,
            getSettings: () => settings,
            saveSettings: async (next) => {
                settings = normalizeSettings(next, settings)
                await settingsStore.save(settings)
                return await reloadRuntime()
            }
        })

        ctx.console.addListener('chatluna-model-hub/getData', async () =>
            ctx.console.services.chatluna_model_hub.get()
        )

        ctx.console.addListener(
            'chatluna-model-hub/saveSettings',
            async (settings: ModelHubConsoleSettings) =>
                ctx.console.services.chatluna_model_hub.saveSettings(settings),
            { authority: 1 }
        )

        ctx.console.addListener(
            'chatluna-model-hub/refresh',
            async (platform?: string) =>
                ctx.console.services.chatluna_model_hub.refreshProvider(
                    platform
                ),
            { authority: 1 }
        )

        ctx.console.addEntry({
            dev: resolve(__dirname, '../client/index.ts'),
            prod: resolve(__dirname, '../dist')
        })
    })
}

export interface Config extends ModelHubKoishiConfig {}

export const Config: Schema<Config> = Schema.object({
    webui: Schema.boolean().default(true),
    frontendMode: Schema.union([
        Schema.const('performance').description('性能模式'),
        Schema.const('polished').description('精致模式'),
    ]).role('radio').default('performance'),
    iconCdn: Schema.string().default(DEFAULT_ICON_CDN),
    settingsPath: Schema.string().default(DEFAULT_SETTINGS_PATH),
    metadataUrl: Schema.string()
        .default('https://models.dev/models.json')
        .description('模型元数据缓存源'),
    metadataCachePath: Schema.string()
        .default('data/chatluna-model-hub/models.dev.models.json')
        .description('模型元数据缓存文件'),
    metadataUpdateHours: Schema.number()
        .default(24)
        .min(1)
        .max(168)
        .description('元数据更新间隔（小时）')
}).i18n({
    'zh-CN': require('./locales/zh-CN.schema.yml'),
    'en-US': require('./locales/en-US.schema.yml')
}) as Schema<Config>

export const usage = `
## ChatLuna Model Hub Adapter

统一管理多个模型服务商。Koishi 配置页只保留 WebUI 入口；供应商、请求参数和密钥请在「Model Hub」WebUI 中配置。

OpenAI-compatible 服务商默认只走 Chat Completions（/chat/completions）。OpenAI 本家可在服务商详情里单独启用 Responses API；Gemini 本家可在服务商详情里单独启用 Google Search 等 Gemini 工具。

配置文件默认保存在 \`data/chatluna-model-hub/config.json\`。WebUI 不会把已保存的 API Key 明文回传到浏览器，留空密钥输入框会保留原值。
模型上下文大小和思考能力优先读取服务商 /models 返回值。未提供时，再用 models.dev 的本地缓存补全；可在配置页调整更新间隔。
`

export const inject = {
    required: ['chatluna'],
    optional: ['console', 'chatluna_storage']
}

export const reusable = true
export const name = 'chatluna-model-hub-adapter'

export { PROVIDER_PRESETS }
export type * from './types'

function normalizeKoishiConfig(config: Partial<Config>): Config {
    return {
        webui: config.webui !== false,
        frontendMode: config.frontendMode || 'performance',
        iconCdn: config.iconCdn || DEFAULT_ICON_CDN,
        settingsPath: config.settingsPath || DEFAULT_SETTINGS_PATH,
        metadataUrl: config.metadataUrl || 'https://models.dev/models.json',
        metadataCachePath:
            config.metadataCachePath ||
            'data/chatluna-model-hub/models.dev.models.json',
        metadataUpdateHours: Math.max(1, config.metadataUpdateHours || 24)
    }
}

function unregisterRuntime(ctx: Context, runtime: ModelHubRuntimeState) {
    const platforms = new Set([
        ...runtime.plugins.keys(),
        ...runtime.clients.keys(),
        ...runtime.providers.map((provider) => provider.platform)
    ])

    for (const platform of platforms) {
        try {
            ctx.chatluna.uninstallPlugin(platform)
            ctx.chatluna.platform.unregisterClient(platform)
        } catch (error) {
            logger.warn(error)
        }
    }

    runtime.providers = []
    runtime.clients.clear()
    runtime.plugins.clear()
    runtime.errors.clear()
}

function createDifyApps(entries: RuntimeProvider['entries']) {
    const seen = new Map<string, number>()
    return Object.fromEntries(
        entries.map((item) => {
            const baseModelName =
                item.difyModelName?.trim() || item.providerName || item.platform
            const index = seen.get(baseModelName) ?? 0
            seen.set(baseModelName, index + 1)
            const modelName =
                index === 0 ? baseModelName : `${baseModelName}-${index + 1}`

            return [
                modelName,
                {
                    apiKey: item.apiKey,
                    apiEndpoint: item.apiEndpoint,
                    platform: item.platform,
                    providerName: item.providerName,
                    modelName,
                    appType: item.difyAppType ?? 'chat',
                    workflowId: item.difyWorkflowId?.trim() || undefined,
                    outputVariable: item.difyOutputVariable?.trim() || undefined,
                    enableFileUpload: item.difyEnableFileUpload !== false,
                    contextSize: item.difyContextSize ?? 128_000
                }
            ]
        })
    )
}

function errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error)
}

declare module '@koishijs/plugin-console' {
    namespace Console {
        interface Services {
            chatluna_model_hub: ModelHubConsoleService
        }
    }

    interface Events {
        'chatluna-model-hub/getData': () => Promise<ModelHubConsoleData>
        'chatluna-model-hub/saveSettings': (
            settings: ModelHubConsoleSettings
        ) => Promise<ModelHubActionResult>
        'chatluna-model-hub/refresh': (
            platform?: string
        ) => Promise<ModelHubActionResult>
    }
}
