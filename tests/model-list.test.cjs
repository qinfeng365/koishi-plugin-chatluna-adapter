const { test } = require('node:test')
const assert = require('node:assert/strict')
require('@langchain/core/messages')
require('koishi-plugin-chatluna/llm-core/platform/types')
const load = require('./load-source.cjs')
load('capabilities.ts')
const { buildModelGroups, modelKey, normalizeFavorites, toggleFavorite } = load(
    '../client/model-list.ts'
)
const { ModelHubClient } = load('client.ts')
const { ModelHubRequester } = load('requester.ts')
const { ModelHubConsoleService } = load('index.ts')

const model = (name, extra = {}) => ({
    name,
    platform: 'hub-a',
    provider: 'Alpha',
    providerId: 'alpha',
    type: 'llm',
    maxTokens: 4096,
    capabilities: ['text_input'],
    source: 'api',
    ...extra
})
const filters = (extra = {}) => ({
    keyword: '',
    provider: '',
    type: '',
    capabilities: [],
    scope: 'all',
    favorites: [],
    ...extra
})

test('model browser keeps provider and platform identities, even for identical names', () => {
    const a = model('same')
    const b = model('same', { platform: 'hub-b' })
    const c = model('same', {
        provider: 'Beta',
        providerId: 'beta',
        platform: 'hub-b'
    })
    const groups = buildModelGroups([c, b, a], [], filters())
    assert.equal(groups.length, 3)
    assert.equal(new Set([a, b, c].map(modelKey)).size, 3)
    assert.deepEqual(
        groups.map((g) => [g.provider, g.platform]),
        [
            ['Alpha', 'hub-a'],
            ['Alpha', 'hub-b'],
            ['Beta', 'hub-b']
        ]
    )
    assert.equal(
        buildModelGroups([a, b, c], [], filters({ provider: 'beta' }))[0]
            .provider,
        'Beta'
    )
    const starred = buildModelGroups(
        [a, b, c],
        [],
        filters({ scope: 'favorites', favorites: [modelKey(b)] })
    )
    assert.equal(starred.length, 1)
    assert.equal(starred[0].platform, 'hub-b')
    assert.equal(starred[0].provider, 'Alpha')
})

test('only declared reasoning variants fold; capability and favorite filters preserve matching children', () => {
    const base = model('chat')
    const variant = model('chat-high-thinking', {
        reasoningVariantOf: 'chat',
        capabilities: ['text_input', 'thinking']
    })
    const genuine = model('other-high-thinking')
    const orphan = model('missing-low-thinking', {
        reasoningVariantOf: 'missing'
    })
    const groups = buildModelGroups(
        [variant, genuine, orphan, base],
        [],
        filters()
    )
    assert.equal(groups[0].families.length, 3)
    const family = groups[0].families.find((f) => f.primary.name === 'chat')
    assert.deepEqual(
        family.variants.map((m) => m.name),
        ['chat-high-thinking']
    )
    assert.equal(groups[0].count, 4)
    for (const filter of [
        filters({ capabilities: ['thinking'] }),
        filters({ scope: 'favorites', favorites: [modelKey(variant)] }),
        filters({ keyword: 'HIGH-THINKING', type: 'llm' })
    ]) {
        const shown = buildModelGroups([base, variant], [], filter)
        assert.equal(shown[0].families[0].primary.name, variant.name)
        assert.equal(shown[0].count, 1)
    }
})

test('compound filters use AND, recent ordering is deterministic, favorites survive missing catalog rows', () => {
    const a = model('a', {
        capabilities: ['image_input', 'tool_call'],
        lastUsedAt: 1
    })
    const b = model('b', { capabilities: ['image_input'], lastUsedAt: 2 })
    const never = model('c')
    assert.equal(
        buildModelGroups(
            [a, b, never],
            [],
            filters({ capabilities: ['image_input', 'tool_call'] })
        )[0].count,
        1
    )
    assert.deepEqual(
        buildModelGroups(
            [never, a, b],
            [],
            filters({ scope: 'recent' })
        )[0].families.map((f) => f.primary.name),
        ['b', 'a']
    )
    assert.deepEqual(normalizeFavorites([modelKey(a), modelKey(a), null, 1]), [
        modelKey(a)
    ])
    assert.deepEqual(toggleFavorite([modelKey(a)], modelKey(b)), [
        modelKey(a),
        modelKey(b)
    ])
    assert.deepEqual(toggleFavorite([modelKey(a)], modelKey(a)), [])
    assert.deepEqual(normalizeFavorites('invalid'), [])
    assert.deepEqual(
        buildModelGroups([], [], filters({ favorites: [modelKey(a)] })),
        []
    )
})

test('provider headings carry their own names, errors and last successful update', () => {
    const [group] = buildModelGroups(
        [model('a')],
        [
            {
                id: 'alpha',
                platform: 'hub-a',
                name: 'My account',
                modelsUpdatedAt: 10,
                error: 'offline'
            }
        ],
        filters()
    )
    assert.equal(group.label, 'My account')
    assert.equal(group.updatedAt, 10)
    assert.equal(group.error, 'offline')
})

test('console model snapshot preserves provider ID, explicit variant parent and actual usage', () => {
    const service = Object.create(ModelHubConsoleService.prototype)
    service._options = {
        getSettings: () => ({ additionalModels: [] }),
        runtime: { clients: new Map([['hub-a', { lastUsedAt: () => 123 }]]) }
    }
    service.ctx = {
        chatluna: {
            platform: {
                listPlatformModels: () => ({
                    value: [
                        {
                            name: 'chat-high-thinking',
                            type: 1,
                            maxTokens: 4096,
                            capabilities: ['thinking'],
                            reasoningVariantOf: 'chat'
                        }
                    ]
                })
            }
        }
    }
    const [entry] = service._modelsFor({
        platform: 'hub-a',
        provider: { id: 'alpha', name: 'Alpha' }
    })
    assert.equal(entry.providerId, 'alpha')
    assert.equal(entry.reasoningVariantOf, 'chat')
    assert.equal(entry.lastUsedAt, 123)
})

test('failed model reload restores the exact last successful cache and timestamp', async () => {
    const client = Object.create(ModelHubClient.prototype)
    const cached = { chat: model('chat') }
    client._modelInfos = cached
    client.modelsUpdatedAt = 42
    client.getModels = async () => {
        client._modelInfos = {}
        throw new Error('offline')
    }
    await assert.rejects(client.reloadModels(), /offline/)
    assert.equal(client._modelInfos, cached)
    assert.equal(client.modelsUpdatedAt, 42)
})

function requester(adapter) {
    const instance = Object.create(ModelHubRequester.prototype)
    instance._recentModels = new Map()
    instance._adapter = () => adapter
    instance._prepareParams = async (params) => params
    instance.ctx = {}
    return instance
}

test('recent usage records successful requests, not failures, broken streams or early cancellation', async () => {
    const request = requester({
        embeddings: async () => [],
        rerank: async () => {
            throw new Error('failed')
        },
        completionStreamInternal: async function* (_r, params) {
            yield {}
            if (params.model === 'broken') throw new Error('failed')
        }
    })
    await request.embeddings({ model: 'embed' })
    assert.ok(request.lastUsedAt('embed') > 0)
    await assert.rejects(request.rerank({ model: 'failed' }))
    assert.equal(request.lastUsedAt('failed'), undefined)
    const stream = request.completionStreamInternal({ model: 'cancelled' })
    await stream.next()
    await stream.return()
    assert.equal(request.lastUsedAt('cancelled'), undefined)
    await assert.rejects(async () => {
        for await (const _ of request.completionStreamInternal({
            model: 'broken'
        })) {
        }
    })
    assert.equal(request.lastUsedAt('broken'), undefined)
    for await (const _ of request.completionStreamInternal({ model: 'ok' })) {
    }
    assert.ok(request.lastUsedAt('ok') > 0)
})

test('recent usage stays bounded, console refresh is coalesced, and full disposal clears it', async () => {
    const request = requester({ embeddings: async () => [] })
    let refreshes = 0,
        callbacks = [],
        cancellations = 0
    request.ctx = {
        setTimeout: (callback) => {
            callbacks.push(callback)
            return () => cancellations++
        },
        get: () => ({ refresh: async () => refreshes++ })
    }
    request._geminiResources = { dispose() {} }
    for (let i = 0; i < 205; i++) await request.embeddings({ model: 'm' + i })
    assert.equal(request._recentModels.size, 200)
    assert.equal(request.lastUsedAt('m0'), undefined)
    assert.equal(callbacks.length, 1)
    callbacks[0]()
    assert.equal(refreshes, 1)
    await request.embeddings({ model: 'm206' })
    await request.dispose()
    assert.equal(cancellations, 1)
    assert.equal(request._recentModels.size, 0)
    await request.embeddings({ model: 'after-dispose' })
    assert.equal(request.lastUsedAt('after-dispose'), undefined)
})
