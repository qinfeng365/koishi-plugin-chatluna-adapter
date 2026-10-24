import { createHash } from 'crypto'
import { AsyncLocalStorage } from 'async_hooks'
import type { Context } from 'koishi'
import type { RunnableConfig } from '@langchain/core/runnables'
import type { ChatGenerationChunk } from '@langchain/core/outputs'
import type { ClientConfigPool } from 'koishi-plugin-chatluna/llm-core/platform/config'
import type {
    ModelRequestParams,
    EmbeddingsRequestParams,
    RerankerRequestParams
} from 'koishi-plugin-chatluna/llm-core/platform/api'
import {
    ModelCapabilities as Cap,
    ModelType,
    type ModelInfo
} from 'koishi-plugin-chatluna/llm-core/platform/types'
import {
    getModelMaxContextSize,
    isEmbeddingModel,
    isRerankerModel,
    parseOpenAIModelNameWithReasoningEffort
} from '@chatluna/v1-shared-adapter'
import { ModelHubRequester } from './requester'
import {
    capabilityFileHandling,
    protocolCapabilities,
    resolveCapabilities
} from './capabilities'
import {
    getProviderPreset,
    getTargetedAdditionalModels,
    getTargetedBlacklist
} from './providers'
import { expandReasoningVariantsForProvider } from './adapters/model-list'
import type { GeminiResourceRequest } from './adapters/gemini-resources'
import type { ModelMetadataStore } from './metadata'
import { ConnectionCatalogStore } from './connection-catalog'
import type {
    ConnectionStatus,
    ModelHubClientConfig,
    ModelHubPlugin,
    ModelHubResolvedConfig,
    ModelRoute,
    RuntimeProvider
} from './types'

interface Connection {
    key: string
    signature: string
    config: ModelHubClientConfig
    requester: ModelHubRequester
    models: ModelInfo[]
    discovered: boolean
    updatedAt?: number
    error?: string
    retryAt: number
    authFailed: boolean
    denied: Set<string>
}
interface Candidate {
    connection: Connection
    upstreamModel: string
    embeddingSpace?: string
}
interface Route {
    info: ModelInfo
    candidates: Candidate[]
    allowFallback: boolean
}
interface State {
    id: number
    platform: string
    providerId: string
    config: ModelHubResolvedConfig
    connections: Connection[]
    routes: Map<string, Route>
}
interface Counter {
    active: number
    times: number[]
}

/** Only transport facts drive failover. Provider error text may contain secrets. */
export class UpstreamFailure extends Error {
    constructor(
        readonly status: number,
        readonly retryAt = 0,
        readonly kind:
            | 'auth'
            | 'permission'
            | 'rate'
            | 'source'
            | 'request' = status === 401
            ? 'auth'
            : status === 429
              ? 'rate'
              : status >= 500
                ? 'source'
                : 'request',
        param?: string
    ) {
        super(`上游 HTTP ${status}${param ? `（参数：${param}）` : ''}`)
        this.name = 'UpstreamFailure'
    }
}

export function retryAfter(value: string | null, now = Date.now()) {
    if (!value) return now + 30_000
    const seconds = Number(value)
    const date = Number.isFinite(seconds)
        ? now + Math.max(0, seconds) * 1000
        : Date.parse(value)
    return Number.isFinite(date) ? Math.max(now, date) : now + 30_000
}

const identity = (c: ModelHubClientConfig) =>
    `${c.sourceId}/${c.credentialId}/${c.credentialGeneration}`
const hash = (value: string) => createHash('sha256').update(value).digest('hex')
const clone = <T>(value: T): T => structuredClone(value)
function transportFailure(error: unknown): UpstreamFailure | undefined {
    for (let depth = 0; error && depth < 8; depth++) {
        if (error instanceof UpstreamFailure) return error
        error =
            (error as { originError?: unknown; cause?: unknown }).originError ??
            (error as { cause?: unknown }).cause
    }
}
function freeze<T>(value: T): T {
    if (value && typeof value === 'object') {
        Object.freeze(value)
        for (const child of Object.values(value)) freeze(child)
    }
    return value
}

/** One public requester; each connection has its own immutable pool and transport. */
export class ModelHubRouter extends ModelHubRequester {
    private state: State
    private roundRobin = new Map<string, number>()
    private counters = new Map<string, Counter>()
    private sticky = new Map<string, string>()
    private uses = new Map<string, number>()
    private queued = 0
    private active = 0
    private retired = new Set<Connection>()
    private refreshTasks = new Map<string, Promise<ModelInfo[]>>()
    private refreshTail: Promise<unknown> = Promise.resolve()
    private sequence = 0
    private resourceRequests = 0
    private closed = false
    private attempt = new AsyncLocalStorage<AbortSignal>()

    constructor(
        ctx: Context,
        config: ModelHubResolvedConfig,
        private plugin: ModelHubPlugin,
        runtime: RuntimeProvider,
        private metadata: ModelMetadataStore,
        private catalog = new ConnectionCatalogStore()
    ) {
        super(ctx, plugin.platformConfigPool, config, plugin)
        this.state = this.prepare(config, runtime)
        ctx.on?.('dispose', () => {
            void this.dispose()
        })
    }

    /** Build first; activation is one synchronous pointer replacement. */
    prepare(config: ModelHubResolvedConfig, runtime: RuntimeProvider): State {
        const previous = this.state?.connections ?? []
        const connections = runtime.entries.map((entry, index) => {
            const {
                sources: _sources,
                routes: _routes,
                ...connectionSettings
            } = entry
            const snapshot: ModelHubClientConfig = clone({
                ...connectionSettings,
                sourceId: entry.sourceId ?? `legacy-${index}`,
                credentialId: entry.credentialId ?? `legacy-${index}`,
                credentialGeneration: entry.credentialGeneration ?? 1,
                concurrentMaxSize: entry.chatConcurrentMaxSize,
                chatLimit: entry.chatTimeLimit,
                maxRetries: 0,
                difyApps: undefined
            })
            const signature = hash(
                JSON.stringify([
                    snapshot,
                    config.additionalModels,
                    config.blacklistModels,
                    config.providers.find(
                        (p) => p.platform === runtime.platform
                    )?.routes
                ])
            )
            const old = previous.find((c) => c.signature === signature)
            if (old) return old
            // Dify enriches its own app-parameter cache; keep that separate from the frozen config.
            freeze(snapshot)
            // No mutable pool index, failure lock or per-connection background timer.
            const ref = {
                value: snapshot,
                md5: () => signature,
                isAvailable: true,
                failureCount: 0
            }
            const pool = {
                getConfig: () => ref,
                getConfigs: () => [ref],
                findAvailableConfig: () => ref,
                markConfigStatus() {}
            } as unknown as ClientConfigPool<ModelHubClientConfig>
            const boundConfig = freeze({
                ...clone(config),
                ...snapshot,
                maxRetries: 0
            }) as ModelHubResolvedConfig
            let connection: Connection
            const transport = new Proxy(this.plugin, {
                get: (target, prop) => {
                    if (prop !== 'fetch')
                        return Reflect.get(target, prop, target)
                    return async (url: string, init: any = {}) => {
                        const signal = this.attempt.getStore()
                        if (signal) {
                            signal.throwIfAborted()
                            init = {
                                ...init,
                                signal: init.signal
                                    ? AbortSignal.any([signal, init.signal])
                                    : signal
                            }
                        }
                        const proxy =
                            snapshot.proxyMode === 'off'
                                ? 'null'
                                : snapshot.proxyMode === 'on'
                                  ? snapshot.proxyAddress
                                  : undefined
                        // fetch() resolves proxy policy through `this.config`, so bind that too.
                        const boundPlugin = new Proxy(target, {
                            get: (object, field) =>
                                field === 'config'
                                    ? boundConfig
                                    : Reflect.get(object, field, object)
                        })
                        const response = await target.fetch.call(
                            boundPlugin,
                            url,
                            init,
                            proxy
                        )
                        if (!response.ok) {
                            const at =
                                response.status === 429
                                    ? retryAfter(
                                          response.headers.get('retry-after')
                                      )
                                    : 0
                            throw await responseFailure(response, at)
                        }
                        return response
                    }
                }
            })
            const requester = new ModelHubRequester(
                this.koishiContext(),
                pool,
                boundConfig,
                transport
            )
            if (getProviderPreset(snapshot.provider).adapter === 'dify') {
                const modelName =
                    snapshot.difyModelName?.trim() ||
                    snapshot.providerName ||
                    snapshot.platform
                requester.setDifyApps({
                    [modelName]: {
                        modelName,
                        apiKey: snapshot.apiKey,
                        apiEndpoint: snapshot.apiEndpoint,
                        connectionScope: identity(snapshot),
                        platform: snapshot.platform,
                        providerName: snapshot.providerName,
                        appType: snapshot.difyAppType ?? 'chat',
                        workflowId: snapshot.difyWorkflowId,
                        outputVariable: snapshot.difyOutputVariable,
                        contextSize: snapshot.difyContextSize ?? 128000,
                        enableFileUpload:
                            snapshot.difyEnableFileUpload !== false
                    }
                })
            }
            connection = {
                key: identity(snapshot),
                signature,
                config: snapshot,
                requester,
                models: [],
                discovered: false,
                retryAt: 0,
                authFailed: false,
                denied: new Set()
            }
            // A settings-only change may retain a last-good directory, never a different auth generation.
            const sameScope = previous.find((c) => c.key === connection.key)
            if (sameScope) {
                connection.models = sameScope.models
                connection.discovered = sameScope.discovered
                connection.updatedAt = sameScope.updatedAt
            } else {
                const cached = this.catalog.get(connection.key)
                if (cached) {
                    connection.models = cached.models
                    connection.updatedAt = cached.updatedAt
                    connection.discovered = true
                    connection.error = '使用上次成功目录，等待刷新'
                }
            }
            return connection
        })
        const state = {
            id: ++this.sequence,
            platform: runtime.platform,
            providerId: runtime.provider.id,
            config: freeze(clone(config)),
            connections,
            routes: new Map<string, Route>()
        }
        state.routes = this.buildRoutes(state)
        return state
    }

    activate(next: State) {
        const old = this.state
        next.routes = this.buildRoutes(next, true)
        this.state = next
        for (const connection of old.connections)
            if (!next.connections.includes(connection))
                this.retired.add(connection)
        this.collect()
    }

    private collect() {
        if (this.active || this.resourceRequests) return
        for (const c of this.retired) void c.requester.dispose()
        this.retired.clear()
    }

    lastUsedAt(model: string) {
        return this.uses.get(model)
    }

    status(): ConnectionStatus[] {
        return this.state.connections.map((c) => ({
            sourceId: c.config.sourceId,
            credentialId: c.config.credentialId,
            state: c.authFailed
                ? 'error'
                : c.retryAt > Date.now()
                  ? 'cooldown'
                  : c.error
                    ? c.discovered
                        ? 'stale'
                        : 'error'
                    : 'ready',
            modelCount: c.models.length,
            updatedAt: c.updatedAt,
            retryAt: c.retryAt || undefined,
            error: c.error
        }))
    }

    modelCandidates(model: string) {
        return (
            this.state.routes.get(model)?.candidates.map((c) => ({
                sourceId: c.connection.config.sourceId,
                credentialId: c.connection.config.credentialId,
                upstreamModel: c.upstreamModel,
                sourceName: c.connection.config.providerName,
                credentialName: this.state.config.providers
                    .flatMap((p) => p.sources ?? [])
                    .find((s) => s.id === c.connection.config.sourceId)
                    ?.credentials.find(
                        (key) => key.id === c.connection.config.credentialId
                    )?.name,
                capabilities: c.connection.models.find(
                    (m) => m.name === c.upstreamModel
                )?.capabilities,
                available:
                    !c.connection.authFailed &&
                    !c.connection.denied.has(c.upstreamModel) &&
                    c.connection.retryAt <= Date.now()
            })) ?? []
        )
    }

    getModels(config?: RunnableConfig) {
        return this.refreshCatalog(config)
    }

    refreshCatalog(
        config?: RunnableConfig,
        sourceId?: string
    ): Promise<ModelInfo[]> {
        if (this.closed) return Promise.reject(new Error('此平台已停止或删除'))
        const state = this.state
        const key = `${state.id}/${sourceId ?? '*'}`
        if (this.refreshTasks.has(key)) return this.refreshTasks.get(key)
        const run = async () => {
            const pending = state.connections.filter(
                (c) => !sourceId || c.config.sourceId === sourceId
            )
            // Bounded parallel discovery, once per credential permission scope, never on page mount.
            await Promise.all(
                Array.from(
                    { length: Math.min(4, pending.length) },
                    async () => {
                        for (;;) {
                            const c = pending.shift()
                            if (!c) return
                            try {
                                const raw =
                                    c.config.pullModels ||
                                    getProviderPreset(c.config.provider)
                                        .adapter === 'dify'
                                        ? await c.requester.getModels({
                                              ...config,
                                              signal:
                                                  config?.signal ??
                                                  AbortSignal.timeout(
                                                      c.config.timeout
                                                  )
                                          })
                                        : []
                                const preset = getProviderPreset(
                                    c.config.provider
                                )
                                let models = raw.map((model) =>
                                    this.metadata.enhance(preset.id, model)
                                )
                                if (c.config.expandReasoningVariants)
                                    models = expandReasoningVariantsForProvider(
                                        preset,
                                        models,
                                        c.config
                                    )
                                c.models = models.map((model) => {
                                    const type =
                                        model.type ??
                                        (isRerankerModel(model.name)
                                            ? ModelType.reranker
                                            : isEmbeddingModel(model.name)
                                              ? ModelType.embeddings
                                              : ModelType.llm)
                                    const info: ModelInfo = {
                                        ...model,
                                        type,
                                        capabilities:
                                            type === ModelType.llm
                                                ? resolveCapabilities(
                                                      preset.adapter,
                                                      model,
                                                      c.config.responseApi
                                                  )
                                                : [],
                                        maxTokens:
                                            model.maxTokens ||
                                            this.metadata.getMaxTokens(
                                                preset.id,
                                                model.name
                                            ) ||
                                            (type === ModelType.llm
                                                ? getModelMaxContextSize(
                                                      model as ModelInfo
                                                  ) || 128000
                                                : c.config
                                                      .nonLlmInputTokenLimit)
                                    }
                                    if (
                                        type === ModelType.llm &&
                                        !info.capabilities.includes(
                                            Cap.ImageGeneration
                                        )
                                    )
                                        info.capabilities = [
                                            ...new Set([
                                                Cap.TextInput,
                                                ...info.capabilities
                                            ])
                                        ]
                                    return info
                                })
                                c.updatedAt = Date.now()
                                c.discovered = true
                                c.error = undefined
                                c.authFailed = false
                                c.retryAt = 0
                                c.denied.clear()
                                this.catalog.set(c.key, c.models, c.updatedAt)
                            } catch (error) {
                                if (config?.signal?.aborted) throw error
                                c.error =
                                    error instanceof UpstreamFailure
                                        ? error.message
                                        : '模型目录刷新失败，请检查连接、权限和代理'
                                if (error instanceof UpstreamFailure)
                                    this.fail(c, '', error, state)
                            }
                        }
                    }
                )
            )
            state.routes = this.buildRoutes(state)
            await this.catalog.flush()
            return [...state.routes.values()].map((r) => r.info)
        }
        const refresh = this.refreshTail.then(run)
        // An old discovery must not repopulate the facade after a settings swap.
        // Chain against the actual discovery, not the redirect, to avoid a tail cycle.
        this.refreshTail = refresh.catch(() => {})
        const task = refresh
            .then((models) =>
                state === this.state
                    ? models
                    : this.refreshCatalog(config, sourceId)
            )
            .finally(() => {
                this.refreshTasks.delete(key)
            })
        this.refreshTasks.set(key, task)
        return task
    }

    private buildRoutes(
        state: State,
        rememberOrigins = state === this.state
    ): Map<string, Route> {
        const result = new Map<string, Route>()
        const manual = getTargetedAdditionalModels(
            state.config.additionalModels,
            state.platform,
            state.providerId
        )
        const directories = new Map<Connection, ModelInfo[]>()
        const primary = state.connections
            .slice()
            .sort(
                (a, b) =>
                    (a.config.sourcePriority ?? 0) -
                    (b.config.sourcePriority ?? 0)
            )[0]?.config.sourceId
        for (const c of state.connections) {
            const preset = getProviderPreset(c.config.provider)
            const additions =
                c.config.sourceId === primary
                    ? manual.map((m) => ({
                          name: m.model,
                          type: m.modelType
                              .toLowerCase()
                              .startsWith('embeddings')
                              ? ModelType.embeddings
                              : m.modelType.toLowerCase().startsWith('reranker')
                                ? ModelType.reranker
                                : ModelType.llm,
                          maxTokens: m.contextSize || 4096,
                          capabilities: protocolCapabilities(
                              preset.adapter,
                              m.modelCapabilities,
                              c.config.responseApi
                          )
                      }))
                    : []
            for (const m of additions)
                if (
                    m.type === ModelType.llm &&
                    !m.capabilities.includes(Cap.ImageGeneration)
                )
                    m.capabilities = [
                        ...new Set([Cap.TextInput, ...m.capabilities])
                    ]
            const byName = new Map(
                [...c.models, ...additions].map((m) => [m.name, m])
            )
            const models = [...byName.values()]
            directories.set(c, models)
            c.requester.setModelCapabilities(models)
        }
        const explicit =
            state.config.providers.find((p) => p.platform === state.platform)
                ?.routes ?? []
        const names = new Set(
            [...directories.values()].flatMap((models) =>
                models.map((m) => m.name)
            )
        )
        for (const name of names) {
            // A duplicate name in a newly added source does not grant cross-source routing.
            const first = state.connections
                .filter((c) => directories.get(c)?.some((m) => m.name === name))
                .sort(
                    (a, b) =>
                        (a.config.sourcePriority ?? 0) -
                        (b.config.sourcePriority ?? 0)
                )[0]
            const origin =
                this.catalog.origin(state.platform, name) ??
                first.config.sourceId
            if (rememberOrigins)
                this.catalog.rememberOrigin(state.platform, name, origin)
            const candidates = state.connections
                .filter(
                    (c) =>
                        c.config.sourceId === origin &&
                        directories.get(c)?.some((m) => m.name === name)
                )
                .map((connection) => ({ connection, upstreamModel: name }))
            this.addRoute(result, name, candidates, directories, false)
        }
        for (const route of explicit) {
            const candidates = route.candidates.flatMap((candidate) =>
                state.connections
                    .filter(
                        (c) =>
                            c.config.sourceId === candidate.sourceId &&
                            (!candidate.credentialIds?.length ||
                                candidate.credentialIds.includes(
                                    c.config.credentialId
                                ))
                    )
                    .map((connection) => {
                        let info = directories
                            .get(connection)
                            .find((m) => m.name === candidate.upstreamModel)
                        // An explicit manual contract is required when model discovery is unavailable.
                        if (
                            !info &&
                            route.modelType &&
                            route.capabilities &&
                            route.contextSize
                        ) {
                            info = {
                                name: candidate.upstreamModel,
                                type: ModelType[route.modelType],
                                maxTokens: route.contextSize,
                                capabilities: protocolCapabilities(
                                    getProviderPreset(
                                        connection.config.provider
                                    ).adapter,
                                    route.capabilities,
                                    connection.config.responseApi
                                )
                            }
                            directories.get(connection).push(info)
                            connection.requester.setModelCapabilities(
                                directories.get(connection)
                            )
                        }
                        return {
                            connection,
                            upstreamModel: candidate.upstreamModel,
                            embeddingSpace: candidate.embeddingSpace
                        }
                    })
            )
            result.delete(route.model)
            this.addRoute(
                result,
                route.model,
                candidates,
                directories,
                route.allowFallback,
                route
            )
        }
        const blacklist = getTargetedBlacklist(
            state.config.blacklistModels,
            state.platform,
            state.providerId
        )
        for (const name of result.keys())
            if (blacklist.some((word) => name.toLowerCase().includes(word)))
                result.delete(name)
        return result
    }

    private addRoute(
        out: Map<string, Route>,
        name: string,
        candidates: Candidate[],
        dirs: Map<Connection, ModelInfo[]>,
        fallback: boolean,
        contract?: ModelRoute
    ) {
        const items = candidates
            .map((c) => ({
                candidate: c,
                info: dirs
                    .get(c.connection)
                    ?.find((m) => m.name === c.upstreamModel)
            }))
            .filter((p) => p.info)
        const first = items[0]?.info
        if (!first) return
        const type = contract?.modelType
            ? ModelType[contract.modelType]
            : first.type
        const capabilities =
            contract?.capabilities ??
            first.capabilities.filter((cap) =>
                items.every((i) => i.info.capabilities.includes(cap))
            )
        const valid = items.filter(
            (p) =>
                p.info.type === type &&
                capabilities.every((cap) => p.info.capabilities.includes(cap))
        )
        if (!valid.length) return
        if (
            type === ModelType.embeddings &&
            new Set(valid.map((p) => p.candidate.connection.config.sourceId))
                .size > 1 &&
            (!valid[0].candidate.embeddingSpace ||
                valid.some(
                    (p) =>
                        p.candidate.embeddingSpace !==
                        valid[0].candidate.embeddingSpace
                ))
        )
            return
        const maxTokens = Math.min(
            ...valid.map((p) => p.info.maxTokens || 4096),
            contract?.contextSize || Infinity
        )
        out.set(name, {
            info: { ...first, name, type, capabilities, maxTokens },
            candidates: valid.map((p) => p.candidate),
            allowFallback: fallback
        })
    }

    private limits(state: State, c: Connection): [string, number, number][] {
        const cfg = c.config
        const platform = cfg.platform
        const provider = state.config.providers.find(
            (p) => p.platform === platform
        )
        const limits: [string, number, number][] = [
            [
                `p:${platform}`,
                provider?.chatConcurrentMaxSize ?? 3,
                provider?.chatTimeLimit ?? 200
            ],
            [`s:${cfg.sourceId}`, cfg.chatConcurrentMaxSize, cfg.chatTimeLimit],
            [
                `k:${c.key}`,
                cfg.credentialConcurrentMaxSize ?? 3,
                cfg.credentialHourlyLimit ?? 200
            ]
        ]
        if (cfg.quotaGroup) {
            const peers = state.connections.filter(
                (p) => p.config.quotaGroup === cfg.quotaGroup
            )
            limits.push([
                `q:${platform}:${cfg.quotaGroup}`,
                Math.min(
                    ...peers.map(
                        (p) => p.config.credentialConcurrentMaxSize ?? 3
                    )
                ),
                Math.min(
                    ...peers.map((p) => p.config.credentialHourlyLimit ?? 200)
                )
            ])
        }
        return limits
    }

    private available(state: State, c: Connection) {
        if (c.authFailed || c.retryAt > Date.now()) return false
        return this.limits(state, c).every(([id, max, hourly]) => {
            const count = this.counters.get(id)
            if (!count) return true
            count.times = count.times.filter((at) => at > Date.now() - 3600000)
            return count.active < max && count.times.length < hourly
        })
    }

    private reserve(state: State, c: Connection) {
        const counters = this.limits(state, c).map(([id]) => {
            let count = this.counters.get(id)
            if (!count) {
                count = { active: 0, times: [] }
                this.counters.set(id, count)
            }
            count.active++
            count.times.push(Date.now())
            return count
        })
        this.active++
        return () => {
            for (const count of counters) count.active--
            this.active--
            this.collect()
        }
    }

    private pick(candidates: Candidate[], state: State, sticky?: string) {
        if (sticky) {
            const match = candidates.find((c) => c.connection.key === sticky)
            if (match) return match
        }
        const sources = [
            ...new Set(candidates.map((c) => c.connection.config.sourceId))
        ]
        if (!sources.length) return
        let source = sources[0]
        if (sticky)
            source =
                candidates.find((c) => c.connection.key === sticky)?.connection
                    .config.sourceId ?? source
        else if (state.config.configMode === 'balance') {
            // Smooth weighted round robin: the number of keys never changes source weight.
            let best = -Infinity
            let total = 0
            for (const id of sources) {
                const weight =
                    candidates.find((c) => c.connection.config.sourceId === id)
                        .connection.config.sourceWeight || 1
                total += weight
                const score =
                    (this.roundRobin.get(`weight:${id}`) ?? 0) + weight
                this.roundRobin.set(`weight:${id}`, score)
                if (score > best) {
                    best = score
                    source = id
                }
            }
            this.roundRobin.set(
                `weight:${source}`,
                this.roundRobin.get(`weight:${source}`) - total
            )
        }
        const keys = candidates.filter(
            (c) => c.connection.config.sourceId === source
        )
        const position = this.roundRobin.get(source) ?? 0
        this.roundRobin.set(source, position + 1)
        return keys[position % keys.length]
    }

    private fail(
        c: Connection,
        model: string,
        error: UpstreamFailure,
        state: State
    ) {
        c.error = error.message
        if (error.kind === 'auth') c.authFailed = true
        if (error.kind === 'permission' && model) c.denied.add(model)
        if (error.status === 429) {
            for (const peer of state.connections)
                if (
                    peer === c ||
                    (c.config.quotaGroup &&
                        peer.config.quotaGroup === c.config.quotaGroup)
                )
                    peer.retryAt = error.retryAt
        }
        if (error.status >= 500)
            for (const peer of state.connections)
                if (peer.config.sourceId === c.config.sourceId)
                    peer.retryAt = Date.now() + 10000
    }

    private owner(params: ModelRequestParams, candidates: Candidate[]) {
        const bindings = new Set<string>()
        for (const message of params.input) {
            const binding = message.additional_kwargs?.model_hub_connection
            if (typeof binding === 'string') bindings.add(binding)
        }
        if (bindings.size > 1)
            throw new Error('消息包含不同连接的远端资源，不能混合请求')
        const owner = [...bindings][0]
        if (owner && !candidates.some((c) => c.connection.key === owner))
            throw new Error(
                '资源所属源或 Key 代次已不可用，请新建会话或恢复原凭据'
            )
        const external = params.overrideRequestParams ?? {}
        const hasResource =
            external.previous_response_id ||
            external.cached_content ||
            external.cachedContent ||
            external.previous_interaction_id ||
            params.input.some(
                (message) =>
                    structuredResource(message.content) ||
                    structuredResource(message.additional_kwargs)
            )
        if (hasResource && !owner)
            throw new Error(
                '远端资源缺少连接归属，请使用原会话或明确选择源与 Key'
            )
        return owner
    }

    private scoped(c: Candidate) {
        const cfg = c.connection.config
        const adapter = getProviderPreset(cfg.provider).adapter
        return (
            adapter === 'dify' ||
            (adapter === 'gemini' &&
                (cfg.geminiApi === 'interactions' ||
                    cfg.geminiFileUpload ||
                    !!cfg.geminiCachedContent)) ||
            (['openai', 'openai-chat'].includes(adapter) &&
                (!!cfg.responseFileSearchVectorStoreIds?.length ||
                    cfg.responseApi ||
                    (adapter === 'openai' && /^gpt-6/i.test(c.upstreamModel))))
        )
    }

    private async *execute(
        params: any,
        operation: 'chat' | 'stream' | 'embeddings' | 'rerank'
    ): AsyncGenerator<any> {
        if (this.closed) throw new Error('此平台已停止或删除')
        const state = this.state
        const route = state.routes.get(params.model)
        if (!route)
            throw new Error(
                `模型 ${params.model} 没有可用路由，请刷新目录或配置手动模型`
            )
        if (operation === 'chat' || operation === 'stream') {
            const required = requiredCapabilities(params)
            const missing = required.filter(
                (cap) => !route.info.capabilities.includes(cap)
            )
            if (missing.length)
                throw new Error(
                    `模型路由不支持本次输入能力：${missing.join(', ')}；请配置满足能力的专用路由`
                )
        }
        const signal = AbortSignal.any([
            ...(params.signal ? [params.signal] : []),
            AbortSignal.timeout(
                Math.min(
                    params.timeout || state.config.timeout,
                    state.config.timeout
                )
            )
        ])
        const owner =
            operation === 'chat' || operation === 'stream'
                ? this.owner(params, route.candidates)
                : undefined
        let candidates = route.candidates.filter(
            (c) => !owner || c.connection.key === owner
        )
        candidates.sort(
            (a, b) =>
                (a.connection.config.sourcePriority ?? 0) -
                (b.connection.config.sourcePriority ?? 0)
        )
        if (!route.allowFallback && !owner) {
            const primary = candidates[0]?.connection.config.sourceId
            candidates = candidates.filter(
                (c) => c.connection.config.sourceId === primary
            )
        }
        candidates = candidates.filter(
            (c) =>
                !c.connection.config.resourceCredentialId ||
                (c.connection.config.credentialId ===
                    c.connection.config.resourceCredentialId &&
                    c.connection.config.credentialGeneration ===
                        c.connection.config.resourceCredentialGeneration)
        )
        if (!candidates.length)
            throw new Error(
                '固定资源所属 Key 或代次不可用，请确认资源归属并重新绑定'
            )
        const tried = new Set<string>()
        let last: unknown
        let emitted = false
        const maxAttempts = 1 + Math.max(0, state.config.maxRetries ?? 0)
        if (++this.queued > 100) {
            this.queued--
            throw new Error('Model Hub 请求队列已满')
        }
        try {
            for (let attempt = 0; attempt < maxAttempts; ) {
                signal.throwIfAborted()
                const eligible = candidates.filter(
                    (c) =>
                        !tried.has(c.connection.key) &&
                        !c.connection.denied.has(c.upstreamModel) &&
                        !c.connection.authFailed
                )
                if (!eligible.length)
                    throw last ?? new Error('没有具备模型权限的可用 Key')
                const ready = eligible.filter((c) =>
                    this.available(state, c.connection)
                )
                if (!ready.length) {
                    await pause(50, signal)
                    continue
                }
                const stickyKey = params.id
                    ? `${params.id}/${params.model}`
                    : undefined
                const candidate = this.pick(
                    ready,
                    state,
                    stickyKey ? this.sticky.get(stickyKey) : undefined
                )
                const c = candidate.connection
                const release = this.reserve(state, c)
                tried.add(c.key)
                attempt++
                try {
                    const override = params.overrideRequestParams
                        ? { ...params.overrideRequestParams }
                        : undefined
                    if (override?.model != null) {
                        const upstreamModel =
                            parseOpenAIModelNameWithReasoningEffort(
                                candidate.upstreamModel
                            ).model
                        if (
                            ![
                                params.model,
                                candidate.upstreamModel,
                                upstreamModel
                            ].includes(override.model)
                        )
                            throw new Error(
                                '请求 model 覆盖不能绕过模型路由；请显式配置上游模型映射'
                            )
                        override.model = upstreamModel
                    }
                    const bound = {
                        ...params,
                        model: candidate.upstreamModel,
                        signal,
                        ...(override ? { overrideRequestParams: override } : {})
                    }
                    let tagged = false
                    const tag = (chunk: any) => {
                        if (
                            chunk.message &&
                            this.scoped(candidate) &&
                            !tagged
                        ) {
                            chunk.message.additional_kwargs.model_hub_connection =
                                c.key
                            tagged = true
                        }
                        return chunk
                    }
                    if (operation === 'stream') {
                        const stream = c.requester.completionStream(bound)
                        try {
                            for (;;) {
                                const item = await this.attempt.run(
                                    signal,
                                    () => stream.next()
                                )
                                if (item.done) break
                                // Even metadata/tool-only output is observable. Never replay after yielding.
                                emitted = true
                                yield tag(item.value)
                            }
                        } finally {
                            await this.attempt.run(signal, () =>
                                stream.return(undefined)
                            )
                        }
                    } else {
                        const value = await this.attempt.run(signal, () =>
                            operation === 'chat'
                                ? c.requester.completion(bound)
                                : operation === 'embeddings'
                                  ? c.requester.embeddings(bound)
                                  : c.requester.rerank(bound)
                        )
                        emitted = true
                        yield tag(value)
                    }
                    if (stickyKey) {
                        this.sticky.set(stickyKey, c.key)
                        if (this.sticky.size > 1000)
                            this.sticky.delete(this.sticky.keys().next().value)
                    }
                    this.uses.set(params.model, Date.now())
                    if (this.uses.size > 200)
                        this.uses.delete(this.uses.keys().next().value)
                    c.error = undefined
                    return
                } catch (error) {
                    if (signal.aborted) throw signal.reason
                    const upstream = transportFailure(error)
                    if (upstream)
                        this.fail(c, candidate.upstreamModel, upstream, state)
                    // Only explicit upstream rejections are replay-safe. Ambiguous network/5xx errors are not.
                    if (
                        emitted ||
                        owner ||
                        this.scoped(candidate) ||
                        !upstream ||
                        !['auth', 'permission', 'rate'].includes(upstream.kind)
                    )
                        throw upstream ?? error
                    last = upstream
                } finally {
                    release()
                }
            }
            throw last ?? new Error('Model Hub 已达到总尝试次数上限')
        } finally {
            this.queued--
        }
    }

    async completion(params: ModelRequestParams) {
        for await (const result of this.execute(params, 'chat')) return result
    }
    async *completionStream(
        params: ModelRequestParams
    ): AsyncGenerator<ChatGenerationChunk> {
        yield* this.execute(params, 'stream')
    }
    async embeddings(params: EmbeddingsRequestParams) {
        for await (const result of this.execute(params, 'embeddings'))
            return result
    }
    async rerank(params: RerankerRequestParams) {
        for await (const result of this.execute(params, 'rerank')) return result
    }

    fileHandling(model: string) {
        const route = this.state.routes.get(model)
        if (!route) return undefined
        const configs = route.candidates
            .map((c) => {
                const adapter = getProviderPreset(
                    c.connection.config.provider
                ).adapter
                if (adapter === 'dify') {
                    const limits =
                        c.connection.requester.currentConfig().difyApps?.[
                            c.upstreamModel
                        ]?.parameters?.fileHandling
                    if (limits)
                        return {
                            ...limits,
                            supportedMimeTypes: new Set(
                                limits.supportedMimeTypes
                            )
                        }
                }
                const config = capabilityFileHandling(
                    adapter,
                    route.info.capabilities
                )
                if (
                    config &&
                    adapter === 'gemini' &&
                    c.connection.config.geminiFileUpload
                ) {
                    const limit =
                        Math.min(
                            c.connection.config.geminiMaxFileSizeMb ?? 64,
                            2048
                        ) *
                        1024 *
                        1024
                    return {
                        ...config,
                        maxTotalSizeBytes: limit,
                        maxFileSizeBytes: limit
                    }
                }
                return config
            })
            .filter(Boolean)
        if (!configs.length) return undefined
        const supportedMimeTypes = new Set(
            [...configs[0].supportedMimeTypes].filter((mime) =>
                configs.every((c) => c.supportedMimeTypes.has(mime))
            )
        )
        const overrides = Object.fromEntries(
            [...supportedMimeTypes].map((mime) => [
                mime,
                Math.min(
                    ...configs.map(
                        (c) =>
                            c.maxFileSizeBytesOverrides?.[mime] ??
                            c.maxFileSizeBytes
                    )
                )
            ])
        )
        return {
            supportedMimeTypes,
            maxFileSizeBytesOverrides: overrides,
            maxTotalSizeBytes: Math.min(
                ...configs.map((c) => c.maxTotalSizeBytes)
            ),
            maxFileSizeBytes: Math.min(
                ...configs.map((c) => c.maxFileSizeBytes)
            )
        }
    }

    platformFileHandling() {
        const configs = [...this.state.routes.keys()]
            .map((model) => this.fileHandling(model))
            .filter(Boolean)
        if (!configs.length) return null
        return {
            supportedMimeTypes: new Set(
                configs.flatMap((c) => [...c.supportedMimeTypes])
            ),
            maxTotalSizeBytes: Math.max(
                ...configs.map((c) => c.maxTotalSizeBytes)
            ),
            maxFileSizeBytes: Math.max(
                ...configs.map((c) => c.maxFileSizeBytes)
            )
        }
    }

    async resource(
        request: GeminiResourceRequest & {
            sourceId?: string
            credentialId?: string
        }
    ) {
        if (this.closed) throw new Error('此平台已停止或删除')
        if (!request.sourceId || !request.credentialId)
            throw new Error('资源操作必须选择具体连接源与 Key')
        const c = this.state.connections.find(
            (c) =>
                c.config.sourceId === request.sourceId &&
                c.config.credentialId === request.credentialId
        )
        if (!c) throw new Error('所选连接已禁用或删除')
        if (request.credentialGeneration !== c.config.credentialGeneration)
            throw new Error(
                '资源操作的 Key 代次已改变，请重新载入并确认资源归属'
            )
        const resourceKey = `${request.sourceId}/${request.credentialId}/${request.name ?? ''}`
        const old = this.catalog.resourceOwner(resourceKey)
        if (old && old !== c.key)
            throw new Error('资源属于旧凭据代次，请确认资源归属后重新操作')
        this.resourceRequests++
        try {
            const result = await c.requester.geminiResources().request(request)
            if (request.name) this.catalog.rememberResource(resourceKey, c.key)
            for (const item of [
                ...(result.files ?? []),
                ...(result.cachedContents ?? []),
                ...(result.name ? [result] : [])
            ]) {
                if (item.name)
                    this.catalog.rememberResource(
                        `${request.sourceId}/${request.credentialId}/${item.name}`,
                        c.key
                    )
            }
            try {
                await this.catalog.flush()
            } catch {
                throw new Error(
                    '远端操作已完成，但本地资源归属保存失败；请勿重复创建资源，检查缓存目录权限后刷新'
                )
            }
            return result
        } finally {
            this.resourceRequests--
            this.collect()
        }
    }

    async dispose(model?: string, id?: string) {
        if (model || id) {
            await Promise.all(
                this.state.connections.map((c) =>
                    c.requester.dispose(model, id)
                )
            )
            if (id)
                for (const key of this.sticky.keys())
                    if (key.startsWith(`${id}/`)) this.sticky.delete(key)
            return
        }
        if (this.closed) return
        this.closed = true
        for (const c of this.state.connections) this.retired.add(c)
        this.collect()
    }
}

function pause(ms: number, signal: AbortSignal) {
    return new Promise<void>((resolve, reject) => {
        signal.throwIfAborted()
        const done = () => {
            signal.removeEventListener('abort', abort)
            resolve()
        }
        const timer = setTimeout(done, ms)
        const abort = () => {
            clearTimeout(timer)
            signal.removeEventListener('abort', abort)
            reject(signal.reason)
        }
        signal.addEventListener('abort', abort, { once: true })
    })
}

function requiredCapabilities(params: ModelRequestParams): Cap[] {
    const required = new Set<Cap>()
    if (params.tools?.length) required.add(Cap.ToolCall)
    const types: Record<string, Cap> = {
        image_url: Cap.ImageInput,
        image: Cap.ImageInput,
        input_image: Cap.ImageInput,
        audio: Cap.AudioInput,
        audio_url: Cap.AudioInput,
        input_audio: Cap.AudioInput,
        video: Cap.VideoInput,
        video_url: Cap.VideoInput,
        file: Cap.FileInput,
        file_url: Cap.FileInput,
        input_file: Cap.FileInput
    }
    for (const message of params.input) {
        if (
            message.getType?.() === 'tool' ||
            message.additional_kwargs?.tool_calls?.length ||
            (message as any).tool_calls?.length
        )
            required.add(Cap.ToolCall)
        if (Array.isArray(message.content))
            for (const part of message.content) {
                if (types[part.type]) required.add(types[part.type])
            }
    }
    return [...required]
}

function structuredResource(value: unknown, depth = 0): boolean {
    if (!value || typeof value !== 'object' || depth > 12) return false
    if (Array.isArray(value))
        return value.some((part) => structuredResource(part, depth + 1))
    return Object.entries(value).some(([key, child]) => {
        if (
            [
                'file_id',
                'file_uri',
                'fileUri',
                'cachedContent',
                'cached_content',
                'previous_response_id',
                'previous_interaction_id'
            ].includes(key) &&
            typeof child === 'string' &&
            child &&
            !child.startsWith('data:')
        )
            return true
        return structuredResource(child, depth + 1)
    })
}

async function responseFailure(response: any, at: number) {
    let code = ''
    let param: string
    // Read at most 16 KiB; never log/return vendor text, headers, or request data.
    const reader = response.body?.getReader()
    if (reader) {
        try {
            const chunks: Uint8Array[] = []
            let length = 0
            while (length <= 16384) {
                const item = await reader.read()
                if (item.done) break
                length += item.value.length
                if (length <= 16384) chunks.push(item.value)
            }
            if (length <= 16384) {
                const data = JSON.parse(Buffer.concat(chunks).toString('utf8'))
                code = [data.error?.code, data.error?.type, data.error?.status]
                    .filter((c) => typeof c === 'string')
                    .join(' ')
                    .toLowerCase()
                const field = data.error?.param
                if (
                    [
                        'model',
                        'messages',
                        'tools',
                        'tool_choice',
                        'temperature',
                        'reasoning_effort',
                        'reasoning',
                        'max_tokens',
                        'max_completion_tokens',
                        'input',
                        'response_format'
                    ].includes(field)
                )
                    param = field
            }
        } catch {
        } finally {
            await reader.cancel().catch(() => {})
            reader.releaseLock()
        }
    }
    let kind: UpstreamFailure['kind'] =
        response.status === 401
            ? 'auth'
            : response.status === 429
              ? 'rate'
              : response.status >= 500
                ? 'source'
                : 'request'
    if ([403, 404].includes(response.status)) {
        if (/(invalid_api_key|authentication_error|api_key_invalid)/.test(code))
            kind = 'auth'
        else if (
            /(model_not_found|model_not_allowed|model_access_denied|permission_denied|permission_error)/.test(
                code
            )
        )
            kind = 'permission'
    }
    return new UpstreamFailure(response.status, at, kind, param)
}
