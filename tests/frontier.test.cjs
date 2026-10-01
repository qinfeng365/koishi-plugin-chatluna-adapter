const { test } = require('node:test')
const assert = require('node:assert/strict')
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
const { resolveCapabilities } = load('capabilities.ts')
const { ModelHubRequester } = load('requester.ts')
const { applyReasoningProtocol } = load('adapters/reasoning-protocols.ts')
const { parseOpenAIModels } = load('adapters/model-list.ts')

function fixture(
    options = {},
    reply = { choices: [{ message: { role: 'assistant', content: 'ok' } }] }
) {
    const requests = []
    const config = {
        apiKey: '',
        apiEndpoint: 'https://example.test/v1',
        platform: 'test',
        provider: 'openai-compatible',
        nonStreaming: true,
        customHeaders: [],
        timeout: 1000,
        maxRetries: 0,
        ...options
    }
    const ref = { value: config, md5: () => 'test' }
    const logger = { warn() {}, info() {}, error() {}, debug() {} }
    const plugin = {
        fetch: async (url, init = {}) => {
            requests.push({
                url,
                body:
                    typeof init.body === 'string'
                        ? JSON.parse(init.body)
                        : init.body,
                method: init.method
            })
            const data =
                typeof reply === 'function' ? reply(requests.at(-1)) : reply
            if (data instanceof Response) return data
            return typeof data === 'string'
                ? new Response(data, {
                      headers: { 'content-type': 'text/event-stream' }
                  })
                : new Response(JSON.stringify(data))
        }
    }
    const requester = new ModelHubRequester(
        { logger: () => logger, chatluna: { currentConfig: { isLog: false } } },
        { getConfig: () => ref, markConfigStatus() {} },
        config,
        plugin
    )
    Object.defineProperty(requester, 'logger', { value: logger })
    return { requester, requests, config, plugin }
}
const params = (
    model,
    input = [new HumanMessage('hello')],
    overrideRequestParams
) => ({ model, input, maxTokens: 4096, overrideRequestParams, timeout: 1000 })
async function collect(iterator) {
    let result
    for await (const chunk of iterator)
        result = result ? result.concat(chunk) : chunk
    return result
}
const sse = (frames) =>
    frames.map((frame) => `data: ${JSON.stringify(frame)}\n\n`).join('') +
    'data: [DONE]\n\n'

test('DeepSeek keeps effort at top level with official compatibility mappings', () => {
    for (const [value, expected] of Object.entries({
        none: 'none',
        minimal: 'low',
        low: 'low',
        medium: 'high',
        high: 'high',
        xhigh: 'high',
        max: 'max',
        ultra: 'max'
    })) {
        const body = { reasoning_effort: value }
        applyReasoningProtocol('deepseek', body, 'deepseek-v4-flash')
        assert.equal(body.reasoning_effort, expected)
        assert.deepEqual(body.thinking, {
            type: value === 'none' ? 'disabled' : 'enabled'
        })
    }
    assert.ok(
        parseOpenAIModels(
            { data: [{ id: 'deepseek-v4-flash' }] },
            { id: 'deepseek', reasoningEffort: 'deepseek' }
        ).some((m) => m.name.endsWith('-low-thinking'))
    )
})

test('six provider presets preserve top-level effort and enforce known model limits', async () => {
    for (const [provider, model] of Object.entries({
        moonshot: 'kimi-k3',
        zhipu: 'glm-5.3',
        minimax: 'MiniMax-M3.1-Flash-Preview',
        groq: 'qwen/qwen3-32b',
        stepfun: 'step-5-preview',
        together: 'Qwen/Qwen3-235B'
    })) {
        const { requester, requests } = fixture({ provider })
        await requester.completion(
            params(model, undefined, { reasoning_effort: 'low' })
        )
        assert.equal(requests[0].body.reasoning_effort, 'low', provider)
    }
    const { requester } = fixture({ provider: 'moonshot' })
    await assert.rejects(
        requester.completion(
            params('kimi-k3', undefined, { reasoning_effort: 'none' })
        ),
        (error) => /supports reasoning_effort/.test(error.originError?.message)
    )
})

test('Claude thinking follows model versions and explicit override remains authoritative', async () => {
    for (const [model, type] of [
        ['claude-sonnet-4-5-high-thinking', 'enabled'],
        ['claude-sonnet-4-6-high-thinking', 'adaptive'],
        ['claude-opus-4-7-high-thinking', 'adaptive'],
        ['claude-opus-5-5', 'adaptive']
    ]) {
        const { requester, requests } = fixture(
            { provider: 'anthropic' },
            { content: [{ type: 'text', text: 'ok' }] }
        )
        await requester.completion(params(model))
        assert.equal(requests[0].body.thinking.type, type)
        if (type === 'enabled')
            assert.ok(
                requests[0].body.thinking.budget_tokens <
                    requests[0].body.max_tokens
            )
        if (model.includes('sonnet-4-5'))
            assert.equal(requests[0].body.output_config, undefined)
    }
    const { requester, requests } = fixture(
        { provider: 'anthropic' },
        { content: [{ type: 'text', text: 'ok' }] }
    )
    await requester.completion(
        params('claude-opus-4-6', undefined, { thinking: { type: 'disabled' } })
    )
    assert.equal(requests[0].body.thinking.type, 'disabled')
    await assert.rejects(
        requester.completion(params('claude-opus-4-6-xhigh-thinking')),
        /does not support effort/
    )
})

test('Gemini blocks and mid-stream errors propagate; truncated output is marked', async () => {
    const { parseGeminiResponse, createGeminiToolNameMapper } =
        load('adapters/gemini.ts')
    const { requester } = fixture({ provider: 'gemini' })
    const mapper = createGeminiToolNameMapper([])
    for (const data of [
        { promptFeedback: { blockReason: 'SAFETY' } },
        { candidates: [{ finishReason: 'MALFORMED_FUNCTION_CALL' }] },
        { error: { message: 'quota' } },
        {}
    ]) {
        await assert.rejects(
            parseGeminiResponse(JSON.stringify(data), requester, mapper)
        )
    }
    const result = await parseGeminiResponse(
        JSON.stringify({
            candidates: [
                {
                    finishReason: 'MAX_TOKENS',
                    content: { parts: [{ text: 'partial' }] }
                }
            ]
        }),
        requester,
        mapper
    )
    assert.equal(result.text, 'partial')
    assert.equal(result.message.response_metadata.finishReason, 'MAX_TOKENS')
    const stream = fixture(
        { provider: 'gemini', nonStreaming: false },
        sse([
            { candidates: [{ content: { parts: [{ text: 'partial' }] } }] },
            { error: { message: 'stream failed' } }
        ])
    )
    await assert.rejects(
        collect(stream.requester.completionStream(params('gemini-3-flash'))),
        (error) => /stream failed/.test(error.originError?.message)
    )
})

test('Gemini generated images are standard message content and audio is not mislabeled', async () => {
    const { parseGeminiResponse, createGeminiToolNameMapper } =
        load('adapters/gemini.ts')
    const { requester } = fixture({ provider: 'gemini' })
    const result = await parseGeminiResponse(
        JSON.stringify({
            candidates: [
                {
                    content: {
                        parts: [
                            { text: 'draw' },
                            {
                                inlineData: {
                                    mimeType: 'image/png',
                                    data: 'aGVsbG8='
                                }
                            },
                            {
                                inline_data: {
                                    mime_type: 'audio/wav',
                                    data: 'aGVsbG8='
                                }
                            }
                        ]
                    }
                }
            ]
        }),
        requester,
        createGeminiToolNameMapper([])
    )
    assert.equal(result.message.content[1].type, 'image_url')
    assert.equal(result.message.content[2].type, 'audio_url')
    assert.equal(result.message.additional_kwargs.images.length, 1)
})

test('modern name fallback is conservative and API denials still win', () => {
    for (const name of [
        'gpt-6.1-sol',
        'kimi-k3',
        'MiniMax-M3.1-Flash-Preview',
        'glm-5.3-flash'
    ])
        assert.ok(
            resolveCapabilities('openai-chat', { name }).includes(Cap.Thinking),
            name
        )
    assert.ok(
        resolveCapabilities('openai-chat', { name: 'kimi-k3' }).includes(
            Cap.VideoInput
        )
    )
    assert.ok(
        !resolveCapabilities('openai-chat', {
            name: 'kimi-k3',
            capabilityOverrides: { [Cap.ImageInput]: false }
        }).includes(Cap.ImageInput)
    )
})

test('Chat and Responses preserve image details, extensions and explicit cache breakpoints', async () => {
    for (const responseApi of [false, true]) {
        const { requester, requests } = fixture(
            { provider: 'openai', responseApi },
            responseApi
                ? {
                      output: [
                          {
                              type: 'message',
                              role: 'assistant',
                              content: [{ type: 'output_text', text: 'ok' }]
                          }
                      ]
                  }
                : undefined
        )
        const content = [
            {
                type: 'text',
                text: 'describe',
                prompt_cache_breakpoint: { mode: 'explicit' }
            },
            {
                type: 'image_url',
                image_url: {
                    url: 'data:image/png;base64,aGVsbG8=',
                    detail: 'high',
                    max_pixels: 2048
                }
            }
        ]
        await requester.completion(
            params('gpt-4o', [new HumanMessage({ content })], {
                prompt_cache_options: { mode: 'explicit', ttl: '30m' }
            })
        )
        const sent = responseApi
            ? requests[0].body.input[0].content
            : requests[0].body.messages[0].content
        assert.deepEqual(sent[0].prompt_cache_breakpoint, { mode: 'explicit' })
        const image = responseApi ? sent[1] : sent[1].image_url
        assert.equal(image.detail, 'high')
        assert.equal(image.max_pixels, 2048)
        assert.equal(content[1].image_url.detail, 'high')
    }
})

test('OpenAI/Qwen write-cache and StepFun read-cache accounting covers zero and streaming', async () => {
    for (const field of ['cache_write_tokens', 'cache_creation_input_tokens']) {
        for (const value of [0, 30]) {
            const usage = {
                prompt_tokens: 100,
                completion_tokens: 10,
                total_tokens: 110,
                cached_tokens: 60,
                prompt_tokens_details: { [field]: value }
            }
            for (const streaming of [false, true]) {
                const reply = streaming
                    ? sse([
                          {
                              choices: [
                                  {
                                      delta: {
                                          content: 'ok',
                                          reasoning: 'reason'
                                      }
                                  }
                              ]
                          },
                          { choices: [], usage }
                      ])
                    : {
                          choices: [
                              {
                                  message: {
                                      content: 'ok',
                                      reasoning: 'reason'
                                  }
                              }
                          ],
                          usage
                      }
                const { requester } = fixture(
                    { provider: 'stepfun', nonStreaming: !streaming },
                    reply
                )
                const result = streaming
                    ? await collect(
                          requester.completionStream(params('unknown-model'))
                      )
                    : await requester.completion(params('unknown-model'))
                assert.equal(
                    result.message.usage_metadata.input_token_details
                        .cache_creation,
                    value
                )
                assert.equal(
                    result.message.usage_metadata.input_token_details
                        .cache_read,
                    60
                )
                assert.equal(
                    result.message.additional_kwargs.reasoning_content,
                    'reason'
                )
            }
        }
    }
})

test('GPT-6 routes tools to Responses and opaque history/phase survives both response modes', async () => {
    const output = [
        { type: 'reasoning', id: 'rs_mock', encrypted_content: 'opaque' },
        {
            type: 'message',
            id: 'msg_mock',
            role: 'assistant',
            phase: 'commentary',
            content: [
                {
                    type: 'output_text',
                    text: 'checking',
                    annotations: [
                        { type: 'url_citation', url: 'https://example.test' }
                    ]
                }
            ]
        },
        {
            type: 'function_call',
            call_id: 'call_mock',
            name: 'lookup',
            arguments: '{}'
        }
    ]
    for (const streaming of [false, true]) {
        const response = {
            id: 'resp_mock',
            output,
            usage: {
                input_tokens: 100,
                output_tokens: 10,
                total_tokens: 110,
                input_tokens_details: {
                    cached_tokens: 60,
                    cache_write_tokens: 30
                }
            }
        }
        const frames = [
            { type: 'response.output_text.delta', delta: 'checking' },
            {
                type: 'response.output_item.added',
                output_index: 2,
                item: output[2]
            },
            {
                type: 'response.function_call_arguments.done',
                output_index: 2,
                arguments: '{}'
            },
            { type: 'response.completed', response }
        ]
        const { requester, requests, config } = fixture(
            { provider: 'openai', nonStreaming: !streaming },
            (request) => (request.body.stream ? sse(frames) : response)
        )
        const request = params('gpt-6.1-sol-low-thinking')
        const result = streaming
            ? await collect(requester.completionStream(request))
            : await requester.completion(request)
        assert.ok(requests[0].url.endsWith('/responses'))
        assert.equal(requests[0].body.reasoning.effort, 'low')
        assert.equal(requests[0].body.store, false)
        assert.ok(
            requests[0].body.include.includes('reasoning.encrypted_content')
        )
        assert.equal(
            result.message.usage_metadata.input_token_details.cache_creation,
            30
        )
        config.nonStreaming = true
        await requester.completion(
            params('gpt-6.1-sol-low-thinking', [
                new HumanMessage('hello'),
                result.message,
                new ToolMessage({ content: 'found', tool_call_id: 'call_mock' })
            ])
        )
        assert.deepEqual(requests[1].body.input.slice(1, 4), output)
        assert.equal(requests[1].body.input[4].type, 'function_call_output')
    }
})

test('explicit overrides beat generated bridge serialization and cache defaults', async () => {
    const { requester, requests } = fixture(
        {
            provider: 'openai',
            responseApi: true,
            promptCacheMode: 'explicit',
            promptCacheTtl: '30m'
        },
        { output: [] }
    )
    const input = [{ type: 'message', role: 'user', content: 'custom' }]
    await requester.completion(
        params('gpt-4o', undefined, {
            input,
            reasoning: { effort: 'high' },
            prompt_cache_options: { mode: 'implicit', ttl: '5m' },
            include: ['custom']
        })
    )
    assert.deepEqual(requests[0].body.input, input)
    assert.deepEqual(requests[0].body.prompt_cache_options, {
        mode: 'implicit',
        ttl: '5m'
    })
    assert.equal(requests[0].body.reasoning.effort, 'high')
})

test('Claude server tool blocks and citations round-trip in non-streaming and streaming', async () => {
    const blocks = [
        {
            type: 'server_tool_use',
            id: 'srv_1',
            name: 'web_search',
            input: { query: 'test' }
        },
        {
            type: 'web_search_tool_result',
            tool_use_id: 'srv_1',
            content: [
                {
                    type: 'web_search_result',
                    title: 'test',
                    url: 'https://example.test',
                    encrypted_content: 'opaque'
                }
            ]
        },
        {
            type: 'text',
            text: 'answer',
            citations: [
                {
                    type: 'web_search_result_location',
                    url: 'https://example.test',
                    title: 'test',
                    encrypted_index: 'opaque'
                }
            ]
        }
    ]
    for (const streaming of [false, true]) {
        const frames = blocks.flatMap((block, index) => [
            {
                type: 'content_block_start',
                index,
                content_block:
                    block.type === 'text'
                        ? { ...block, text: '', citations: [] }
                        : block
            },
            ...(block.type === 'text'
                ? [
                      {
                          type: 'content_block_delta',
                          index,
                          delta: { type: 'text_delta', text: block.text }
                      },
                      {
                          type: 'content_block_delta',
                          index,
                          delta: {
                              type: 'citations_delta',
                              citation: block.citations[0]
                          }
                      }
                  ]
                : []),
            { type: 'content_block_stop', index }
        ])
        const { requester, requests, config } = fixture(
            { provider: 'anthropic', nonStreaming: !streaming },
            (request) =>
                request.body.stream ? sse(frames) : { content: blocks }
        )
        const result = streaming
            ? await collect(
                  requester.completionStream(params('claude-sonnet-4-6'))
              )
            : await requester.completion(params('claude-sonnet-4-6'))
        config.nonStreaming = true
        await requester.completion(
            params('claude-sonnet-4-6', [
                new HumanMessage('search'),
                result.message,
                new HumanMessage('continue')
            ])
        )
        assert.deepEqual(requests[1].body.messages[1].content, blocks)
    }
})

test('xAI Responses defaults normalize and send its native built-in tools', async () => {
    const { normalizeSettings, createResolvedConfig, toConsoleSettings } =
        load('settings.ts')
    const settings = normalizeSettings({
        providers: [
            {
                id: 'xai',
                provider: 'xai',
                apiKey: '',
                responseBuiltinTools: ['web_search', 'x_search']
            }
        ]
    })
    const config = createResolvedConfig({}, settings)
    assert.equal(config.providers[0].responseApi, true)
    assert.equal(toConsoleSettings(settings).providers[0].responseApi, true)
    const { requester, requests } = fixture(config.providers[0], { output: [] })
    await requester.completion(params('grok-4'))
    assert.ok(requests[0].url.endsWith('/responses'))
    assert.ok(requests[0].body.tools.some((tool) => tool.type === 'x_search'))
})

test('Gemini structured output, cached prefix, raw override and settings round-trip', async () => {
    const { normalizeSettings, createResolvedConfig, toConsoleSettings } =
        load('settings.ts')
    const schema = {
        type: 'object',
        properties: { answer: { type: 'string' } },
        required: ['answer'],
        additionalProperties: false
    }
    const settings = normalizeSettings({
        providers: [
            {
                provider: 'gemini',
                apiKey: '',
                geminiApi: 'interactions',
                geminiFileUpload: true,
                geminiMaxFileSizeMb: 128,
                geminiResponseJsonSchema: schema,
                geminiCachedContent: 'cachedContents/mock'
            }
        ]
    })
    const normalized = createResolvedConfig({}, settings).providers[0]
    assert.deepEqual(
        toConsoleSettings(settings).providers[0].geminiResponseJsonSchema,
        schema
    )
    assert.equal(normalized.geminiApi, 'interactions')
    const { requester, requests } = fixture(
        { ...normalized, geminiApi: 'generateContent', googleSearch: true },
        { candidates: [{ content: { parts: [{ text: '{}' }] } }] }
    )
    await requester.completion(
        params('gemini-3.8-flash', [new HumanMessage('hello')], {
            generationConfig: { temperature: 0.25 },
            safetySettings: []
        })
    )
    assert.equal(requests[0].body.cachedContent, 'cachedContents/mock')
    assert.deepEqual(
        requests[0].body.generationConfig.responseJsonSchema,
        schema
    )
    assert.equal(
        requests[0].body.generationConfig.responseMimeType,
        'application/json'
    )
    assert.equal(requests[0].body.generationConfig.temperature, 0.25)
    assert.equal(requests[0].body.tools, undefined)
    assert.deepEqual(requests[0].body.safetySettings, [])
    assert.equal(requests[0].body.model, undefined)
})

test('Gemini Files upload is opt-in, resumable, credential-scoped and reuses unexpired files', async () => {
    const file = {
        name: 'files/mock',
        uri: 'https://example.test/v1beta/files/mock',
        mimeType: 'application/pdf',
        state: 'ACTIVE',
        expirationTime: new Date(Date.now() + 3600_000).toISOString()
    }
    const { requester, requests, config } = fixture(
        {
            provider: 'gemini',
            apiEndpoint: 'https://example.test/v1beta',
            geminiFileUpload: true,
            geminiMaxFileSizeMb: 1
        },
        (request) => {
            if (request.url.includes('/upload/v1beta/files'))
                return new Response('{}', {
                    headers: {
                        'x-goog-upload-url':
                            'https://example.test/upload/session'
                    }
                })
            if (request.url.includes('/upload/session')) return { file }
            return { candidates: [{ content: { parts: [{ text: 'ok' }] } }] }
        }
    )
    const input = [
        new HumanMessage({
            content: [
                {
                    type: 'file_url',
                    file_url: {
                        url: 'data:application/pdf;base64,aGVsbG8=',
                        mimeType: 'application/pdf'
                    }
                }
            ]
        })
    ]
    await requester.completion(params('gemini-3.8-flash', input))
    assert.equal(requests[0].method, 'POST')
    assert.ok(requests[0].url.includes('/upload/v1beta/files'))
    assert.equal(
        requests[2].body.contents[0].parts[0].file_data.file_uri,
        file.uri
    )
    await requester.completion(params('gemini-3.8-flash', input))
    assert.equal(requests.length, 4, 'second generation reuses upload')
    config.geminiFileUpload = false
    await assert.rejects(
        requester
            .geminiResources()
            .upload(Buffer.from('hello'), 'application/pdf'),
        /disabled/
    )
    config.geminiFileUpload = true
    await assert.rejects(
        requester
            .geminiResources()
            .upload(Buffer.alloc(1024 * 1024 + 1), 'application/pdf'),
        /limit/
    )
})

test('Gemini cache CRUD uses correct methods, TTL and validated scoped names', async () => {
    const { requester, requests } = fixture(
        { provider: 'gemini' },
        { name: 'cachedContents/mock' }
    )
    const resources = requester.geminiResources()
    await resources.request({
        resource: 'cachedContents',
        action: 'create',
        body: { model: 'models/gemini-3.8-flash', ttl: '3600s', contents: [] }
    })
    await resources.request({
        resource: 'cachedContents',
        action: 'update',
        name: 'cachedContents/mock',
        body: { ttl: '7200s' }
    })
    await resources.request({
        resource: 'cachedContents',
        action: 'list',
        pageToken: 'a&b'
    })
    await resources.request({
        resource: 'cachedContents',
        action: 'delete',
        name: 'cachedContents/mock'
    })
    assert.deepEqual(
        requests.map((r) => r.method),
        ['POST', 'PATCH', 'GET', 'DELETE']
    )
    assert.equal(requests[1].body.ttl, '7200s')
    assert.ok(requests[2].url.includes('pageToken=a%26b'))
    await assert.rejects(
        resources.request({
            resource: 'files',
            action: 'delete',
            name: 'files/../../models'
        }),
        /Invalid/
    )
    await assert.rejects(
        resources.request({ resource: 'files', action: 'create' }),
        /Unsupported/
    )
    const foreign = fixture({ provider: 'openai' })
    await assert.rejects(
        foreign.requester
            .geminiResources()
            .request({ resource: 'files', action: 'list' }),
        /Gemini provider/
    )
})

test('Gemini Files never sends credentials to a changed upload origin', async () => {
    const { requester, requests } = fixture(
        { provider: 'gemini', geminiFileUpload: true },
        new Response('{}', {
            headers: { 'x-goog-upload-url': 'https://evil.test/upload' }
        })
    )
    await assert.rejects(
        requester
            .geminiResources()
            .upload(Buffer.from('hello'), 'application/pdf'),
        /changed origin/
    )
    assert.equal(requests.length, 1)
})

test('Gemini Interactions uses current steps schema, stateless history and native JSON output', async () => {
    const steps = [
        {
            type: 'thought',
            signature: 'opaque',
            summary: [{ type: 'text', text: 'plan' }]
        },
        { type: 'model_output', content: [{ type: 'text', text: 'checking' }] },
        { type: 'function_call', id: 'fc_1', name: 'lookup', arguments: {} },
        { type: 'function_call', id: 'fc_2', name: 'lookup2', arguments: {} }
    ]
    const { requester, requests } = fixture(
        {
            provider: 'gemini',
            geminiApi: 'interactions',
            geminiResponseJsonSchema: { type: 'object' }
        },
        { id: 'int_mock', status: 'requires_action', steps }
    )
    const result = await requester.completion(params('gemini-3.8-flash'))
    assert.ok(requests[0].url.endsWith('/interactions'))
    assert.equal(requests[0].body.store, false)
    assert.equal(requests[0].body.input[0].type, 'user_input')
    assert.deepEqual(requests[0].body.response_format, [
        {
            type: 'text',
            mime_type: 'application/json',
            schema: { type: 'object' }
        }
    ])
    assert.equal(result.message.tool_calls.length, 2)
    await requester.completion(
        params('gemini-3.8-flash', [
            new HumanMessage('hello'),
            result.message,
            new ToolMessage({
                content: 'result',
                tool_call_id: 'fc_1',
                name: 'lookup'
            }),
            new ToolMessage({
                content: 'result2',
                tool_call_id: 'fc_2',
                name: 'lookup2'
            }),
            new HumanMessage('continue')
        ])
    )
    assert.deepEqual(requests[1].body.input.slice(1, 5), steps)
    assert.deepEqual(
        requests[1].body.input.slice(5).map((s) => s.type),
        ['function_result', 'function_result', 'user_input']
    )
})

test('Gemini Interactions streaming emits text once, stable tools, signed steps and final usage', async () => {
    const frames = [
        {
            event_type: 'interaction.created',
            interaction: { id: 'int_stream', status: 'in_progress' }
        },
        { event_type: 'step.start', index: 0, step: { type: 'thought' } },
        {
            event_type: 'step.delta',
            index: 0,
            delta: { type: 'thought_signature', signature: 'opaque' }
        },
        { event_type: 'step.stop', index: 0 },
        { event_type: 'step.start', index: 1, step: { type: 'model_output' } },
        {
            event_type: 'step.delta',
            index: 1,
            delta: { type: 'text', text: 'ok' }
        },
        { event_type: 'step.stop', index: 1 },
        ...[2, 3].flatMap((index) => [
            {
                event_type: 'step.start',
                index,
                step: {
                    type: 'function_call',
                    id: `fc_${index}`,
                    name: 'lookup',
                    arguments: {}
                }
            },
            {
                event_type: 'step.delta',
                index,
                delta: { type: 'arguments_delta', arguments: '{"q":"test"}' }
            },
            { event_type: 'step.stop', index }
        ]),
        {
            event_type: 'interaction.completed',
            interaction: {
                status: 'requires_action',
                usage: {
                    total_tokens: 15,
                    total_input_tokens: 10,
                    total_output_tokens: 5,
                    total_cached_tokens: 4
                }
            }
        }
    ]
    const { requester } = fixture(
        { provider: 'gemini', geminiApi: 'interactions', nonStreaming: false },
        sse(frames)
    )
    const result = await collect(
        requester.completionStream(params('gemini-3.8-flash'))
    )
    assert.equal(result.text, 'ok')
    assert.equal(result.message.tool_calls.length, 2)
    assert.equal(
        result.message.additional_kwargs.hub_gemini_interaction.steps[0]
            .signature,
        'opaque'
    )
    assert.equal(
        result.message.additional_kwargs.hub_gemini_interaction.steps.length,
        4
    )
    assert.equal(
        result.message.usage_metadata.input_token_details.cache_read,
        4
    )
    const broken = fixture(
        { provider: 'gemini', geminiApi: 'interactions', nonStreaming: false },
        sse(frames.slice(0, -1))
    )
    await assert.rejects(
        collect(broken.requester.completionStream(params('gemini-3.8-flash')))
    )
})

test('Claude strict schema and modern effort lists agree with actual requests', async () => {
    const { tool } = require('@langchain/core/tools')
    const { z } = require('zod')
    const strictTool = tool(async () => 'ok', {
        name: 'lookup',
        description: 'lookup',
        schema: z.object({ query: z.string() }).strict(),
        metadata: { strict: true }
    })
    const { requester, requests } = fixture(
        { provider: 'anthropic' },
        { content: [{ type: 'text', text: 'ok' }] }
    )
    await requester.completion({
        ...params('claude-sonnet-4-6-max-thinking'),
        tools: [strictTool]
    })
    assert.equal(requests[0].body.tools[0].strict, true)
    assert.equal(
        requests[0].body.tools[0].input_schema.additionalProperties,
        false
    )
    assert.equal(requests[0].body.output_config.effort, 'max')
    await requester.completion(params('claude-fable-5-high-thinking'))
    assert.equal(requests[1].body.thinking.type, 'adaptive')
    const { parseAnthropicModels } = load('adapters/model-list.ts')
    const models = parseAnthropicModels({
        data: [{ id: 'claude-opus-5-5' }, { id: 'claude-sonnet-5-5' }]
    })
    assert.ok(models[0].reasoningEfforts.includes('xhigh'))
    assert.ok(models[1].reasoningEfforts.includes('max'))
})

test('configured explicit cache creates a breakpoint even for ordinary string messages', async () => {
    for (const responseApi of [false, true]) {
        const { requester, requests } = fixture(
            {
                provider: 'openai',
                responseApi,
                promptCacheMode: 'explicit',
                promptCacheTtl: '30m'
            },
            responseApi ? { output: [] } : undefined
        )
        await requester.completion(params('gpt-4o'))
        const content = responseApi
            ? requests[0].body.input[0].content
            : requests[0].body.messages[0].content
        assert.deepEqual(content[0].prompt_cache_breakpoint, {
            mode: 'explicit'
        })
        assert.equal(requests[0].body.prompt_cache_options.mode, 'explicit')
    }
})

test('reasoning/model raw overrides win over synthetic variant suffixes', async () => {
    const { requester, requests } = fixture({ provider: 'deepseek' })
    await requester.completion(
        params('deepseek-v4-high-thinking', undefined, {
            model: 'deepseek-flash',
            reasoning_effort: 'low'
        })
    )
    assert.equal(requests[0].body.model, 'deepseek-flash')
    assert.equal(requests[0].body.reasoning_effort, 'low')
})

test('simultaneous Responses calls on one requester never share opaque history', async () => {
    const { requester } = fixture(
        { provider: 'openai', responseApi: true },
        (request) => ({
            output: [
                {
                    type: 'reasoning',
                    encrypted_content: request.body.input[0].content
                }
            ],
            id: request.body.input[0].content
        })
    )
    const results = await Promise.all(
        ['first', 'second'].map((text) =>
            requester.completion(params('gpt-4o', [new HumanMessage(text)]))
        )
    )
    assert.equal(
        results[0].message.additional_kwargs.hub_response.output[0]
            .encrypted_content,
        'first'
    )
    assert.equal(
        results[1].message.additional_kwargs.hub_response.output[0]
            .encrypted_content,
        'second'
    )
})

test('Gemini resource disposal aborts in-flight I/O and cannot reuse cleared uploads', async () => {
    const { requester, plugin } = fixture({ provider: 'gemini' })
    let started
    const ready = new Promise((resolve) => {
        started = resolve
    })
    plugin.fetch = (_url, init) =>
        new Promise((_resolve, reject) => {
            started()
            if (init.signal.aborted) reject(init.signal.reason)
            else
                init.signal.addEventListener(
                    'abort',
                    () => reject(init.signal.reason),
                    { once: true }
                )
        })
    const pending = requester
        .geminiResources()
        .request({ resource: 'files', action: 'list' })
    await ready
    await requester.dispose()
    await assert.rejects(pending, /disposed/)
    await assert.rejects(
        requester
            .geminiResources()
            .request({ resource: 'files', action: 'list' }),
        /disposed/
    )
})

test('Gemini deletes accept empty HTTP 204 and pre-aborted uploads make no request', async () => {
    const { requester, requests } = fixture(
        { provider: 'gemini', geminiFileUpload: true },
        new Response(null, { status: 204 })
    )
    assert.deepEqual(
        await requester
            .geminiResources()
            .request({
                resource: 'files',
                action: 'delete',
                name: 'files/mock'
            }),
        {}
    )
    const abort = new AbortController()
    abort.abort(new Error('cancelled'))
    await assert.rejects(
        requester
            .geminiResources()
            .upload(Buffer.from('hello'), 'application/pdf', abort.signal),
        /cancelled/
    )
    assert.equal(requests.length, 1)
})
