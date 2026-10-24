const { test } = require('node:test')
const assert = require('node:assert/strict')
const {
    mkdtemp,
    readFile,
    writeFile,
    readdir,
    rm
} = require('node:fs/promises')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const {
    HumanMessage,
    AIMessage,
    AIMessageChunk
} = require('@langchain/core/messages')
const {
    ModelCapabilities: Cap
} = require('koishi-plugin-chatluna/llm-core/platform/types')
const load = require('./load-source.cjs')
load('capabilities.ts')
const {
    normalizeSettings,
    toConsoleSettings,
    createResolvedConfig,
    ModelHubSettingsStore
} = load('settings.ts')
const { resolveRuntimeProviders } = load('providers/index.ts')
const { ModelHubRouter, retryAfter } = load('router.ts')
const { ConnectionCatalogStore } = load('connection-catalog.ts')
const { withoutProviderSecrets } = load('../client/connection-form.ts')
const { ModelHubConsoleService } = load('index.ts')
const log = { warn() {}, info() {}, error() {}, debug() {} }
const model = (name, vision = true) => ({
    id: name,
    supports_image_in: vision,
    tool_call: true,
    context_length: 8192
})

function source(id, keys = ['one'], options = {}) {
    return {
        id,
        name: id,
        provider: 'openai-compatible',
        apiEndpoint: `https://${id}.test/v1`,
        enabled: true,
        pullModels: true,
        priority: 0,
        weight: 1,
        settings: {},
        credentials: keys.map((key, index) => ({
            id: `${id}-key-${index}`,
            name: `Key ${index + 1}`,
            apiKey: key,
            enabled: true,
            generation: 1
        })),
        ...options
    }
}
function settings(sources, routes = []) {
    return normalizeSettings({
        schemaVersion: 2,
        revision: 0,
        providers: [
            {
                id: 'platform-id',
                provider: 'openai-compatible',
                platform: 'hub-test',
                apiKey: '',
                apiEndpoint: 'https://a.test/v1',
                enabled: true,
                pullModels: true,
                timeout: 1000,
                maxRetries: 4,
                sources,
                routes
            }
        ],
        additionalModels: [],
        blacklistModels: []
    })
}
function fixture(sources, routes = [], respond, catalog) {
    const requests = []
    const cache = new Map()
    const ctx = {
        on() {},
        setInterval() {},
        logger: log,
        get() {},
        chatluna: {
            config: {},
            currentConfig: { isLog: false },
            cache: {
                async get(_table, key) {
                    return cache.get(key)
                },
                async set(_table, key, value) {
                    cache.set(key, value)
                },
                async delete(_table, key) {
                    cache.delete(key)
                }
            }
        }
    }
    const config = settings(sources, routes)
    const runtime = resolveRuntimeProviders(config.providers)[0]
    const plugin = {
        platformConfigPool: {
            getConfig: () => ({ value: runtime.entries[0] })
        },
        config: {},
        async fetch(url, init, proxy) {
            const headers = new Headers(init.headers)
            const body = init.body ? JSON.parse(init.body) : undefined
            const req = {
                url,
                headers,
                body,
                proxy,
                signal: init.signal,
                transportConfig: this.config
            }
            requests.push(req)
            if (respond) {
                const res = await respond(req)
                if (res) return res
            }
            if (url.endsWith('/models'))
                return Response.json({
                    data: [model('shared'), model(new URL(url).hostname)]
                })
            if (body?.stream)
                return new Response(
                    'data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n',
                    { headers: { 'content-type': 'text/event-stream' } }
                )
            return Response.json({
                choices: [{ message: { role: 'assistant', content: 'ok' } }]
            })
        }
    }
    const resolved = createResolvedConfig(
        { webui: true },
        config,
        config.providers[0]
    )
    const router = new ModelHubRouter(
        ctx,
        resolved,
        plugin,
        runtime,
        { enhance: (_p, m) => m, getMaxTokens: () => undefined },
        catalog
    )
    return {
        router,
        config,
        requests,
        resolved,
        cache,
        update(next) {
            const rt = resolveRuntimeProviders(next.providers)[0]
            router.activate(
                router.prepare(
                    createResolvedConfig(
                        { webui: true },
                        next,
                        next.providers[0]
                    ),
                    rt
                )
            )
        }
    }
}
const chat = (extra = {}) => ({
    model: 'shared',
    input: [new HumanMessage('hello')],
    ...extra
})
const route = (allowFallback = false) => [
    {
        model: 'public',
        allowFallback,
        candidates: [
            { sourceId: 'a', upstreamModel: 'shared' },
            { sourceId: 'b', upstreamModel: 'shared' }
        ]
    }
]

test('legacy same-signature keys migrate without losing references; differing endpoints retain old split platforms', () => {
    const base = {
        provider: 'openai-compatible',
        platform: 'hub',
        apiEndpoint: 'https://a.test/v1',
        apiKey: 'one',
        enabled: true
    }
    const migrated = normalizeSettings({
        providers: [
            base,
            { ...base, apiKey: 'two' },
            { ...base, apiEndpoint: 'https://b.test/v1' }
        ]
    })
    assert.deepEqual(
        migrated.providers.map((p) => p.platform),
        ['hub', 'hub-openai-compatible']
    )
    assert.deepEqual(
        migrated.providers[0].sources[0].credentials.map((c) => c.apiKey),
        ['one', 'two']
    )
    assert.equal(
        migrated.providers[1].sources[0].apiEndpoint,
        'https://b.test/v1'
    )
})

test('source/key reorder and rename preserve secrets by identity, explicit replace increments generation', () => {
    const old = settings([source('a', ['one', 'two']), source('b', ['three'])])
    const payload = toConsoleSettings(old)
    payload.providers[0].name = 'renamed'
    payload.providers[0].sources.reverse()
    payload.providers[0].sources[1].credentials.reverse()
    payload.providers[0].sources[0].credentials[0].apiKey = 'new'
    payload.providers[0].sources[0].credentials[0].secretAction = 'replace'
    const next = normalizeSettings(payload, old)
    assert.deepEqual(
        next.providers[0].sources[1].credentials.map((c) => c.apiKey),
        ['two', 'one']
    )
    assert.equal(next.providers[0].sources[0].credentials[0].apiKey, 'new')
    assert.equal(next.providers[0].sources[0].credentials[0].generation, 2)
    assert.equal(next.providers[0].sources[1].credentials[0].generation, 1)
})

test('credentials cannot be transplanted across source ownership, duplicate IDs rejected', () => {
    const old = settings([source('a'), source('b', ['two'])])
    const next = toConsoleSettings(old)
    next.providers[0].sources[1].credentials =
        next.providers[0].sources[0].credentials
    assert.throws(() => normalizeSettings(next, old), /不属于|重复/)
})

test('console serialization redacts nested secrets including unsaved header scope; new IDs are backend-issued', () => {
    const initial = settings([
        source('a', ['very-secret-key'], {
            settings: {
                customHeaders: [
                    {
                        target: '*',
                        name: 'X-Token',
                        value: 'secret-header-value'
                    }
                ]
            }
        })
    ])
    const consoleData = toConsoleSettings(initial)
    assert.ok(!JSON.stringify(consoleData).includes('very-secret-key'))
    assert.ok(!JSON.stringify(consoleData).includes('secret-header-value'))
    const next = toConsoleSettings(initial)
    next.providers[0].sources.push(source('client-chosen'))
    const normalized = normalizeSettings(next, initial)
    assert.notEqual(normalized.providers[0].sources[1].id, 'client-chosen')
})

test('versioned storage keeps a rollback copy, writes atomically and ignores downgrade writes', async (t) => {
    const dir = await mkdtemp(join(tmpdir(), 'hub-multi-'))
    t.after(() => rm(dir, { recursive: true, force: true }))
    const legacy = JSON.stringify({
        providers: [
            {
                provider: 'openai-compatible',
                platform: 'hub',
                apiEndpoint: 'https://a.test/v1',
                apiKey: 'old'
            }
        ]
    })
    await writeFile(join(dir, 'config.json'), legacy)
    const store = new ModelHubSettingsStore({ baseDir: dir }, 'config.json')
    const current = await store.load()
    assert.equal(current.schemaVersion, 2)
    assert.equal(
        await readFile(join(dir, 'config.json.pre-v2.bak'), 'utf8'),
        legacy
    )
    await writeFile(join(dir, 'config.json'), '{}')
    assert.equal(
        (await store.load()).providers[0].sources[0].credentials[0].apiKey,
        'old'
    )
    assert.ok(!(await readdir(dir)).some((name) => name.endsWith('.tmp')))
})

test('per-key discovery and concurrent calls never mix URL, auth, proxy or source headers', async () => {
    const f = fixture(
        [
            source('a', ['one', 'two'], {
                settings: {
                    proxyMode: 'off',
                    customHeaders: [
                        { target: '*', name: 'X-Source', value: 'a' }
                    ]
                }
            }),
            source('b', ['three'], {
                settings: {
                    proxyMode: 'on',
                    proxyAddress: 'http://proxy.test:1234',
                    customHeaders: [
                        { target: '*', name: 'X-Source', value: 'b' }
                    ]
                }
            })
        ],
        route(true)
    )
    await f.router.refreshCatalog()
    assert.equal(f.requests.filter((r) => r.url.endsWith('/models')).length, 3)
    f.resolved.configMode = 'balance'
    const next = structuredClone(f.config)
    next.providers[0].configMode = 'balance'
    f.update(next)
    await Promise.all(
        Array.from({ length: 12 }, () =>
            f.router.completion(chat({ model: 'public' }))
        )
    )
    for (const r of f.requests) {
        const host = new URL(r.url).hostname
        assert.equal(r.headers.get('x-source'), host[0])
        assert.ok(
            host === 'a.test'
                ? ['Bearer one', 'Bearer two'].includes(
                      r.headers.get('authorization')
                  )
                : r.headers.get('authorization') === 'Bearer three'
        )
        assert.equal(
            r.proxy,
            host === 'a.test' ? 'null' : 'http://proxy.test:1234'
        )
        assert.equal(r.transportConfig.apiEndpoint, `https://${host}/v1`)
    }
})

test('new source does not authorize same-name failover, while different model IDs remain discoverable', async () => {
    const f = fixture([source('a'), source('b', ['two'])], [], (r) =>
        r.body ? new Response('', { status: 401 }) : undefined
    )
    const models = await f.router.refreshCatalog()
    assert.ok(models.some((m) => m.name === 'b.test'))
    await assert.rejects(f.router.completion(chat()))
    assert.deepEqual(
        f.requests.filter((r) => r.body).map((r) => new URL(r.url).hostname),
        ['a.test']
    )
})

test('source weights are independent of credential count; keys rotate within a source', async () => {
    const f = fixture(
        [source('a', ['one', 'two', 'three']), source('b', ['four'])],
        route(true)
    )
    await f.router.refreshCatalog()
    const next = structuredClone(f.config)
    next.providers[0].configMode = 'balance'
    f.update(next)
    for (let i = 0; i < 20; i++)
        await f.router.completion(chat({ model: 'public' }))
    const reqs = f.requests.filter((r) => r.body)
    assert.equal(reqs.filter((r) => r.url.startsWith('https://a.')).length, 10)
    assert.equal(
        new Set(
            reqs
                .filter((r) => r.url.startsWith('https://a.'))
                .map((r) => r.headers.get('authorization'))
        ).size,
        3
    )
})

test('401 isolates a key and retries another key; 400 does not churn credentials', async () => {
    for (const status of [401, 400]) {
        const f = fixture([source('a', ['one', 'two'])], [], (r) =>
            r.body && r.headers.get('authorization') === 'Bearer one'
                ? new Response('', { status })
                : undefined
        )
        await f.router.refreshCatalog()
        if (status === 401) {
            await f.router.completion(chat())
            assert.equal(f.requests.filter((r) => r.body).length, 2)
            assert.equal(f.router.status()[0].state, 'error')
        } else {
            await assert.rejects(f.router.completion(chat()), /400/)
            assert.equal(f.requests.filter((r) => r.body).length, 1)
        }
    }
})

test('shared-quota 429 cools all peer keys and uses only explicitly permitted backup source', async () => {
    const a = source('a', ['one', 'two'])
    a.credentials.forEach((c) => {
        c.quotaGroup = 'account'
    })
    const f = fixture([a, source('b', ['three'])], route(true), (r) =>
        r.body && r.url.startsWith('https://a.')
            ? new Response('', {
                  status: 429,
                  headers: { 'retry-after': '10' }
              })
            : undefined
    )
    await f.router.refreshCatalog()
    await f.router.completion(chat({ model: 'public' }))
    assert.deepEqual(
        f.requests.filter((r) => r.body).map((r) => new URL(r.url).hostname),
        ['a.test', 'b.test']
    )
    assert.equal(
        f.router.status().filter((s) => s.state === 'cooldown').length,
        2
    )
    assert.equal(retryAfter('2', 1000), 3000)
    assert.equal(retryAfter(new Date(10000).toUTCString(), 1000), 10000)
})

test('directory failures preserve last-good per-key catalogs; successful empty results clear only that scope', async () => {
    let mode = 'good'
    const f = fixture([source('a', ['one', 'two'])], [], (r) => {
        if (
            !r.url.endsWith('/models') ||
            r.headers.get('authorization') !== 'Bearer one'
        )
            return
        if (mode === 'fail') return new Response('', { status: 503 })
        if (mode === 'empty') return Response.json({ data: [] })
    })
    await f.router.refreshCatalog()
    mode = 'fail'
    assert.ok(
        (await f.router.refreshCatalog()).some((m) => m.name === 'shared')
    )
    assert.equal(f.router.status()[0].modelCount, 2)
    mode = 'empty'
    await f.router.refreshCatalog()
    assert.equal(f.router.status()[0].modelCount, 0)
    assert.equal(f.router.modelCandidates('shared').length, 1)
})

test('cross-source capability contract is intersection, not union, and explicit vision contract excludes text-only sources', async () => {
    const f = fixture([source('a'), source('b', ['two'])], route(true), (r) =>
        r.url.endsWith('/models')
            ? Response.json({
                  data: [model('shared', r.url.startsWith('https://a.'))]
              })
            : undefined
    )
    const found = await f.router.refreshCatalog()
    assert.ok(
        !found
            .find((m) => m.name === 'public')
            .capabilities.includes(Cap.ImageInput)
    )
    const next = structuredClone(f.config)
    next.providers[0].routes[0].capabilities = [Cap.TextInput, Cap.ImageInput]
    f.update(next)
    assert.equal(f.router.modelCandidates('public').length, 1)
})

test('cancellation while waiting releases queue/concurrency and does not affect health', async () => {
    let unblock
    let started
    const ready = new Promise((r) => {
        started = r
    })
    const a = source('a')
    a.credentials[0].concurrentMaxSize = 1
    const f = fixture([a], [], async (r) => {
        if (!r.body) return
        started()
        await new Promise((resolve) => {
            unblock = resolve
        })
    })
    await f.router.refreshCatalog()
    const first = f.router.completion(chat())
    await ready
    const abort = new AbortController()
    const second = f.router.completion(chat({ signal: abort.signal }))
    abort.abort(new Error('user cancelled'))
    await assert.rejects(second, /cancelled/)
    unblock()
    await first
    assert.equal(f.router.status()[0].state, 'ready')
    assert.equal(f.router.queued, 0)
    assert.ok([...f.router.counters.values()].every((c) => c.active === 0))
})

test('already-emitted stream and ambiguous 5xx cannot replay to another key or source', async () => {
    const f = fixture([source('a', ['one', 'two']), source('b')], route(true))
    await f.router.refreshCatalog()
    let calls = 0
    const first = f.router.state.connections[0]
    first.requester.completionStream = async function* () {
        calls++
        yield { text: 'partial', message: new AIMessage('partial') }
        throw new Error('stream broken')
    }
    await assert.rejects(async () => {
        for await (const _ of f.router.completionStream(
            chat({ model: 'public' })
        )) {
        }
    }, /stream broken/)
    assert.equal(calls, 1)
    const g = fixture(
        [source('a', ['one', 'two']), source('b')],
        route(true),
        (r) => (r.body ? new Response('', { status: 503 }) : undefined)
    )
    await g.router.refreshCatalog()
    await assert.rejects(g.router.completion(chat({ model: 'public' })), /503/)
    assert.equal(g.requests.filter((r) => r.body).length, 1)
})

test('resource ownership refuses old credential generations and resource operations require explicit scope', async () => {
    const f = fixture([source('a')])
    await f.router.refreshCatalog()
    const key = f.router.state.connections[0].key
    const message = new AIMessage({
        content: 'previous',
        additional_kwargs: { model_hub_connection: key }
    })
    const next = structuredClone(f.config)
    next.providers[0].sources[0].credentials[0].generation++
    f.update(next)
    await f.router.refreshCatalog()
    await assert.rejects(
        f.router.completion(
            chat({ input: [message, new HumanMessage('continue')] })
        ),
        /代次|归属/
    )
    await assert.rejects(
        f.router.resource({ resource: 'files', action: 'list' }),
        /选择/
    )
})

test('hot activation does not change the transport of an in-flight request', async () => {
    let release
    let begin
    const began = new Promise((r) => {
        begin = r
    })
    const f = fixture([source('a')], [], async (r) => {
        if (r.body) {
            begin()
            await new Promise((resolve) => {
                release = resolve
            })
        }
    })
    await f.router.refreshCatalog()
    const pending = f.router.completion(chat())
    await began
    const next = structuredClone(f.config)
    next.providers[0].sources[0].apiEndpoint = 'https://new.test/v1'
    next.providers[0].sources[0].credentials[0].apiKey = 'new-key'
    next.providers[0].sources[0].credentials[0].generation++
    f.update(next)
    release()
    await pending
    const req = f.requests.find((r) => r.body)
    assert.equal(req.url, 'https://a.test/v1/chat/completions')
    assert.equal(req.headers.get('authorization'), 'Bearer one')
    assert.equal(
        f.router.state.connections[0].config.apiEndpoint,
        'https://new.test/v1'
    )
})

test('persisted permission catalogs survive restart and an unavailable original source never adopts a namesake', async (t) => {
    const dir = await mkdtemp(join(tmpdir(), 'hub-catalog-'))
    t.after(() => rm(dir, { recursive: true, force: true }))
    const path = join(dir, 'catalog.json')
    const catalog = new ConnectionCatalogStore(path)
    const f = fixture([source('a'), source('b')], [], undefined, catalog)
    await f.router.refreshCatalog()
    const disk = await readFile(path, 'utf8')
    assert.ok(
        !disk.includes('Bearer') &&
            !disk.includes('apiKey') &&
            !disk.includes('https://a.test')
    )
    const recovered = new ConnectionCatalogStore(path)
    await recovered.load()
    const offline = fixture(
        [source('a'), source('b')],
        [],
        () => new Response('', { status: 503 }),
        recovered
    )
    assert.equal(offline.router.modelCandidates('shared').length, 1)
    assert.equal(offline.router.status()[0].state, 'stale')
    await offline.router.refreshCatalog()
    const next = structuredClone(offline.config)
    next.providers[0].sources[0].enabled = false
    offline.update(next)
    assert.deepEqual(offline.router.modelCandidates('shared'), [])
    await assert.rejects(offline.router.completion(chat()), /没有可用路由/)
    assert.ok(!(await readdir(dir)).some((name) => name.endsWith('.tmp')))
})

test('resource ownership persists across restart and rejects operations under a replaced credential', async (t) => {
    const dir = await mkdtemp(join(tmpdir(), 'hub-resource-'))
    t.after(() => rm(dir, { recursive: true, force: true }))
    const path = join(dir, 'catalog.json')
    const catalog = new ConnectionCatalogStore(path)
    const f = fixture([source('a')], [], undefined, catalog)
    f.router.state.connections[0].requester.geminiResources = () => ({
        request: async () => ({ files: [{ name: 'files/original' }] })
    })
    await f.router.resource({
        sourceId: 'a',
        credentialId: 'a-key-0',
        credentialGeneration: 1,
        resource: 'files',
        action: 'list'
    })
    const recovered = new ConnectionCatalogStore(path)
    await recovered.load()
    const changed = source('a', ['replacement'])
    changed.credentials[0].generation = 2
    const g = fixture([changed], [], undefined, recovered)
    await assert.rejects(
        g.router.resource({
            sourceId: 'a',
            credentialId: 'a-key-0',
            credentialGeneration: 2,
            resource: 'files',
            action: 'get',
            name: 'files/original'
        }),
        /旧凭据代次/
    )
})

test('corrupt catalog can be repaired atomically and recovery is reported', async (t) => {
    const dir = await mkdtemp(join(tmpdir(), 'hub-recovery-'))
    t.after(() => rm(dir, { recursive: true, force: true }))
    const path = join(dir, 'catalog.json')
    await writeFile(path, '{broken')
    let recovered = 0
    const store = new ConnectionCatalogStore(path, () => {
        recovered++
    })
    await assert.rejects(store.load())
    store.set(
        'source/key/1',
        [
            {
                name: 'ok',
                type: 1,
                capabilities: [Cap.TextInput],
                maxTokens: 4096
            }
        ],
        123
    )
    await store.flush()
    assert.equal(recovered, 1)
    const after = new ConnectionCatalogStore(path)
    await after.load()
    assert.equal(after.get('source/key/1').models[0].name, 'ok')
})

test('source preflight never changes live requester capabilities or commits model origins', async () => {
    const f = fixture([source('a')])
    await f.router.refreshCatalog()
    const current = f.router.state.connections[0].requester
    let mutations = 0
    const original = current.setModelCapabilities.bind(current)
    current.setModelCapabilities = (models) => {
        mutations++
        original(models)
    }
    const next = structuredClone(f.config)
    next.providers[0].routes = [
        {
            model: 'manual',
            modelType: 'llm',
            contextSize: 4096,
            capabilities: [Cap.TextInput],
            candidates: [{ sourceId: 'a', upstreamModel: 'unknown' }],
            allowFallback: false
        }
    ]
    const runtime = resolveRuntimeProviders(next.providers)[0]
    const prepared = f.router.prepare(
        createResolvedConfig({ webui: true }, next, next.providers[0]),
        runtime
    )
    assert.equal(mutations, 0)
    assert.notEqual(prepared.connections[0].requester, current)
    assert.equal(f.router.modelCandidates('manual').length, 0)
    assert.equal(f.router.catalog.origin('hub-test', 'unknown'), undefined)
})

test('403 model permission is key-specific, while unrelated models and safe error details remain intact', async () => {
    const f = fixture([source('a', ['one', 'two'])], [], (r) =>
        r.body?.model === 'shared' &&
        r.headers.get('authorization') === 'Bearer one'
            ? Response.json(
                  {
                      error: {
                          code: 'model_not_found',
                          message: 'DO-NOT-LEAK',
                          param: 'model'
                      }
                  },
                  { status: 403 }
              )
            : undefined
    )
    await f.router.refreshCatalog()
    await f.router.completion(chat())
    assert.equal(f.router.state.connections[0].authFailed, false)
    assert.ok(f.router.state.connections[0].denied.has('shared'))
    await f.router.completion(chat({ model: 'a.test' }))
    assert.equal(
        f.requests
            .filter((r) => r.body?.model === 'a.test')[0]
            .headers.get('authorization'),
        'Bearer one'
    )
    assert.ok(!JSON.stringify(f.router.status()).includes('DO-NOT-LEAK'))
})

test('ordinary text mentioning remote file paths is not treated as an owned resource', async () => {
    const f = fixture([source('a')])
    await f.router.refreshCatalog()
    await f.router.completion(
        chat({
            input: [
                new HumanMessage(
                    'Explain /files/example and files/example in this log'
                )
            ]
        })
    )
    assert.equal(f.requests.filter((r) => r.body).length, 1)
})

test('scoped streams tag their owner once and new conversations can use all eligible keys', async () => {
    const f = fixture([
        source('a', ['one', 'two'], {
            provider: 'openai',
            settings: { responseApi: true }
        })
    ])
    await f.router.refreshCatalog()
    for (const connection of f.router.state.connections)
        connection.requester.completionStream = async function* () {
            for (const content of ['one', 'two', 'three'])
                yield {
                    text: content,
                    message: new AIMessageChunk({ content })
                }
        }
    const owners = []
    for (let i = 0; i < 2; i++) {
        let message
        for await (const chunk of f.router.completionStream(
            chat({ id: `conversation-${i}` })
        ))
            message = message ? message.concat(chunk.message) : chunk.message
        owners.push(message.additional_kwargs.model_hub_connection)
    }
    assert.deepEqual(owners, ['a/a-key-0/1', 'a/a-key-1/1'])
})

test('static resources do not inherit a replacement key generation without explicit rebind', async () => {
    const old = settings([
        source('a', ['one'], {
            provider: 'openai',
            settings: { responseFileSearchVectorStoreIds: ['vs_owned'] }
        })
    ])
    const next = toConsoleSettings(old)
    next.providers[0].sources[0].credentials[0].apiKey = 'replacement'
    next.providers[0].sources[0].credentials[0].secretAction = 'replace'
    const changed = normalizeSettings(next, old)
    const s = changed.providers[0].sources[0]
    assert.equal(s.resourceCredentialGeneration, 1)
    assert.equal(s.credentials[0].generation, 2)
    const f = fixture(old.providers[0].sources)
    await f.router.refreshCatalog()
    f.update(changed)
    await f.router.refreshCatalog()
    await assert.rejects(f.router.completion(chat()), /固定资源所属 Key 或代次/)
})

test('clone and clipboard export remove nested secrets, reassign identities and remap routes', () => {
    const original = toConsoleSettings(
        settings(
            [
                source('a', ['secret-one'], {
                    settings: {
                        customHeaders: [
                            {
                                target: '*',
                                name: 'X-Secret',
                                value: 'secret-two'
                            }
                        ]
                    }
                })
            ],
            [
                {
                    model: 'public',
                    candidates: [
                        {
                            sourceId: 'a',
                            credentialIds: ['a-key-0'],
                            upstreamModel: 'shared'
                        }
                    ]
                }
            ]
        )
    ).providers[0]
    original.sources[0].credentials[0].apiKey = 'unsaved-secret'
    original.sources[0].settings.customHeaders[0].value = 'unsaved-header'
    const clone = withoutProviderSecrets(original)
    const text = JSON.stringify(clone)
    for (const secret of [
        'secret-one',
        'secret-two',
        'unsaved-secret',
        'unsaved-header'
    ])
        assert.ok(!text.includes(secret))
    assert.notEqual(clone.sources[0].id, original.sources[0].id)
    assert.equal(clone.routes[0].candidates[0].sourceId, clone.sources[0].id)
    assert.equal(
        clone.routes[0].candidates[0].credentialIds[0],
        clone.sources[0].credentials[0].id
    )
    assert.equal(original.sources[0].credentials[0].apiKey, 'unsaved-secret')
})

test('attachment preparation fetches inherit attempt cancellation and release all reservations', async () => {
    let begin
    const started = new Promise((resolve) => {
        begin = resolve
    })
    const f = fixture([source('a')], [], (r) => {
        if (!r.url.endsWith('/attachment')) return
        begin()
        return new Promise((resolve, reject) =>
            r.signal.addEventListener('abort', () => reject(r.signal.reason), {
                once: true
            })
        )
    })
    await f.router.refreshCatalog()
    const requester = f.router.state.connections[0].requester
    requester.completion = () =>
        requester.requestContext().plugin.fetch('https://a.test/attachment')
    const abort = new AbortController()
    const pending = f.router.completion(chat({ signal: abort.signal }))
    await started
    abort.abort(new Error('cancel attachment'))
    await assert.rejects(pending, /cancel attachment/)
    assert.equal(f.router.queued, 0)
    assert.ok([...f.router.counters.values()].every((c) => c.active === 0))
    assert.equal(f.router.status()[0].state, 'ready')
})

test('discovery crossing a settings swap returns the new directory instead of restoring obsolete facade models', async () => {
    let release
    let begin
    const started = new Promise((resolve) => {
        begin = resolve
    })
    const f = fixture([source('a')], [], async (r) => {
        if (r.url.startsWith('https://a.test') && r.url.endsWith('/models')) {
            begin()
            await new Promise((resolve) => {
                release = resolve
            })
            return Response.json({ data: [model('obsolete')] })
        }
        if (r.url.startsWith('https://new.test'))
            return Response.json({ data: [model('current')] })
    })
    const pending = f.router.refreshCatalog()
    await started
    const next = structuredClone(f.config)
    next.providers[0].sources[0].apiEndpoint = 'https://new.test/v1'
    next.providers[0].sources[0].credentials[0].generation++
    f.update(next)
    release()
    const models = await pending
    assert.deepEqual(
        models.map((m) => m.name),
        ['current']
    )
    assert.ok(!f.router.modelCandidates('obsolete').length)
})

test('Dify legacy applications retain their public model names with one source per application', () => {
    const app = {
        provider: 'dify',
        platform: 'hub-dify',
        name: 'Assistant',
        apiEndpoint: 'https://dify.test/v1',
        enabled: true,
        difyModelName: 'helper'
    }
    const migrated = normalizeSettings({
        providers: [
            { ...app, apiKey: 'app-one' },
            { ...app, apiKey: 'app-two' }
        ]
    })
    assert.equal(migrated.providers.length, 1)
    assert.deepEqual(
        migrated.providers[0].sources.map((s) => s.settings.difyModelName),
        ['helper', 'helper-2']
    )
    assert.deepEqual(
        migrated.providers[0].sources.map((s) => s.credentials[0].apiKey),
        ['app-one', 'app-two']
    )
})

test('Dify conversation cache is isolated by connection and credential generation', async () => {
    const f = fixture(
        [
            source('a', ['one', 'two'], {
                provider: 'dify',
                settings: { difyModelName: 'app' }
            })
        ],
        [],
        (r) => {
            if (!r.body)
                return Response.json({
                    user_input_form: [],
                    file_upload: { enabled: false }
                })
            const key = r.headers.get('authorization').slice('Bearer '.length)
            const event = {
                event: 'message_end',
                conversation_id: `conversation-${key}`
            }
            return new Response(`data: ${JSON.stringify(event)}\n\n`, {
                headers: { 'content-type': 'text/event-stream' }
            })
        }
    )
    await f.router.refreshCatalog()
    const params = chat({ model: 'app', id: 'same-local-conversation' })
    await f.router.completion(params)
    await f.router.completion({ ...params, id: 'another' })
    assert.equal(f.cache.size, 2)
    assert.ok([...f.cache.keys()].some((key) => key.includes('/a/a-key-0/1')))
    assert.ok([...f.cache.keys()].some((key) => key.includes('/a/a-key-1/1')))
    const next = structuredClone(f.config)
    next.providers[0].sources[0].credentials[0].generation++
    f.update(next)
    await f.router.refreshCatalog()
    await f.router.completion(params)
    const last = f.requests.filter((r) => r.body).at(-1)
    assert.ok(
        !last.body.conversation_id,
        'A replaced credential must start a fresh remote conversation'
    )
})

test('console marks stale catalogs as partial and includes usable platforms in loaded totals', async () => {
    const service = Object.create(ModelHubConsoleService.prototype)
    let connections = [
        {
            sourceId: 'a',
            credentialId: 'a-key-0',
            state: 'stale',
            modelCount: 1,
            error: '目录等待恢复'
        }
    ]
    service._options = {
        config: {},
        getSettings: () => settings([source('a')]),
        runtime: {
            providers: [],
            errors: new Map(),
            clients: new Map([
                ['hub-test', { connectionStatus: () => connections }]
            ])
        }
    }
    service.ctx = {
        chatluna: { platform: { listPlatformModels: () => ({ value: [] }) } }
    }
    const partial = await service.get()
    assert.equal(partial.providers[0].status, 'partial')
    assert.equal(partial.providers[0].error, '目录等待恢复')
    assert.equal(partial.totals.loaded, 1)
    connections = [{ ...connections[0], state: 'error' }]
    assert.equal((await service.get()).providers[0].status, 'error')
})

test('empty tool-call history metadata does not reject an otherwise text-only request', async () => {
    const f = fixture([source('a')], [], (r) =>
        r.url.endsWith('/models')
            ? Response.json({
                  data: [{ ...model('shared', false), tool_call: false }]
              })
            : undefined
    )
    await f.router.refreshCatalog()
    await f.router.completion(
        chat({
            input: [
                new AIMessage({
                    content: 'plain response',
                    additional_kwargs: { tool_calls: [] }
                }),
                new HumanMessage('continue')
            ]
        })
    )
    assert.equal(f.requests.filter((r) => r.body).length, 1)
})

test('removing a platform rejects new calls while its in-flight request finishes with the original snapshot', async () => {
    let release
    let begin
    const started = new Promise((resolve) => {
        begin = resolve
    })
    const f = fixture([source('a')], [], async (r) => {
        if (r.body) {
            begin()
            await new Promise((resolve) => {
                release = resolve
            })
        }
    })
    await f.router.refreshCatalog()
    const pending = f.router.completion(chat())
    await started
    await f.router.dispose()
    await assert.rejects(f.router.completion(chat()), /停止或删除/)
    release()
    await pending
    assert.equal(f.router.queued, 0)
    assert.equal(f.router.retired.size, 0)
})
