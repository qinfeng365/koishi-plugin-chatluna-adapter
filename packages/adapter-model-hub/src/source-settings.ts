import { randomUUID } from 'crypto'
import { getProviderPreset } from './providers'
import { ModelCapabilities } from 'koishi-plugin-chatluna/llm-core/platform/types'
import type {
    ConnectionSettings,
    HeaderEntry,
    ModelHubSettings,
    ModelRoute,
    ProviderEntry,
    SourceConnection,
    SourceCredential
} from './types'

function idFor(
    value: unknown,
    previous: { id: string } | undefined,
    editing: boolean,
    ids: Set<string>
) {
    const input = typeof value === 'string' ? value : ''
    if (input && ids.has(input)) throw new Error('源或凭据 ID 重复')
    if (input) ids.add(input)
    const id = previous?.id ?? (!editing && input ? input : randomUUID())
    ids.add(id)
    return id
}

const str = (value: unknown) => (typeof value === 'string' ? value.trim() : '')
const number = (value: unknown, fallback: number, min = 1, max = 10000) =>
    typeof value === 'number' && Number.isFinite(value)
        ? Math.max(min, Math.min(max, Math.floor(value)))
        : fallback

export function normalizeSources(
    provider: ProviderEntry,
    old: ProviderEntry | undefined,
    previous: ModelHubSettings | undefined,
    ids: Set<string>,
    settings: (
        input: Record<string, unknown>,
        prior?: Partial<ConnectionSettings>
    ) => Partial<ConnectionSettings>
): SourceConnection[] {
    const sources = provider.sources ?? [
        {
            id: '',
            name: '默认连接',
            provider: provider.provider,
            apiEndpoint: provider.apiEndpoint,
            enabled: true,
            pullModels: provider.pullModels,
            priority: 0,
            weight: 1,
            settings: {},
            credentials: [
                {
                    id: '',
                    name: 'Key 1',
                    apiKey: provider.apiKey,
                    enabled: true,
                    generation: 1
                }
            ]
        }
    ]
    if (sources.length > 100) throw new Error('每个平台最多 100 个源')
    return sources.map((raw) => {
        const prior = old?.sources?.find((source) => source.id === raw.id)
        if (
            !prior &&
            previous?.providers.some((p) =>
                p.sources?.some((s) => s.id === raw.id)
            )
        )
            throw new Error('源不属于此平台')
        const preset = getProviderPreset(str(raw.provider) || provider.provider)
        const endpoint = str(raw.apiEndpoint) || preset.defaultEndpoint
        const url = new URL(endpoint)
        if (
            !['http:', 'https:'].includes(url.protocol) ||
            url.username ||
            url.password ||
            url.search ||
            url.hash
        )
            throw new Error(
                '源地址必须是 HTTP(S) 基础地址；认证请使用 Key 或请求头'
            )
        if (!Array.isArray(raw.credentials) || raw.credentials.length > 200)
            throw new Error('凭据列表无效，每个源最多 200 个 Key')
        const sourceId = idFor(raw.id, prior, !!previous, ids)
        const nextSettings = settings(
            { ...(raw.settings ?? {}), provider: preset.id },
            prior?.settings
        )
        const authChanged =
            !!prior &&
            JSON.stringify(
                nextSettings.customHeaders ?? provider.customHeaders
            ) !==
                JSON.stringify(
                    prior.settings.customHeaders ?? old?.customHeaders
                )
        const credentials = raw.credentials.map((input): SourceCredential => {
            const prev = prior?.credentials.find(
                (credential) => credential.id === input.id
            )
            if (
                !prev &&
                previous?.providers.some((p) =>
                    p.sources?.some((s) =>
                        s.credentials.some((c) => c.id === input.id)
                    )
                )
            )
                throw new Error('凭据不属于此连接源')
            const action = (input as unknown as { secretAction?: string })
                .secretAction
            if (action && !['keep', 'replace', 'clear'].includes(action))
                throw new Error('密钥操作无效')
            if (action === 'replace' && !str(input.apiKey))
                throw new Error('替换密钥不能为空；清空请使用清除操作')
            if (action === 'keep' && str(input.apiKey))
                throw new Error('保留密钥时不能同时提交新密钥')
            const apiKey =
                action === 'clear'
                    ? ''
                    : action === 'keep'
                      ? (prev?.apiKey ?? '')
                      : str(input.apiKey) || prev?.apiKey || ''
            const organization = str(input.organization)
            const project = str(input.project)
            const changed =
                prev &&
                (apiKey !== prev.apiKey ||
                    organization !== (prev.organization ?? '') ||
                    project !== (prev.project ?? '') ||
                    endpoint.replace(/\/+$/, '') !== prior?.apiEndpoint ||
                    preset.id !== prior?.provider ||
                    authChanged)
            return {
                id: idFor(input.id, prev, !!previous, ids),
                name: str(input.name).slice(0, 100) || 'Key',
                apiKey,
                enabled: input.enabled !== false,
                generation: prev
                    ? prev.generation + (changed ? 1 : 0)
                    : previous
                      ? 1
                      : number(input.generation, 1),
                organization,
                project,
                quotaGroup: str(input.quotaGroup).slice(0, 100),
                concurrentMaxSize: number(input.concurrentMaxSize, 3, 1, 200),
                hourlyLimit: number(input.hourlyLimit, 200, 1, 1000000)
            }
        })
        const explicit = str(raw.resourceCredentialId)
        const oldIndex = raw.credentials.findIndex((c) => c.id === explicit)
        const resourceId = oldIndex >= 0 ? credentials[oldIndex].id : explicit
        const staticResource =
            preset.adapter === 'gemini'
                ? (nextSettings.geminiCachedContent ??
                  provider.geminiCachedContent)
                : ['openai', 'openai-chat'].includes(preset.adapter)
                  ? (
                        nextSettings.responseFileSearchVectorStoreIds ??
                        provider.responseFileSearchVectorStoreIds
                    )?.length
                  : false
        const selectedId =
            resourceId ||
            (staticResource
                ? prior?.resourceCredentialId || credentials[0]?.id
                : undefined)
        const selectedKey = credentials.find((c) => c.id === selectedId)
        if (selectedId && !selectedKey)
            throw new Error('固定资源引用的 Key 已删除，请先调整资源绑定')
        const resourceGeneration = selectedId
            ? prior?.resourceCredentialId === selectedId
                ? number(
                      raw.resourceCredentialGeneration,
                      prior.resourceCredentialGeneration ??
                          selectedKey.generation
                  )
                : selectedKey.generation
            : undefined
        if (resourceGeneration > selectedKey?.generation)
            throw new Error('资源绑定的凭据代次无效')
        return {
            id: sourceId,
            name: str(raw.name).slice(0, 100) || '连接源',
            provider: preset.id,
            resourceCredentialId: selectedId,
            resourceCredentialGeneration: resourceGeneration,
            apiEndpoint: endpoint.replace(/\/+$/, ''),
            enabled: raw.enabled !== false,
            pullModels: raw.pullModels !== false,
            priority: number(raw.priority, 0, 0),
            weight: number(raw.weight, 1),
            settings: nextSettings,
            credentials
        }
    })
}

export function normalizeRoutes(
    routes: ModelRoute[] | undefined,
    sources: SourceConnection[]
): ModelRoute[] {
    const names = new Set<string>()
    return (routes ?? []).map((route) => {
        const model = str(route.model)
        if (!model || names.has(model))
            throw new Error('模型路由名称为空或重复')
        names.add(model)
        if (!Array.isArray(route.candidates) || !route.candidates.length)
            throw new Error(`路由 ${model} 缺少候选源`)
        const candidates = route.candidates.map((candidate) => {
            const source = sources.find((s) => s.id === candidate.sourceId)
            if (!source)
                throw new Error(
                    `路由 ${model} 引用了已删除的源，请先移除路由候选`
                )
            const credentialIds = candidate.credentialIds?.filter((id) => {
                if (!source.credentials.some((c) => c.id === id))
                    throw new Error(`路由 ${model} 的 Key 不属于所选源`)
                return true
            })
            const upstreamModel = str(candidate.upstreamModel)
            if (!upstreamModel) throw new Error(`路由 ${model} 缺少上游模型 ID`)
            return {
                sourceId: source.id,
                credentialIds,
                upstreamModel,
                embeddingSpace: str(candidate.embeddingSpace) || undefined
            }
        })
        if (
            route.modelType === 'embeddings' &&
            new Set(candidates.map((c) => c.sourceId)).size > 1 &&
            (!candidates[0].embeddingSpace ||
                candidates.some(
                    (c) => c.embeddingSpace !== candidates[0].embeddingSpace
                ))
        )
            throw new Error(
                `Embedding 路由 ${model} 跨源必须声明相同语义空间与版本`
            )
        if (
            route.capabilities &&
            (!Array.isArray(route.capabilities) ||
                route.capabilities.some(
                    (c) => !Object.values(ModelCapabilities).includes(c)
                ))
        )
            throw new Error(`路由 ${model} 的能力声明无效`)
        return {
            model,
            candidates,
            allowFallback: route.allowFallback === true,
            modelType: ['llm', 'embeddings', 'reranker'].includes(
                route.modelType
            )
                ? route.modelType
                : undefined,
            capabilities: Array.isArray(route.capabilities)
                ? [
                      ...new Set(
                          route.capabilities.filter(
                              (c) => typeof c === 'string'
                          )
                      )
                  ]
                : undefined,
            contextSize: route.contextSize
                ? number(route.contextSize, 0, 1, 100000000)
                : undefined
        }
    })
}

export function maskSources(
    sources: SourceConnection[],
    preview: (value: string) => string,
    maskHeader: (header: HeaderEntry) => any
) {
    return sources.map((source) => ({
        ...structuredClone(source),
        settings: {
            ...structuredClone(source.settings),
            customHeaders: source.settings.customHeaders?.map(maskHeader)
        },
        credentials: source.credentials.map((c) => ({
            ...c,
            apiKey: '',
            hasApiKey: !!c.apiKey,
            apiKeyPreview: preview(c.apiKey),
            secretAction: 'keep' as const
        }))
    }))
}
