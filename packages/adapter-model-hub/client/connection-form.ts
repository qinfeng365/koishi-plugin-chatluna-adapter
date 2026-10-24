import type {
    ConsoleProviderEntry,
    ConsoleSourceConnection,
    ConsoleSourceCredential
} from 'koishi-plugin-chatluna-model-hub-adapter'

let serial = 0
export const temporaryId = () => `new-${Date.now()}-${++serial}`
export function newCredential(): ConsoleSourceCredential {
    return {
        id: temporaryId(),
        name: '新 Key',
        apiKey: '',
        hasApiKey: false,
        apiKeyPreview: '',
        enabled: true,
        generation: 1,
        secretAction: 'clear',
        concurrentMaxSize: 3,
        hourlyLimit: 200
    }
}
export function newSource(
    provider: ConsoleProviderEntry
): ConsoleSourceConnection {
    return {
        id: temporaryId(),
        name: '新连接',
        provider: provider.provider,
        apiEndpoint: provider.apiEndpoint,
        enabled: true,
        pullModels: true,
        priority: provider.sources?.length ?? 0,
        weight: 1,
        settings: {},
        credentials: [newCredential()]
    }
}
/** Used by both clone and clipboard export, including unsaved edits. */
export function withoutProviderSecrets(
    provider: ConsoleProviderEntry
): ConsoleProviderEntry {
    const next: ConsoleProviderEntry = JSON.parse(JSON.stringify(provider))
    next.id = undefined
    next.apiKey = ''
    next.apiKeyPreview = ''
    next.hasApiKey = false
    next.clearApiKey = false
    const clearHeader = (h: ConsoleProviderEntry['customHeaders'][number]) => ({
        ...h,
        id: undefined,
        value: '',
        valuePreview: '',
        hasValue: false,
        clearValue: false
    })
    next.customHeaders = next.customHeaders.map(clearHeader)
    next.geminiCachedContent = ''
    next.responseFileSearchVectorStoreIds = []
    const sources = new Map<string, string>()
    const keys = new Map<string, string>()
    for (const source of next.sources ?? []) {
        const sourceId = temporaryId()
        sources.set(source.id, sourceId)
        source.id = sourceId
        delete source.resourceCredentialId
        delete source.resourceCredentialGeneration
        source.settings.customHeaders =
            source.settings.customHeaders?.map(clearHeader)
        delete source.settings.geminiCachedContent
        delete source.settings.responseFileSearchVectorStoreIds
        for (const c of source.credentials) {
            const id = temporaryId()
            keys.set(c.id, id)
            c.id = id
            c.apiKey = ''
            c.apiKeyPreview = ''
            c.hasApiKey = false
            c.generation = 1
            c.secretAction = 'clear'
        }
    }
    for (const route of next.routes ?? [])
        for (const candidate of route.candidates) {
            candidate.sourceId =
                sources.get(candidate.sourceId) ?? candidate.sourceId
            candidate.credentialIds = candidate.credentialIds?.map(
                (id) => keys.get(id) ?? id
            )
        }
    return next
}
