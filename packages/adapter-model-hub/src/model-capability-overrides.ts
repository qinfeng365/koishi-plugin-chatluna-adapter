import { ModelCapabilities as Cap } from 'koishi-plugin-chatluna/llm-core/platform/types'
import type {
    ModelCapabilityOverrideEntry,
    ModelHubSettings,
    ProviderEntry,
    ProviderModelEntry
} from './types'

export function normalizeModelCapabilityOverrides(
    input: unknown,
    providers: readonly ProviderEntry[]
): ModelCapabilityOverrideEntry[] {
    if (input == null) return []
    if (!Array.isArray(input) || input.length > 5000)
        throw new Error('模型能力覆盖无效，最多保存 5000 条')
    const scopes = new Set(
        providers.flatMap((p) =>
            (p.sources ?? []).flatMap((s) =>
                s.credentials.map((c) =>
                    JSON.stringify([
                        p.provider,
                        p.platform,
                        s.id,
                        s.provider,
                        c.id
                    ])
                )
            )
        )
    )
    const capabilities = new Set(Object.values(Cap))
    const result = new Map<string, ModelCapabilityOverrideEntry>()
    for (const entry of input) {
        if (!entry || typeof entry !== 'object')
            throw new Error('模型能力覆盖条目无效')
        const {
            providerId,
            platform,
            sourceId,
            sourceProviderId,
            credentialId,
            model
        } = entry
        if (
            ![
                providerId,
                platform,
                sourceId,
                sourceProviderId,
                credentialId,
                model
            ].every((s) => typeof s === 'string' && s.trim().length > 0) ||
            model.length > 512
        )
            throw new Error('模型能力覆盖缺少有效范围或模型 ID')
        // Removed/replaced scopes must not transplant corrections to another source.
        if (
            !scopes.has(
                JSON.stringify([
                    providerId,
                    platform,
                    sourceId,
                    sourceProviderId,
                    credentialId
                ])
            )
        )
            continue
        if (
            !entry.overrides ||
            typeof entry.overrides !== 'object' ||
            Array.isArray(entry.overrides)
        )
            throw new Error('模型能力覆盖必须是布尔值映射')
        const overrides: ModelCapabilityOverrideEntry['overrides'] = {}
        for (const [capability, supported] of Object.entries(entry.overrides)) {
            if (
                !capabilities.has(capability as Cap) ||
                typeof supported !== 'boolean'
            )
                throw new Error('模型能力覆盖含未知能力或非布尔值')
            overrides[capability as Cap] = supported
        }
        if (!Object.keys(overrides).length) continue
        const scope = {
            providerId,
            platform,
            sourceId,
            sourceProviderId,
            credentialId,
            model,
            overrides
        }
        result.set(
            JSON.stringify([
                providerId,
                platform,
                sourceId,
                sourceProviderId,
                credentialId,
                model
            ]),
            scope
        )
    }
    return [...result.values()]
}

export function manualModelCapabilities(
    settings: Pick<ModelHubSettings, 'modelCapabilityOverrides'>,
    scope: Omit<ModelCapabilityOverrideEntry, 'model' | 'overrides'>,
    model: Pick<ProviderModelEntry, 'name' | 'reasoningVariantOf'>
): ModelCapabilityOverrideEntry['overrides'] {
    const matches = (settings.modelCapabilityOverrides ?? []).filter(
        (entry) =>
            entry.providerId === scope.providerId &&
            entry.platform === scope.platform &&
            entry.sourceId === scope.sourceId &&
            entry.sourceProviderId === scope.sourceProviderId &&
            entry.credentialId === scope.credentialId
    )
    return {
        ...matches.find((e) => e.model === model.reasoningVariantOf)?.overrides,
        ...matches.find((e) => e.model === model.name)?.overrides
    }
}

/** Apply after automatic inference; auto means absence, not a saved guess. */
export function applyManualModelCapabilities<T extends ProviderModelEntry>(
    model: T,
    overrides: ModelCapabilityOverrideEntry['overrides']
): T & Pick<ProviderModelEntry, 'capabilityOverrides'> {
    const capabilities = new Set(model.capabilities ?? [])
    for (const [capability, supported] of Object.entries(overrides)) {
        if (supported) capabilities.add(capability as Cap)
        else capabilities.delete(capability as Cap)
    }
    return {
        ...model,
        capabilities: [...capabilities],
        capabilityOverrides: { ...model.capabilityOverrides, ...overrides }
    }
}
