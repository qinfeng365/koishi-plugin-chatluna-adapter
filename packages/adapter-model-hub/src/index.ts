import { DataService } from '@koishijs/plugin-console'
import { resolve } from 'path'
import { Context, Logger, Schema } from 'koishi'
import { ChatLunaPlugin } from 'koishi-plugin-chatluna/services/chat'
import {
    ModelCapabilities,
    ModelType
} from 'koishi-plugin-chatluna/llm-core/platform/types'
import { createLogger } from 'koishi-plugin-chatluna/utils/logger'
import { ModelHubClient } from './client'
import type { GeminiResourceRequest } from './adapters/gemini-resources'
import {
    DEFAULT_ICON_CDN,
    PROVIDER_PRESETS,
    getProviderPreset,
    resolveRuntimeProviders,
    targetMatches
} from './providers'
import { ModelMetadataStore } from './metadata'
import { ConnectionCatalogStore } from './connection-catalog'
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
    ModelCapabilityOverrideRequest,
    ProviderEntry,
    RuntimeProvider
} from './types'

export let logger: Logger

export class ModelHubConsoleService extends DataService<ModelHubConsoleData> {
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
            refreshMetadata: () => Promise<void>
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
        const runtimeByConfigIndex = new Map<number, RuntimeProvider>()
        for (const runtime of this._runtime.providers) {
            for (const entry of runtime.entries) {
                if (entry.configIndex != null) {
                    runtimeByConfigIndex.set(entry.configIndex, runtime)
                }
            }
        }
        const providers = configured.map((entry, index) => {
            const preset = getProviderPreset(entry.provider)
            const runtime = runtimeByConfigIndex.get(index)
            const platform = runtime?.platform ?? this._platformOf(entry)
            const endpoint = entry.apiEndpoint || preset.defaultEndpoint
            const readyForLoad =
                entry.enabled !== false &&
                endpoint.length > 0 &&
                (entry.sources
                    ? entry.sources.some(
                          (source) =>
                              source.enabled &&
                              source.credentials.some(
                                  (c) =>
                                      c.enabled &&
                                      (c.apiKey ||
                                          getProviderPreset(source.provider)
                                              .allowEmptyApiKey)
                              )
                      )
                    : entry.apiKey.length > 0 ||
                      preset.allowEmptyApiKey === true)
            const fatalError = this._runtime.errors.get(platform)
            const loaded = this._runtime.clients.has(platform)
            const connections =
                this._runtime.clients.get(platform)?.connectionStatus() ?? []
            const available = connections.filter(
                (c) => c.state === 'ready' || c.state === 'stale'
            ).length
            const degraded = connections.some((c) => c.state !== 'ready')
            const error = fatalError ?? connections.find((c) => c.error)?.error
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
                        : fatalError
                          ? 'error'
                          : loaded
                            ? degraded
                                ? available
                                    ? 'partial'
                                    : 'error'
                                : 'loaded'
                            : readyForLoad
                              ? 'configured'
                              : 'missing-key',
                modelCount: models.length,
                modelsUpdatedAt:
                    this._runtime.clients.get(platform)?.modelsUpdatedAt,
                error,
                connections
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
                loaded: providers.filter(
                    (item) =>
                        item.status === 'loaded' || item.status === 'partial'
                ).length,
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

    async updateModelCapabilities(
        request: ModelCapabilityOverrideRequest
    ): Promise<ModelHubActionResult> {
        if (
            !request ||
            request.revision !== this._settings.revision ||
            !Array.isArray(request.updates) ||
            !request.updates.length ||
            request.updates.length > 200
        )
            throw new Error('模型能力配置无效或已被修改，请重新载入后保存')
        const runtime = this._runtime.providers.find(
            (provider) =>
                provider.platform === request.platform &&
                provider.provider.id === request.providerId
        )
        const model = runtime
            ? this._modelsFor(runtime).find((m) => m.name === request.model)
            : undefined
        if (!model || model.type.toLowerCase() !== 'llm')
            throw new Error('模型已不可用，请刷新列表后重新编辑')
        const capabilities = new Set(Object.values(ModelCapabilities))
        const seen = new Set<string>()
        for (const update of request.updates) {
            if (
                !update ||
                !model.candidates?.some(
                    (candidate) =>
                        candidate.sourceId === update.sourceId &&
                        candidate.sourceProviderId ===
                            update.sourceProviderId &&
                        candidate.credentialId === update.credentialId &&
                        candidate.upstreamModel === update.upstreamModel
                )
            )
                throw new Error('连接已变化，不能将能力覆盖写入其他源或 Key')
            const key = JSON.stringify([
                update.sourceId,
                update.credentialId,
                update.upstreamModel
            ])
            if (seen.has(key)) throw new Error('模型能力覆盖范围重复')
            seen.add(key)
            if (
                !update.overrides ||
                typeof update.overrides !== 'object' ||
                Array.isArray(update.overrides)
            )
                throw new Error('模型能力覆盖必须是布尔值映射')
            for (const [capability, supported] of Object.entries(
                update.overrides
            ))
                if (
                    !capabilities.has(capability as ModelCapabilities) ||
                    typeof supported !== 'boolean'
                )
                    throw new Error('模型能力覆盖含未知能力或非布尔值')
        }
        // A narrow mutation, using the same revision-checked atomic save queue.
        // Never accept a whole unsaved provider/credential form from this dialog.
        const next = toConsoleSettings(this._settings)
        next.modelCapabilityOverrides = (
            next.modelCapabilityOverrides ?? []
        ).filter(
            (entry) =>
                !(
                    entry.providerId === request.providerId &&
                    entry.platform === request.platform &&
                    request.updates.some(
                        (update) =>
                            entry.sourceId === update.sourceId &&
                            entry.sourceProviderId ===
                                update.sourceProviderId &&
                            entry.credentialId === update.credentialId &&
                            entry.model === update.upstreamModel
                    )
                )
        )
        for (const update of request.updates)
            if (Object.keys(update.overrides).length)
                next.modelCapabilityOverrides.push({
                    providerId: request.providerId,
                    platform: request.platform,
                    sourceId: update.sourceId,
                    sourceProviderId: update.sourceProviderId,
                    credentialId: update.credentialId,
                    model: update.upstreamModel,
                    overrides: { ...update.overrides }
                })
        const result = await this.saveSettings(next)
        return { ...result, revision: this._settings.revision }
    }

    async refreshProvider(
        platform?: string,
        sourceId?: string
    ): Promise<ModelHubActionResult> {
        // Refresh the catalog first, but keep offline model reload usable.
        try {
            await this._options.refreshMetadata()
            this._runtime.errors.delete('__metadata__')
        } catch (error) {
            this._runtime.errors.set('__metadata__', errorMessage(error))
            logger.warn(error)
        }
        const targets = platform
            ? [[platform, this._runtime.clients.get(platform)] as const]
            : [...this._runtime.clients.entries()]

        let models = 0
        for (const [name, client] of targets) {
            if (!client) continue
            try {
                const refreshed = sourceId
                    ? await client.refreshSource(sourceId)
                    : await client.reloadModels()
                this.ctx.chatluna.platform.unregisterClient(name)
                client.registerSelf()
                await this.ctx.chatluna.platform.createClient(name)
                this._runtime.errors.delete(name)
                models += refreshed.length
                for (const key of this._runtime.errors.keys())
                    if (key.startsWith(`${name}/`))
                        this._runtime.errors.delete(key)
                for (const connection of client.connectionStatus?.() ?? []) {
                    if (connection.error)
                        this._runtime.errors.set(
                            `${name}/${connection.sourceId}/${connection.credentialId}`,
                            connection.error
                        )
                    else
                        this._runtime.errors.delete(
                            `${name}/${connection.sourceId}/${connection.credentialId}`
                        )
                }
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

    async geminiResource(platform: string, request: GeminiResourceRequest) {
        const client = this._runtime.clients.get(platform)
        if (!client)
            throw new Error(
                'Gemini provider is not loaded; save settings first'
            )
        return client.geminiResource(request)
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
                providerId: runtime.provider.id,
                name: model.name,
                type: ModelType[model.type],
                maxTokens: model.maxTokens,
                capabilities: model.capabilities,
                source: custom ? 'custom' : 'api',
                reasoningVariantOf: (
                    model as typeof model & { reasoningVariantOf?: string }
                ).reasoningVariantOf,
                lastUsedAt: this._runtime.clients
                    .get(runtime.platform)
                    ?.lastUsedAt(model.name),
                candidates: this._runtime.clients
                    .get(runtime.platform)
                    ?.modelCandidates(model.name)
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
    const connectionCatalog = new ConnectionCatalogStore(
        `${settingsStore.path}.catalog.json`,
        () => runtime.errors.delete('__catalog__')
    )
    const metadataStore = new ModelMetadataStore(ctx, {
        url: koishiConfig.metadataUrl,
        cachePath: koishiConfig.metadataCachePath,
        updateHours: koishiConfig.metadataUpdateHours,
        onStatus: (error) => {
            if (error) runtime.errors.set('__metadata__', errorMessage(error))
            else runtime.errors.delete('__metadata__')
        },
        onUpdate: async () => {
            // Scheduled catalog updates must also update registered ModelInfo.
            for (const [platform, client] of runtime.clients) {
                try {
                    await client.reloadModels()
                    ctx.chatluna.platform.unregisterClient(platform)
                    client.registerSelf()
                    await ctx.chatluna.platform.createClient(platform)
                    runtime.errors.delete(platform)
                } catch (error) {
                    runtime.errors.set(platform, errorMessage(error))
                    logger.warn(error)
                }
            }
            runtime.revision = Date.now()
            await ctx.get('console.services.chatluna_model_hub')?.refresh()
        }
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
        // Existing facades keep their identity. In-flight requests retain their captured state.
        const previousPlatforms = new Set(runtime.plugins.keys())
        runtime.providers = resolveRuntimeProviders(settings.providers)

        for (const provider of runtime.providers) {
            const providerConfig = createResolvedConfig(
                koishiConfig,
                settings,
                provider.entries[0]
            )
            const existing = runtime.clients.get(provider.platform)
            if (existing && runtime.plugins.has(provider.platform)) {
                previousPlatforms.delete(provider.platform)
                try {
                    existing.prepareUpdate(providerConfig, provider)()
                    await existing.reloadModels()
                    ctx.chatluna.platform.unregisterClient(provider.platform)
                    existing.registerSelf()
                    await ctx.chatluna.platform.createClient(provider.platform)
                    runtime.errors.delete(provider.platform)
                } catch {
                    runtime.errors.set(
                        provider.platform,
                        '配置已保存，但模型目录更新失败，请刷新此平台'
                    )
                }
                continue
            }
            const plugin = new ChatLunaPlugin<
                ModelHubClientConfig,
                ModelHubResolvedConfig
            >(ctx, providerConfig, provider.platform)

            plugin.parseConfig(() =>
                provider.entries.slice(0, 1).map((entry) => ({
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
                    maxRetries: 0,
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
                    metadataStore,
                    connectionCatalog
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

        for (const platform of previousPlatforms) {
            await runtime.clients.get(platform)?.shutdown()
            ctx.chatluna.uninstallPlugin(platform)
            ctx.chatluna.platform.unregisterClient(platform)
            runtime.clients.delete(platform)
            runtime.plugins.delete(platform)
            runtime.errors.delete(platform)
            for (const key of runtime.errors.keys())
                if (key.startsWith(`${platform}/`)) runtime.errors.delete(key)
        }

        runtime.revision = Date.now()
        for (const [platform, client] of runtime.clients)
            for (const connection of client.connectionStatus()) {
                const key = `${platform}/${connection.sourceId}/${connection.credentialId}`
                if (connection.error) runtime.errors.set(key, connection.error)
                else runtime.errors.delete(key)
            }
        return {
            success: runtime.errors.size === 0,
            errors: Object.fromEntries(runtime.errors)
        }
    }

    ctx.on('ready', async () => {
        try {
            await connectionCatalog.load()
        } catch {
            runtime.errors.set(
                '__catalog__',
                '连接模型缓存读取失败，等待重新刷新'
            )
        }
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

    let saveQueue: Promise<unknown> = Promise.resolve()
    ctx.inject(['console'], (ctx) => {
        ctx.plugin(ModelHubConsoleService, {
            config: koishiConfig,
            settingsPath: settingsStore.path,
            runtime,
            getSettings: () => settings,
            refreshMetadata: () => metadataStore.refresh(),
            saveSettings: (next) => {
                const task = saveQueue.then(async () => {
                    if (next.revision !== settings.revision)
                        throw new Error(
                            '配置已被其他页面修改，请重新载入后保存'
                        )
                    const normalized = normalizeSettings(next, settings)
                    normalized.revision = (settings.revision ?? 0) + 1
                    // Validate every platform and build all connection snapshots before committing.
                    const providers = resolveRuntimeProviders(
                        normalized.providers
                    )
                    const activations = providers.flatMap((provider) => {
                        const client = runtime.clients.get(provider.platform)
                        return client
                            ? [
                                  client.prepareUpdate(
                                      createResolvedConfig(
                                          koishiConfig,
                                          normalized,
                                          provider.entries[0]
                                      ),
                                      provider
                                  )
                              ]
                            : []
                    })
                    await settingsStore.save(normalized)
                    settings = normalized
                    for (const activate of activations) activate()
                    for (const key of runtime.errors.keys())
                        if (!key.startsWith('__')) runtime.errors.delete(key)
                    runtime.errors.delete('__settings__')
                    return await reloadRuntime()
                })
                saveQueue = task.catch(() => {})
                return task
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
            'chatluna-model-hub/updateModelCapabilities',
            async (request: ModelCapabilityOverrideRequest) =>
                ctx.console.services.chatluna_model_hub.updateModelCapabilities(
                    request
                ),
            { authority: 1 }
        )

        ctx.console.addListener(
            'chatluna-model-hub/refresh',
            async (platform?: string, sourceId?: string) =>
                ctx.console.services.chatluna_model_hub.refreshProvider(
                    platform,
                    sourceId
                ),
            { authority: 1 }
        )

        ctx.console.addListener(
            'chatluna-model-hub/geminiResource',
            async (platform: string, request: GeminiResourceRequest) =>
                ctx.console.services.chatluna_model_hub.geminiResource(
                    platform,
                    request
                ),
            { authority: 4 }
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
        Schema.const('polished').description('精致模式')
    ])
        .role('radio')
        .default('performance'),
    iconCdn: Schema.string().default(DEFAULT_ICON_CDN),
    settingsPath: Schema.string().default(DEFAULT_SETTINGS_PATH),
    metadataUrl: Schema.string()
        .default('https://models.dev/api.json')
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

OpenAI-compatible 服务商默认走 Chat Completions（/chat/completions）。OpenAI 本家可启用 Responses API，GPT-6 自动使用 Responses；xAI 可选择 Responses 并启用服务端工具。Gemini 默认 generateContent，可显式选择 stateless Interactions、Files 上传和缓存资源管理。

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
        metadataUrl: config.metadataUrl || 'https://models.dev/api.json',
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
    for (const key of runtime.errors.keys()) {
        if (key !== '__metadata__' && key !== '__settings__')
            runtime.errors.delete(key)
    }
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
                    outputVariable:
                        item.difyOutputVariable?.trim() || undefined,
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
        'chatluna-model-hub/geminiResource': (
            platform: string,
            request: GeminiResourceRequest
        ) => Promise<Record<string, unknown>>
        'chatluna-model-hub/getData': () => Promise<ModelHubConsoleData>
        'chatluna-model-hub/saveSettings': (
            settings: ModelHubConsoleSettings
        ) => Promise<ModelHubActionResult>
        'chatluna-model-hub/updateModelCapabilities': (
            request: ModelCapabilityOverrideRequest
        ) => Promise<ModelHubActionResult>
        'chatluna-model-hub/refresh': (
            platform?: string,
            sourceId?: string
        ) => Promise<ModelHubActionResult>
    }
}
