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
    ToolMessage
} = require('@langchain/core/messages')
const {
    ModelCapabilities: Cap,
    ModelType
} = require('koishi-plugin-chatluna/llm-core/platform/types')
const load = require('./load-source.cjs')
const { resolveCapabilities, capabilityFileHandling } = load('capabilities.ts')
const {
    parseOpenAIModels,
    parseAnthropicModels,
    expandReasoningVariantsForProvider
} = load('adapters/model-list.ts')
const { ModelHubRequester } = load('requester.ts')
const { ModelHubClient } = load('client.ts')
const { ModelMetadataStore } = load('metadata.ts')
const { normalizeSettings, createResolvedConfig, toConsoleSettings } =
    load('settings.ts')
const { createGeminiRequest, createGeminiToolNameMapper, parseGeminiResponse } =
    load('adapters/gemini.ts')

const image = { type: 'image_url', image_url: 'data:image/png;base64,aGVsbG8=' }
const media = (type, mime) => ({
    type,
    [type]: { url: `data:${mime};base64,aGVsbG8=`, mimeType: mime }
})
const human = () =>
    new HumanMessage({ content: [{ type: 'text', text: 'describe' }, image] })
const log = { warn() {}, info() {}, error() {}, debug() {} }

function requesterFor(capabilities, streaming = false, options = {}) {
    const requests = []
    const config = {
        apiKey: '',
        apiEndpoint: 'https://example.test/v1',
        platform: 'openai-compatible',
        provider: 'openai-compatible',
        nonStreaming: !streaming,
        customHeaders: [],
        maxRetries: 1,
        timeout: 1000,
        ...options
    }
    const ref = { value: config, md5: () => 'test' }
    const plugin = {
        fetch: async (url, init) => {
            const body = JSON.parse(init.body)
            requests.push({ url, body })
            if (
                url.includes(':generateContent') ||
                url.includes(':streamGenerateContent')
            ) {
                const data = JSON.stringify({
                    candidates: [
                        {
                            content: {
                                parts: [
                                    { text: 'ok' },
                                    { executableCode: { code: '1+1' } }
                                ]
                            }
                        }
                    ]
                })
                return url.includes(':streamGenerateContent')
                    ? new Response(`data: ${data}\n\ndata: [DONE]\n\n`, {
                          headers: { 'content-type': 'text/event-stream' }
                      })
                    : new Response(data)
            }
            if (body.stream)
                return new Response(
                    'data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n',
                    { headers: { 'content-type': 'text/event-stream' } }
                )
            if (url.endsWith('/responses'))
                return new Response(
                    JSON.stringify({
                        output: [
                            {
                                type: 'message',
                                role: 'assistant',
                                content: [{ type: 'output_text', text: 'ok' }]
                            }
                        ]
                    })
                )
            return new Response(
                JSON.stringify({
                    choices: [{ message: { role: 'assistant', content: 'ok' } }]
                })
            )
        }
    }
    const requester = new ModelHubRequester(
        { logger: () => log },
        { getConfig: () => ref, markConfigStatus() {} },
        config,
        plugin
    )
    requester.setModelCapabilities([
        {
            name: 'opaque-id',
            type: ModelType.llm,
            maxTokens: 4096,
            capabilities
        }
    ])
    return { requester, requests }
}

test('explicit /models negatives override vision names and tools; variants retain them', () => {
    const [entry] = parseOpenAIModels({
        data: [
            {
                id: 'gpt-4o-vision',
                reasoning: true,
                tool_call: false,
                architecture: { input_modalities: ['text'] }
            }
        ]
    })
    const caps = resolveCapabilities('openai-chat', entry)
    assert(!caps.includes(Cap.ToolCall))
    assert(!caps.includes(Cap.ImageInput))
    const variants = expandReasoningVariantsForProvider(
        { id: 'openai', reasoningEffort: 'passthrough' },
        [{ ...entry, reasoningEfforts: ['high'] }]
    )
    assert(variants.length > 1)
    for (const variant of variants)
        assert(
            !resolveCapabilities('openai-chat', variant).includes(
                Cap.ImageInput
            )
        )
    const [claude] = parseAnthropicModels({
        data: [
            {
                id: 'claude-sonnet-test',
                capabilities: {
                    image_input: false,
                    pdf_input: { supported: false },
                    tool_use: false
                }
            }
        ]
    })
    assert.deepEqual(resolveCapabilities('anthropic', claude), [])
})

test('current vision aliases work without turning ordinary DeepSeek V4 Flash into vision', () => {
    for (const name of [
        'deepseek-flash',
        'glm-5.3-flash',
        'DeepSeek V4 Flash Vision Exp'
    ]) {
        assert(
            resolveCapabilities('openai-chat', { name }).includes(
                Cap.ImageInput
            ),
            name
        )
    }
    assert(
        !resolveCapabilities('openai-chat', {
            name: 'DeepSeek V4 Flash'
        }).includes(Cap.ImageInput)
    )
})

test('explicit thinking=false disables reasoning-name inference and reasoning variants', () => {
    const [entry] = parseOpenAIModels({
        data: [{ id: 'gpt-5-thinking', supports_reasoning: false }]
    })
    assert(!resolveCapabilities('openai-chat', entry).includes(Cap.Thinking))
    assert.equal(
        expandReasoningVariantsForProvider(
            { id: 'openai', reasoningEffort: 'passthrough' },
            [entry]
        ).length,
        1
    )
})

test('official Responses capabilities do not advertise unimplemented audio/video serialization', () => {
    const caps = resolveCapabilities(
        'openai',
        {
            name: 'opaque-id',
            capabilities: [
                Cap.AudioInput,
                Cap.VideoInput,
                Cap.FileInput,
                Cap.ImageInput
            ]
        },
        true
    )
    assert(!caps.includes(Cap.AudioInput))
    assert(!caps.includes(Cap.VideoInput))
    assert(caps.includes(Cap.FileInput))
    assert(caps.includes(Cap.ImageInput))
})

for (const streaming of [false, true]) {
    test(`opaque image capability reaches the actual ${streaming ? 'streaming' : 'non-streaming'} request`, async () => {
        const { requester, requests } = requesterFor(
            [Cap.ImageInput],
            streaming
        )
        const params = { model: 'opaque-id', input: [human()], timeout: 1000 }
        if (streaming)
            for await (const _ of requester.completionStream(params)) {
            }
        else assert.equal((await requester.completion(params)).text, 'ok')
        assert.equal(requests.length, 1)
        assert.equal(requests[0].body.model, 'opaque-id')
        assert.equal(requests[0].body.messages[0].content[1].type, 'image_url')
        assert.equal(
            requests[0].body.messages[0].content[1].image_url.url,
            image.image_url
        )
    })
    test(`explicit text-only/tool-disabled model strips unsupported payloads (${streaming}) without mutating input`, async () => {
        const { requester, requests } = requesterFor([], streaming)
        const input = [human()]
        const params = {
            model: 'opaque-id',
            input,
            timeout: 1000,
            tools: [
                {
                    name: 'probe',
                    description: 'test',
                    schema: { type: 'object' }
                }
            ],
            overrideRequestParams: {
                tools: [{ type: 'function' }],
                tool_choice: 'auto',
                parallel_tool_calls: true
            }
        }
        if (streaming)
            for await (const _ of requester.completionStream(params)) {
            }
        else await requester.completion(params)
        assert.equal(input[0].content.length, 2)
        assert.equal(requests[0].body.messages[0].content.length, 1)
        assert.equal(requests[0].body.tools, undefined)
        assert.equal(requests[0].body.tool_choice, undefined)
        assert.equal(requests[0].body.parallel_tool_calls, undefined)
    })
}

test('Responses API also honors capabilities and preserves declared opaque-model images', async () => {
    for (const caps of [[Cap.ImageInput], []]) {
        const { requester, requests } = requesterFor(caps, false, {
            provider: 'openai',
            platform: 'openai',
            responseApi: true,
            responseBuiltinTools: []
        })
        await requester.completion({
            model: 'opaque-id',
            input: [human()],
            timeout: 1000
        })
        assert.equal(requests[0].url, 'https://example.test/v1/responses')
        assert.equal(
            requests[0].body.input[0].content.some(
                (part) => part.type === 'input_image'
            ),
            caps.length > 0
        )
    }
})

test('opaque audio/file capabilities serialize real media, not fake model names', async () => {
    const { requester, requests } = requesterFor([
        Cap.AudioInput,
        Cap.FileInput
    ])
    await requester.completion({
        model: 'opaque-id',
        timeout: 1000,
        input: [
            new HumanMessage({
                content: [
                    { type: 'text', text: 'read' },
                    media('audio_url', 'audio/wav'),
                    media('file_url', 'application/pdf')
                ]
            })
        ]
    })
    const content = requests[0].body.messages[0].content
    assert.deepEqual(content[1], {
        type: 'input_audio',
        input_audio: { data: 'aGVsbG8=', format: 'wav' }
    })
    assert.equal(
        content[2].file.file_data,
        'data:application/pdf;base64,aGVsbG8='
    )
    assert.equal(requests[0].body.model, 'opaque-id')
})

test('Responses inline PDF is sent as file_data rather than a data URL file_url', async () => {
    const { requester, requests } = requesterFor([Cap.FileInput], false, {
        provider: 'openai',
        platform: 'openai',
        responseApi: true,
        responseBuiltinTools: []
    })
    await requester.completion({
        model: 'opaque-id',
        timeout: 1000,
        input: [
            new HumanMessage({
                content: [media('file_url', 'application/pdf')]
            })
        ]
    })
    const file = requests[0].body.input[0].content[0]
    assert.equal(file.type, 'input_file')
    assert.equal(file.file_data, 'data:application/pdf;base64,aGVsbG8=')
    assert.equal(file.file_url, undefined)
    assert.equal(file.filename, 'attachment.pdf')
})

test('per-model file handling covers declared Gemini media and excludes unsupported media', () => {
    const client = Object.create(ModelHubClient.prototype)
    client._runtime = { provider: { adapter: 'gemini' } }
    const config = client._fileHandlingConfig('opaque-id', {
        capabilities: [
            Cap.ImageInput,
            Cap.AudioInput,
            Cap.VideoInput,
            Cap.FileInput
        ]
    })
    for (const mime of [
        'image/png',
        'audio/wav',
        'video/mp4',
        'application/pdf'
    ])
        assert(config.supportedMimeTypes.has(mime))
    assert(config.maxTotalSizeBytes < 20 * 1024 * 1024)
    assert.equal(capabilityFileHandling('gemini', []), undefined)
    assert(
        !capabilityFileHandling('openai-chat', [
            Cap.ImageInput
        ]).supportedMimeTypes.has('audio/wav')
    )
})

test('client model refresh forwards resolved API capabilities to its requester', async () => {
    const client = Object.create(ModelHubClient.prototype)
    const raw = parseOpenAIModels({
        data: [
            {
                id: 'opaque-id',
                architecture: { input_modalities: ['text', 'image'] },
                tool_call: false
            }
        ]
    })
    let registered
    client._runtime = {
        platform: 'test',
        provider: { id: 'openai-compatible', adapter: 'openai-chat' }
    }
    client._config = { additionalModels: [], blacklistModels: [] }
    Object.defineProperty(client, 'config', { value: { pullModels: true } })
    client._metadata = {
        enhance: (_provider, model) => model,
        getMaxTokens: () => undefined
    }
    client._requester = {
        getModels: async () => raw,
        setModelCapabilities: (models) => {
            registered = models
        }
    }
    const models = await client.refreshModels()
    assert.equal(registered, models)
    assert(models[0].capabilities.includes(Cap.ImageInput))
    assert(!models[0].capabilities.includes(Cap.ToolCall))
})

for (const streaming of [false, true]) {
    test(`Gemini native ${streaming ? 'streaming' : 'non-streaming'} request accepts declared audio/video/PDF and preserves response context`, async () => {
        const { requester, requests } = requesterFor(
            [Cap.AudioInput, Cap.VideoInput, Cap.FileInput],
            streaming,
            { provider: 'gemini', platform: 'gemini' }
        )
        const params = {
            model: 'opaque-id',
            timeout: 1000,
            input: [
                new HumanMessage({
                    content: [
                        media('audio_url', 'audio/wav'),
                        media('video_url', 'video/mp4'),
                        media('file_url', 'application/pdf')
                    ]
                })
            ]
        }
        let generation
        if (streaming)
            for await (const chunk of requester.completionStream(params))
                generation = generation ? generation.concat(chunk) : chunk
        else generation = await requester.completion(params)
        assert.equal(generation.text, 'ok')
        const saved = Object.values(
            generation.message.additional_kwargs.thought_data
        )
        assert(
            saved.some((value) =>
                value.parts?.some((part) => part.executableCode)
            )
        )
        assert.deepEqual(
            requests[0].body.contents[0].parts.map(
                (part) => part.inline_data.mime_type
            ),
            ['audio/wav', 'video/mp4', 'application/pdf']
        )
    })
}

test('Anthropic PDF-only models do not accept images through their attachment config', () => {
    const client = Object.create(ModelHubClient.prototype)
    client._runtime = { provider: { adapter: 'anthropic' } }
    const config = client._fileHandlingConfig('opaque-id', {
        capabilities: [Cap.FileInput]
    })
    assert(config.supportedMimeTypes.has('application/pdf'))
    assert(!config.supportedMimeTypes.has('image/png'))
})

function geminiRequester(config = {}) {
    return {
        currentConfig: () => config,
        requestContext: () => ({
            plugin: {
                fetch() {
                    throw new Error('unexpected network')
                }
            }
        })
    }
}
const mapper = () => createGeminiToolNameMapper([])

test('Gemini AI text, call signatures and executable/tool context survive; tool results merge', async () => {
    const ai = new AIMessage({
        content: 'I will check',
        tool_calls: [
            { id: 'a', name: 'lookup', args: {} },
            { id: 'b', name: 'lookup', args: {} }
        ],
        additional_kwargs: {
            thought_data: {
                shared: {
                    parts: [
                        { executableCode: { language: 'PYTHON', code: '1+1' } },
                        {
                            codeExecutionResult: {
                                outcome: 'OUTCOME_OK',
                                output: '2'
                            }
                        },
                        { toolCall: { toolType: 'GOOGLE_SEARCH', args: {} } },
                        { toolResponse: { toolType: 'MEDIA_PROCESSING' } }
                    ]
                },
                a: { thoughtSignature: 'sig-a' },
                b: [{ thoughtSignature: 'sig-b' }]
            }
        }
    })
    const request = await createGeminiRequest(
        geminiRequester(),
        {
            model: 'gemini-3.6-flash',
            input: [
                ai,
                new ToolMessage({
                    content: '{"answer":2}',
                    name: 'lookup',
                    tool_call_id: 'a'
                }),
                new ToolMessage({
                    content: [{ type: 'text', text: 'done' }, image],
                    name: 'lookup',
                    tool_call_id: 'b'
                })
            ]
        },
        mapper()
    )
    assert.equal(request.contents.length, 2)
    const parts = request.contents[0].parts
    assert.equal(parts[0].text, 'I will check')
    assert.equal(parts.filter((part) => part.executableCode).length, 1)
    assert(parts.some((part) => part.codeExecutionResult))
    assert(parts.some((part) => part.toolCall?.toolType === 'GOOGLE_SEARCH'))
    assert(
        !parts.some(
            (part) => part.toolResponse?.toolType === 'MEDIA_PROCESSING'
        )
    )
    assert.deepEqual(
        parts
            .filter((part) => part.functionCall)
            .map((part) => part.thoughtSignature),
        ['sig-a', 'sig-b']
    )
    assert.equal(request.contents[1].parts.length, 2)
    assert.equal(
        request.contents[1].parts[1].functionResponse.parts[0].inline_data
            .mime_type,
        'image/png'
    )
})

test('Gemini ordinary history replays legacy and wrapped code context, filtering media-processing context', async () => {
    const request = await createGeminiRequest(
        geminiRequester(),
        {
            model: 'gemini-3.6-flash',
            input: [
                new AIMessage({
                    content: '2',
                    additional_kwargs: {
                        thought_data: {
                            parts: [{ executableCode: { code: '1+1' } }],
                            old: [{ codeExecutionResult: { output: '2' } }],
                            dropped: { toolCall: { name: 'video' } }
                        }
                    }
                })
            ]
        },
        mapper()
    )
    assert.equal(request.contents[0].parts.length, 3)
})

test('Agentic video is model-gated, casing-configurable and beside multimodal function responses', async () => {
    for (const camel of [false, true])
        for (const enabled of [false, true]) {
            const requester = geminiRequester({
                agenticVideo: enabled,
                useCamelCaseMediaFields: camel
            })
            const input = [
                new ToolMessage({
                    name: 'clip',
                    tool_call_id: 'v',
                    content: [
                        { type: 'text', text: 'video' },
                        media('video_url', 'video/mp4')
                    ]
                })
            ]
            for (const model of ['gemini-3.6-flash', 'gemini-2.5-flash']) {
                const request = await createGeminiRequest(
                    requester,
                    { model, input },
                    mapper()
                )
                const parts = request.contents[0].parts
                const agentic = enabled && model === 'gemini-3.6-flash'
                const part = agentic
                    ? parts[1]
                    : parts[0].functionResponse.parts[0]
                assert.equal(
                    part[camel ? 'mediaProcessing' : 'media_processing'],
                    agentic ? 'AGENTIC' : undefined
                )
                assert.equal(
                    part[camel ? 'inlineData' : 'inline_data'][
                        camel ? 'mimeType' : 'mime_type'
                    ],
                    'video/mp4'
                )
                assert.equal(parts.length, agentic ? 2 : 1)
            }
        }
})

test('Gemini response preserves unsigned tool/code context and non-call signatures with stable stream indexes', async () => {
    const state = { nextToolIndex: 0, partIndex: 0 }
    const parse = (parts) =>
        parseGeminiResponse(
            JSON.stringify({ candidates: [{ content: { parts } }] }),
            geminiRequester(),
            mapper(),
            state
        )
    const first = await parse([
        { text: 'thinking', thought: true, thoughtSignature: 'standalone' },
        { executableCode: { code: '1+1' } },
        { toolCall: { toolType: 'MEDIA_PROCESSING' } },
        {
            functionCall: { name: 'lookup', args: '{"a":' },
            thoughtSignature: 'sig-a'
        }
    ])
    const second = await parse([{ functionCall: { args: '1}' } }])
    const third = await parse([
        { codeExecutionResult: { output: '2' } },
        { functionCall: { name: 'lookup', args: {} } }
    ])
    const merged = first.concat(second).concat(third)
    assert.equal(merged.message.tool_calls.length, 2)
    assert.deepEqual(merged.message.tool_calls[0].args, { a: 1 })
    assert.deepEqual(
        merged.message.tool_call_chunks.map((part) => part.index),
        [0, 1]
    )
    const saved = Object.values(merged.message.additional_kwargs.thought_data)
    assert(
        saved.some((value) => value.parts?.some((part) => part.executableCode))
    )
    assert(
        saved.some((value) =>
            value.parts?.some((part) => part.codeExecutionResult)
        )
    )
    assert(
        saved.some((value) =>
            value.parts?.some((part) => part.thoughtSignature === 'standalone')
        )
    )
    assert(
        !saved.some((value) =>
            value.parts?.some(
                (part) => part.toolCall?.toolType === 'MEDIA_PROCESSING'
            )
        )
    )
})

test('Gemini schema sanitization strips unsupported JSON Schema fields recursively', async () => {
    const tools = [
        {
            name: 'test',
            description: 'test',
            schema: {
                type: 'object',
                $schema: 'invalid',
                additionalProperties: false,
                properties: {
                    n: { type: 'number', exclusiveMinimum: 0, minimum: 0 },
                    choice: { oneOf: [{ type: 'string', discriminator: {} }] }
                }
            }
        }
    ]
    const request = await createGeminiRequest(
        geminiRequester(),
        { model: 'gemini-3.6-flash', input: [human()], tools },
        createGeminiToolNameMapper(tools)
    )
    const schema = request.tools[0].functionDeclarations[0].parameters
    assert.equal(schema.$schema, undefined)
    assert.equal(schema.properties.n.exclusiveMinimum, undefined)
    assert.equal(schema.properties.n.minimum, 0)
    assert.deepEqual(schema.properties.choice.anyOf, [{ type: 'string' }])
})

test('Gemini advanced settings round-trip through console normalization and runtime config', () => {
    const settings = normalizeSettings({
        providers: [
            {
                provider: 'gemini',
                platform: 'gemini',
                enabled: true,
                agenticVideo: true,
                useCamelCaseMediaFields: true
            }
        ]
    })
    const entry = settings.providers.find((p) => p.provider === 'gemini')
    assert.equal(entry.agenticVideo, true)
    assert.equal(
        toConsoleSettings(settings).providers.find(
            (p) => p.provider === 'gemini'
        ).agenticVideo,
        true
    )
    const resolved = createResolvedConfig({}, settings, entry)
    assert.equal(resolved.agenticVideo, true)
    assert.equal(resolved.useCamelCaseMediaFields, true)
})

async function fixture(t, http, options = {}) {
    const baseDir = await mkdtemp(join(tmpdir(), 'model-hub-test-'))
    const disposers = []
    const ctx = {
        baseDir,
        http,
        logger: () => log,
        on: (name, cb) => {
            if (name === 'dispose') disposers.push(cb)
        }
    }
    const store = new ModelMetadataStore(ctx, {
        cachePath: 'catalog.json',
        ...options
    })
    t.after(async () => {
        for (const dispose of disposers) dispose()
        await rm(baseDir, { recursive: true, force: true })
    })
    return { store, baseDir, disposers, ctx }
}
const catalog = {
    models: {
        'opaque-id': {
            id: 'opaque-id',
            tool_call: false,
            modalities: { input: ['text', 'image'] },
            limit: { context: 12345 }
        }
    }
}

test('offline startup keeps cached metadata and establishes periodic retry/disposal; recovery clears status', async (t) => {
    const events = []
    let fail = true
    let calls = 0
    let scheduled
    let cleared = false
    const originalSet = global.setInterval,
        originalClear = global.clearInterval
    global.setInterval = (callback) => {
        scheduled = callback
        return { test: true }
    }
    global.clearInterval = () => {
        cleared = true
    }
    t.after(() => {
        global.setInterval = originalSet
        global.clearInterval = originalClear
    })
    let updated = 0
    const { store, disposers } = await fixture(
        t,
        async () => {
            calls++
            if (fail) throw new Error('offline')
            return { data: catalog }
        },
        {
            onStatus: (error) => events.push(error?.message ?? 'ok'),
            onUpdate: async () => {
                updated++
            }
        }
    )
    await writeFile(store.path, JSON.stringify(catalog))
    await assert.rejects(store.start(), /offline/)
    assert.equal(store.getMaxTokens('openai', 'opaque-id'), 12345)
    assert.equal(typeof scheduled, 'function')
    assert.equal(disposers.length, 1)
    fail = false
    scheduled()
    await store.refresh()
    await new Promise((resolve) => setImmediate(resolve))
    assert.equal(updated, 1)
    assert.deepEqual(events, ['offline', 'ok'])
    assert.equal(calls, 2)
    disposers[0]()
    assert(cleared)
    await store.refresh()
    assert.equal(calls, 2)
})

test('corrupt cache recovers, refresh coalesces and atomically replaces cache with no temp leftovers', async (t) => {
    let calls = 0
    const { store, baseDir } = await fixture(t, async () => {
        calls++
        await new Promise((resolve) => setImmediate(resolve))
        return { data: catalog }
    })
    await writeFile(store.path, '{broken')
    await store.start()
    assert.equal(store.getMaxTokens('openai', 'opaque-id'), 12345)
    const first = store.refresh()
    assert.equal(first, store.refresh())
    await first
    assert.equal(calls, 2)
    assert.deepEqual(JSON.parse(await readFile(store.path, 'utf8')), catalog)
    assert.deepEqual(await readdir(baseDir), ['catalog.json'])
})

test('invalid remote catalog preserves last usable disk and memory cache', async (t) => {
    let data = catalog
    const { store } = await fixture(t, async () => ({ data }))
    await store.refresh()
    data = { error: 'rate limited' }
    await assert.rejects(store.refresh(), /Invalid or empty/)
    assert.equal(store.getMaxTokens('openai', 'opaque-id'), 12345)
    assert.deepEqual(JSON.parse(await readFile(store.path, 'utf8')), catalog)
    data = {
        models: { 'opaque-id': catalog.models['opaque-id'], broken: null }
    }
    await assert.rejects(store.refresh(), /Invalid or empty/)
    assert.deepEqual(JSON.parse(await readFile(store.path, 'utf8')), catalog)
})

test('disposing an in-flight download aborts it and cannot overwrite the cached catalog', async (t) => {
    let aborted = false
    let fail = false
    let entered
    const started = new Promise((resolve) => {
        entered = resolve
    })
    const { store, disposers } = await fixture(t, async (_url, options) => {
        if (!fail) return { data: catalog }
        entered()
        return new Promise((_resolve, reject) =>
            options.signal.addEventListener('abort', () => {
                aborted = true
                reject(new Error('aborted'))
            })
        )
    })
    await store.start()
    fail = true
    const refreshing = store.refresh()
    const rejection = assert.rejects(refreshing, /aborted/)
    await started
    disposers[0]()
    await rejection
    assert(aborted)
    assert.deepEqual(JSON.parse(await readFile(store.path, 'utf8')), catalog)
})

test('fallback fetch has a bounded abort signal and cancels on dispose', async (t) => {
    const originalFetch = global.fetch
    let signal
    let entered
    const started = new Promise((resolve) => {
        entered = resolve
    })
    global.fetch = (_url, options) => {
        signal = options.signal
        entered()
        return new Promise((_resolve, reject) =>
            signal.addEventListener('abort', () => reject(new Error('aborted')))
        )
    }
    t.after(() => {
        global.fetch = originalFetch
    })
    const { store, disposers } = await fixture(t, undefined)
    const starting = store.start()
    const rejection = assert.rejects(starting, /aborted/)
    await started
    assert(signal instanceof AbortSignal)
    disposers[0]()
    await rejection
})

test('metadata negatives beat name guesses, but explicit API declarations beat metadata', async (t) => {
    const data = {
        models: {
            'gpt-4o-vision': {
                tool_call: false,
                modalities: { input: ['text'] },
                limit: { context: 100 }
            }
        }
    }
    const { store } = await fixture(t, async () => ({ data }))
    await store.refresh()
    const [entry] = parseOpenAIModels({ data: [{ id: 'gpt-4o-vision' }] })
    assert.deepEqual(
        resolveCapabilities('openai-chat', store.enhance('openai', entry)),
        []
    )
    const [override] = parseOpenAIModels({
        data: [
            { id: 'gpt-4o-vision', supports_image_in: true, tool_call: true }
        ]
    })
    const caps = resolveCapabilities(
        'openai-chat',
        store.enhance('openai', override)
    )
    assert(caps.includes(Cap.ImageInput))
    assert(caps.includes(Cap.ToolCall))
})

test('provider-qualified metadata does not leak capabilities between ambiguous model IDs', async (t) => {
    const data = {
        first: {
            models: {
                shared: {
                    id: 'shared',
                    tool_call: true,
                    limit: { context: 100 }
                }
            }
        },
        second: {
            models: {
                shared: {
                    id: 'shared',
                    tool_call: false,
                    limit: { context: 200 }
                }
            }
        }
    }
    const { store } = await fixture(t, async () => ({ data }))
    await store.refresh()
    assert.equal(store.getMaxTokens('first', 'shared'), 100)
    assert.equal(store.getMaxTokens('second', 'shared'), 200)
    assert.equal(store.getMaxTokens('unknown', 'shared'), undefined)
})

test('console refresh updates metadata before models, and clears recovered metadata errors', async () => {
    const entry = load('index.ts')
    entry.apply(
        { baseDir: tmpdir(), logger: () => log, on() {} },
        { webui: false }
    )
    const calls = []
    const service = Object.create(entry.ModelHubConsoleService.prototype)
    const runtime = {
        clients: new Map([
            [
                'test',
                {
                    reloadModels: async () => {
                        calls.push('models')
                        return [1]
                    },
                    registerSelf: () => calls.push('register')
                }
            ]
        ]),
        errors: new Map([['__metadata__', 'offline']])
    }
    service._options = {
        runtime,
        refreshMetadata: async () => {
            calls.push('metadata')
        }
    }
    service.ctx = {
        chatluna: {
            platform: { unregisterClient() {}, createClient: async () => {} }
        }
    }
    service.refresh = async () => {}
    const result = await service.refreshProvider('test')
    assert.equal(result.success, true)
    assert.deepEqual(calls, ['metadata', 'models', 'register'])
    service._options.refreshMetadata = async () => {
        throw new Error('offline')
    }
    const offline = await service.refreshProvider('test')
    assert.equal(offline.models, 1)
    assert.equal(offline.errors.__metadata__, 'offline')
})

test('plugin startup and settings reload do not erase metadata recovery errors', async (t) => {
    const entry = load('index.ts')
    const baseDir = await mkdtemp(join(tmpdir(), 'model-hub-startup-test-'))
    const events = new Map()
    let options
    const ctx = {
        baseDir,
        logger: () => log,
        http: async () => {
            throw new Error('offline')
        },
        on: (name, callback) => events.set(name, callback),
        get: () => undefined,
        inject: (_services, callback) => callback(ctx),
        plugin: (_plugin, value) => {
            options = value
        },
        console: { addListener() {}, addEntry() {} },
        chatluna: { platform: { unregisterClient() {} }, uninstallPlugin() {} }
    }
    t.after(async () => {
        events.get('dispose')?.()
        await rm(baseDir, { recursive: true, force: true })
    })
    entry.apply(ctx, {
        webui: true,
        metadataCachePath: 'catalog.json',
        settingsPath: 'settings.json'
    })
    await events.get('ready')()
    assert.equal(options.runtime.errors.get('__metadata__'), 'offline')
    await options.saveSettings({
        providers: [],
        additionalModels: [],
        blacklistModels: []
    })
    assert.equal(options.runtime.errors.get('__metadata__'), 'offline')
})
