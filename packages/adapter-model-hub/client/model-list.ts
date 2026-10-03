import type {
    ModelHubConsoleModel,
    ModelHubConsoleProvider
} from 'koishi-plugin-chatluna-model-hub-adapter'

export type ModelListScope = 'all' | 'favorites' | 'recent'

export interface ModelListFilters {
    keyword: string
    provider: string
    type: string
    capabilities: string[]
    scope: ModelListScope
    favorites: readonly string[]
}

export function modelKey(model: ModelHubConsoleModel) {
    return JSON.stringify([
        model.providerId ?? model.provider,
        model.platform,
        model.type,
        model.name
    ])
}

export function providerKey(model: ModelHubConsoleModel) {
    return model.providerId ?? model.provider
}

export function normalizeFavorites(value: unknown): string[] {
    if (!Array.isArray(value)) return []
    return [
        ...new Set(
            value.filter((item): item is string => typeof item === 'string')
        )
    ]
}

export function toggleFavorite(value: unknown, key: string) {
    const keys = normalizeFavorites(value)
    return keys.includes(key)
        ? keys.filter((item) => item !== key)
        : [...keys, key]
}

export function buildModelGroups(
    models: readonly ModelHubConsoleModel[],
    providers: readonly ModelHubConsoleProvider[],
    filters: ModelListFilters
) {
    const favorites = new Set(filters.favorites)
    const keyword = filters.keyword.trim().toLowerCase()
    const matches = (model: ModelHubConsoleModel) =>
        (!filters.provider || providerKey(model) === filters.provider) &&
        (!filters.type || model.type.toLowerCase() === filters.type) &&
        filters.capabilities.every((capability) =>
            model.capabilities?.some((item) => String(item) === capability)
        ) &&
        (filters.scope !== 'favorites' || favorites.has(modelKey(model))) &&
        (filters.scope !== 'recent' || (model.lastUsedAt ?? 0) > 0) &&
        (!keyword ||
            [model.name, model.provider, model.platform]
                .join(' ')
                .toLowerCase()
                .includes(keyword))
    const compare = (a: ModelHubConsoleModel, b: ModelHubConsoleModel) =>
        (filters.scope === 'recent'
            ? (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0)
            : 0) ||
        Number(favorites.has(modelKey(b))) -
            Number(favorites.has(modelKey(a))) ||
        a.name.localeCompare(b.name) ||
        a.type.localeCompare(b.type)
    // Only server-declared variants with an existing base are folded. A real
    // model whose ID happens to end in "-high-thinking" is never guessed away.
    const allKeys = new Set(models.map(modelKey))
    const families = new Map<string, ModelHubConsoleModel[]>()
    for (const model of models) {
        if (!matches(model)) continue
        const base = model.reasoningVariantOf
        const key =
            base && allKeys.has(modelKey({ ...model, name: base }))
                ? modelKey({ ...model, name: base })
                : modelKey(model)
        const family = families.get(key) ?? []
        family.push(model)
        families.set(key, family)
    }
    const grouped = new Map<
        string,
        {
            key: string
            provider: string
            platform: string
            label: string
            updatedAt?: number
            error?: string
            families: {
                key: string
                primary: ModelHubConsoleModel
                variants: ModelHubConsoleModel[]
                lastUsedAt: number
            }[]
            count: number
        }
    >()
    for (const [key, members] of families) {
        members.sort(compare)
        const base = members.find((model) => modelKey(model) === key)
        const primary = base ?? members[0]
        const groupKey = JSON.stringify([
            providerKey(primary),
            primary.platform
        ])
        let group = grouped.get(groupKey)
        if (!group) {
            const runtime = providers.find(
                (item) =>
                    item.platform === primary.platform &&
                    (!primary.providerId || item.id === primary.providerId)
            )
            group = {
                key: groupKey,
                provider: primary.provider,
                platform: primary.platform,
                label: runtime?.name || primary.provider,
                updatedAt: runtime?.modelsUpdatedAt,
                error: runtime?.error,
                families: [],
                count: 0
            }
            grouped.set(groupKey, group)
        }
        group.count += members.length
        group.families.push({
            key,
            primary,
            variants: members.filter((model) => model !== primary),
            lastUsedAt: Math.max(
                ...members.map((model) => model.lastUsedAt ?? 0)
            )
        })
    }
    for (const group of grouped.values()) {
        group.families.sort(
            (a, b) =>
                (filters.scope === 'recent'
                    ? b.lastUsedAt - a.lastUsedAt
                    : 0) ||
                Number(
                    [b.primary, ...b.variants].some((m) =>
                        favorites.has(modelKey(m))
                    )
                ) -
                    Number(
                        [a.primary, ...a.variants].some((m) =>
                            favorites.has(modelKey(m))
                        )
                    ) ||
                a.primary.name.localeCompare(b.primary.name)
        )
    }
    return [...grouped.values()].sort(
        (a, b) =>
            a.provider.localeCompare(b.provider) ||
            a.platform.localeCompare(b.platform)
    )
}
