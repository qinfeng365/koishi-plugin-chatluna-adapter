// Fixture-based browser QA of the actual Vue components. No Koishi instance,
// credentials, provider API calls, or admin configuration writes are needed.
// Set MODEL_HUB_PLAYWRIGHT to an installed playwright-core module if it is not
// available in the workspace. Screenshots go to an OS temporary directory.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const http = require('node:http')
const { build } = require('esbuild')
const { parse, compileScript, compileStyle } = require('vue/compiler-sfc')
const { chromium } = require(
    process.env.MODEL_HUB_PLAYWRIGHT || 'playwright-core'
)

async function main() {
    const root = path.resolve(__dirname, '..')
    const consoleRoot = path.dirname(
        require.resolve('@koishijs/client/package.json')
    )
    const element = path.join(
        path.dirname(require.resolve('element-plus', { paths: [consoleRoot] })),
        '../es/index.mjs'
    )
    const elementCss = path.join(path.dirname(element), '../dist/index.css')
    const styles = []
    const result = await build({
        stdin: {
            contents: `import {createApp, h} from 'vue'; import ElementPlus from ${JSON.stringify(element)}; import Dashboard from './packages/adapter-model-hub/client/dashboard.vue'; const app=createApp(Dashboard); app.use(ElementPlus); app.component('k-layout',{render(){return h('div',{},[this.$slots.header?.(),this.$slots.default?.()])}}); app.mount('#app');`,
            resolveDir: root,
            loader: 'js'
        },
        bundle: true,
        write: false,
        format: 'iife',
        platform: 'browser',
        define: {
            'process.env.NODE_ENV': '"production"',
            __VUE_OPTIONS_API__: 'true',
            __VUE_PROD_DEVTOOLS__: 'false',
            __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false'
        },
        plugins: [
            {
                name: 'fixture-vue',
                setup(b) {
                    b.onResolve({ filter: /^vue$/ }, () => ({
                        path: require.resolve('vue/dist/vue.runtime.esm-bundler.js')
                    }))
                    b.onResolve({ filter: /^@koishijs\/client$/ }, () => ({
                        path: 'console',
                        namespace: 'mock'
                    }))
                    b.onResolve(
                        {
                            filter: /^koishi-plugin-chatluna\/llm-core\/platform\/types$/
                        },
                        () => ({ path: 'types', namespace: 'mock' })
                    )
                    b.onLoad(
                        { filter: /.*/, namespace: 'mock' },
                        ({ path: name }) => ({
                            contents:
                                name === 'types'
                                    ? `export const ModelCapabilities={TextInput:'text_input',ToolCall:'tool_call',ImageInput:'image_input',Thinking:'thinking',ImageGeneration:'image_generation',AudioInput:'audio_input',VideoInput:'video_input',FileInput:'file_input'};`
                                    : `import {reactive,ref,watch} from 'vue';
export const store=reactive(window.fixture);window.qaStore=store;window.qaCalls=[];
export async function send(event,...args){
    window.qaCalls.push({event,args});
    if(event.endsWith('/getData'))return store.chatluna_model_hub;
    if(event.endsWith('/updateModelCapabilities')){
        if(window.qaCapabilityError)throw new Error(window.qaCapabilityError);
        if(window.qaCapabilityDelay)await new Promise(r=>setTimeout(r,window.qaCapabilityDelay));
        const request=args[0],data=store.chatluna_model_hub;
        if(request.revision!==data.settings.revision)throw new Error('配置已被修改');
        for(const m of data.models){
            if(m.platform!==request.platform||m.providerId!==request.providerId)continue;
            for(const c of m.candidates||[]){
                const update=request.updates.find(u=>u.sourceId===c.sourceId&&u.credentialId===c.credentialId&&u.upstreamModel===c.upstreamModel);
                if(!update)continue;
                c.capabilityOverrides={...update.overrides};
                const caps=new Set(['text_input']);
                for(const [cap,on] of Object.entries(update.overrides))on?caps.add(cap):caps.delete(cap);
                c.capabilities=[...caps];
            }
            if(m.candidates?.length)m.capabilities=m.candidates[0].capabilities.filter(cap=>m.candidates.every(c=>c.capabilities.includes(cap)));
        }
        data.settings={...data.settings,revision:data.settings.revision+1};data.revision++;
        return {success:true,revision:data.settings.revision};
    }
    if(event.endsWith('/saveSettings')){
        const next=JSON.parse(JSON.stringify(args[0]));next.revision=(next.revision||0)+1;
        for(const p of next.providers)for(const s of p.sources||[])for(const c of s.credentials){if(c.apiKey){c.apiKey='';c.hasApiKey=true;c.apiKeyPreview='已保存';c.secretAction='keep'}}
        store.chatluna_model_hub.settings=next;store.chatluna_model_hub.revision++;
    }
    return {success:true};
}
export function useStorage(key,version,fallback){const k='koishi.console.'+key;const state=ref(JSON.parse(localStorage.getItem(k)||'null')||fallback());watch(state,v=>localStorage.setItem(k,JSON.stringify(v)),{deep:true});return state;}`,
                            resolveDir: root,
                            loader: 'js'
                        })
                    )
                    b.onLoad({ filter: /\.vue$/ }, ({ path: filename }) => {
                        const id = `qa-${path.basename(filename, '.vue')}`
                        const { descriptor } = parse(
                            fs.readFileSync(filename, 'utf8'),
                            { filename }
                        )
                        const script = compileScript(descriptor, {
                            id,
                            inlineTemplate: true,
                            genDefaultAs: '__sfc__'
                        })
                        for (const style of descriptor.styles) {
                            const compiled = compileStyle({
                                source: style.content,
                                filename,
                                id: `data-v-${id}`,
                                scoped: !!style.scoped,
                                preprocessLang: style.lang
                            })
                            if (compiled.errors.length) throw compiled.errors[0]
                            styles.push(compiled.code)
                        }
                        return {
                            contents: `${script.content}\n__sfc__.__scopeId='data-v-${id}'; export default __sfc__;`,
                            loader: 'ts',
                            resolveDir: path.dirname(filename)
                        }
                    })
                }
            }
        ]
    })
    const model = (name, extra = {}) => ({
        name,
        provider: 'Alpha',
        providerId: 'alpha',
        platform: 'hub-a',
        type: 'llm',
        capabilities: ['text_input'],
        source: 'api',
        maxTokens: 4096,
        ...extra
    })
    const editableCandidates = ['key-one', 'key-two'].map(
        (credentialId, i) => ({
            sourceId: 'source-one',
            sourceProviderId: 'alpha',
            sourceName: 'Primary source',
            credentialId,
            credentialName: `Key ${i + 1}`,
            upstreamModel: 'same',
            capabilities: ['text_input'],
            capabilityOverrides: {},
            available: true
        })
    )
    const fixture = {
        chatluna_model_hub: {
            revision: 1,
            settings: {
                revision: 0,
                providers: [],
                additionalModels: [],
                blacklistModels: []
            },
            presets: [],
            providers: [
                {
                    id: 'alpha',
                    name: 'Alpha primary',
                    platform: 'hub-a',
                    modelsUpdatedAt: 42,
                    error: 'offline fixture'
                },
                { id: 'alpha', name: 'Alpha backup', platform: 'hub-a2' },
                { id: 'beta', name: 'Beta primary', platform: 'hub-b' }
            ],
            models: [
                model('same', { candidates: editableCandidates }),
                model('same-high-thinking', {
                    reasoningVariantOf: 'same',
                    candidates: editableCandidates,
                    capabilities: ['thinking', 'image_input'],
                    lastUsedAt: 1
                }),
                model('same', { platform: 'hub-a2' }),
                model('same', {
                    platform: 'hub-b',
                    provider: 'Beta',
                    providerId: 'beta',
                    capabilities: ['image_input'],
                    lastUsedAt: 2
                })
            ],
            totals: { models: 4 },
            frontendMode: 'performance'
        }
    }
    const css = `:root{--k-card-bg:#fff;--k-card-border:#d8dde5;--k-text-dark:#222;--k-text-light:#667;--k-color-primary:#5265d4;--k-page-bg:#f3f5fa;--k-hover-bg:#edf0f9}html[data-theme=dark]{--k-card-bg:#20242c;--k-card-border:#414550;--k-text-dark:#eee;--k-text-light:#adb3c0;--k-page-bg:#171a20}html[data-theme=black]{--k-card-bg:#080808;--k-card-border:#333;--k-text-dark:#eee;--k-text-light:#bbb;--k-page-bg:#000}body{margin:0;background:var(--k-page-bg);color:var(--k-text-dark);font:14px sans-serif}#app{height:100vh}button,input{font:inherit}*{box-sizing:border-box}`
    const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>${fs.readFileSync(elementCss, 'utf8')}\n${css}\n${styles.join('\n')}</style></head><body><div id="app"></div><script>window.fixture=${JSON.stringify(fixture)}</script><script src="/app.js"></script></body></html>`
    const server = http.createServer((req, res) => {
        res.setHeader(
            'Content-Type',
            req.url === '/app.js' ? 'application/javascript' : 'text/html'
        )
        res.end(req.url === '/app.js' ? result.outputFiles[0].text : html)
    })
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    let browser
    const artifacts = fs.mkdtempSync(path.join(os.tmpdir(), 'model-hub-ui-'))
    try {
        browser = await chromium.launch({
            ...(process.platform === 'win32' ? { channel: 'msedge' } : {}),
            headless: true
        })
        const page = await browser.newPage({
            viewport: { width: 1280, height: 900 }
        })
        const errors = []
        await page.emulateMedia({ reducedMotion: 'reduce' })
        page.on('pageerror', (error) => errors.push(String(error)))
        await page.goto(`http://127.0.0.1:${server.address().port}`)
        await page.getByRole('tab', { name: '模型', exact: true }).click()
        assert.equal(await page.locator('.model-provider-group').count(), 3)
        assert.equal(
            await page.locator('.model-variant-rows').isVisible(),
            false
        )
        await page.locator('.model-variant-count').click()
        await page.locator('.model-variant-rows').waitFor({ state: 'visible' })
        assert.equal(
            await page.locator('.model-variant-rows').isVisible(),
            true
        )
        await page
            .getByRole('button', { name: '收藏 hub-a/same', exact: true })
            .click()
        await page.getByRole('button', { name: '收藏', exact: true }).click()
        assert.equal(await page.locator('.model-provider-group').count(), 1)
        assert.match(
            await page.locator('.model-provider-group').textContent(),
            /hub-a/
        )
        assert.doesNotMatch(
            await page.locator('.model-provider-group').textContent(),
            /hub-a2|hub-b/
        )
        await page.reload()
        await page.getByRole('tab', { name: '模型', exact: true }).click()
        await page.getByRole('button', { name: '收藏', exact: true }).click()
        assert.equal(await page.locator('.model-provider-group').count(), 1)
        await page
            .getByRole('button', { name: '最近使用', exact: true })
            .click()
        assert.equal(await page.locator('.model-provider-group').count(), 2)
        await page
            .getByRole('button', { name: '清除筛选', exact: true })
            .click()
        await page.locator('.model-browser-filters .el-select').nth(0).click()
        await page.getByRole('option', { name: 'Beta', exact: true }).click()
        assert.equal(await page.locator('.model-provider-group').count(), 1)
        assert.match(
            await page.locator('.model-provider-group').textContent(),
            /Beta primary/
        )
        await page
            .getByRole('button', { name: '清除筛选', exact: true })
            .click()
        await page.locator('.model-browser-filters .el-select').nth(2).click()
        await page
            .getByRole('option', { name: '图片输入', exact: true })
            .click()
        await page.keyboard.press('Escape')
        assert.equal(await page.locator('.model-provider-group').count(), 2)
        assert.equal(await page.locator('.model-identity strong').count(), 2)
        await page
            .getByRole('button', { name: '清除筛选', exact: true })
            .click()
        await page.evaluate(() => {
            const snapshot = window.fixture.chatluna_model_hub
            window.qaStore.chatluna_model_hub.models = [
                ...snapshot.models,
                ...Array.from({ length: 60 }, (_, i) => ({
                    ...snapshot.models[0],
                    name: `large-${i}`
                }))
            ]
        })
        const largeGroup = page
            .locator('.model-provider-group')
            .filter({ hasText: 'Alpha primary' })
        assert.equal(await largeGroup.locator('.model-family').count(), 50)
        await largeGroup.getByRole('button', { name: '显示更多' }).click()
        assert.equal(await largeGroup.locator('.model-family').count(), 61)
        await page.reload()
        await page.getByRole('tab', { name: '模型', exact: true }).click()
        // Exercise tri-state capability editing with the real dialog component.
        const editCapabilities = page.getByRole('button', {
            name: '编辑 hub-a/same 能力',
            exact: true
        })
        const dialog = page.locator('.model-hub-capability-dialog:visible')
        const updates = () =>
            page.evaluate(() =>
                window.qaCalls.filter((c) =>
                    c.event.endsWith('/updateModelCapabilities')
                )
            )
        await editCapabilities.click()
        assert.equal(
            await dialog
                .getByLabel('图片输入能力', { exact: true })
                .inputValue(),
            'auto'
        )
        await dialog
            .getByLabel('图片输入能力', { exact: true })
            .selectOption('on')
        await dialog.getByRole('button', { name: '取消', exact: true }).click()
        assert.equal((await updates()).length, 0)
        await page.locator('.model-variant-count').click()
        await page
            .getByRole('button', {
                name: '编辑 hub-a/same-high-thinking 能力',
                exact: true
            })
            .click()
        assert.equal(
            await dialog.locator('.editor-identity strong').textContent(),
            'same'
        )
        await dialog.getByRole('button', { name: '取消', exact: true }).click()
        await editCapabilities.click()
        assert.equal(
            await dialog
                .getByLabel('图片输入能力', { exact: true })
                .inputValue(),
            'auto'
        )
        await dialog
            .getByLabel('图片输入能力', { exact: true })
            .selectOption('on')
        await dialog
            .getByLabel('工具调用能力', { exact: true })
            .selectOption('off')
        await dialog
            .getByLabel('编辑能力的连接', { exact: true })
            .selectOption('1')
        assert.equal(
            await dialog
                .getByLabel('图片输入能力', { exact: true })
                .inputValue(),
            'auto'
        )
        await dialog
            .getByLabel('图片输入能力', { exact: true })
            .selectOption('off')
        await page.evaluate(() => {
            window.qaCapabilityError = 'fixture conflict'
        })
        await dialog
            .getByRole('button', { name: '保存能力', exact: true })
            .click()
        await dialog
            .getByRole('alert')
            .filter({ hasText: 'fixture conflict' })
            .waitFor()
        assert.equal(
            await dialog
                .getByLabel('图片输入能力', { exact: true })
                .inputValue(),
            'off'
        )
        await page.evaluate(() => {
            window.qaCapabilityError = ''
            window.qaCapabilityDelay = 250
        })
        await dialog
            .getByRole('button', { name: '保存能力', exact: true })
            .click()
        assert.equal(
            await dialog
                .getByRole('button', { name: '取消', exact: true })
                .isDisabled(),
            true
        )
        await dialog.waitFor({ state: 'hidden' })
        const saved = (await updates()).at(-1).args[0]
        assert.equal(saved.revision, 0)
        assert.equal(saved.providerId, 'alpha')
        assert.equal(saved.platform, 'hub-a')
        assert.equal(saved.model, 'same')
        assert.deepEqual(saved.updates, [
            {
                sourceId: 'source-one',
                sourceProviderId: 'alpha',
                credentialId: 'key-one',
                upstreamModel: 'same',
                overrides: { image_input: true, tool_call: false }
            },
            {
                sourceId: 'source-one',
                sourceProviderId: 'alpha',
                credentialId: 'key-two',
                upstreamModel: 'same',
                overrides: { image_input: false }
            }
        ])
        await editCapabilities.click()
        assert.equal(
            await dialog
                .getByLabel('图片输入能力', { exact: true })
                .inputValue(),
            'on'
        )
        await dialog
            .getByRole('button', { name: '当前连接恢复自动', exact: true })
            .click()
        assert.equal(
            await dialog
                .getByLabel('图片输入能力', { exact: true })
                .inputValue(),
            'auto'
        )
        await dialog
            .getByRole('button', { name: '保存能力', exact: true })
            .click()
        await dialog.waitFor({ state: 'hidden' })
        assert.deepEqual(
            (await updates()).at(-1).args[0].updates[0].overrides,
            {}
        )
        await page.reload()
        await page.getByRole('tab', { name: '模型', exact: true }).click()
        for (const width of [1280, 768, 375]) {
            await page.setViewportSize({ width, height: 900 })
            for (const theme of ['light', 'dark', 'black']) {
                await page.evaluate((value) => {
                    document.documentElement.dataset.theme = value
                    document.documentElement.classList.toggle(
                        'dark',
                        value !== 'light'
                    )
                    document.documentElement.setAttribute(
                        'theme',
                        `default-${value}`
                    )
                }, theme)
                await page.locator('.model-heading h2').click()
                if (theme !== 'light') {
                    const surfaces = await page.evaluate(() =>
                        [
                            ...document.querySelectorAll(
                                '.model-provider-group, .model-search, .model-browser-filters .el-select__wrapper, .models-workspace .el-button, .model-browser-scopes button'
                            )
                        ].map((el) => ({
                            class: el.className,
                            color: getComputedStyle(el).backgroundColor
                        }))
                    )
                    for (const surface of surfaces) {
                        const channels = surface.color
                            .match(/[\d.]+/g)
                            .slice(0, 3)
                            .map(Number)
                        if (surface.color.startsWith('color(srgb'))
                            for (let i = 0; i < 3; i++) channels[i] *= 255
                        assert.ok(
                            Math.max(...channels) < 100,
                            `${width}/${theme} bright surface ${surface.class}: ${surface.color}`
                        )
                    }
                }
                if (theme !== 'light') {
                    await page
                        .locator('.model-browser-filters .el-select')
                        .nth(0)
                        .click()
                    const popover = page.locator(
                        '.el-popper.model-hub-model-popper:visible'
                    )
                    await popover.waitFor({ state: 'visible' })
                    const color = await popover.evaluate(
                        (el) => getComputedStyle(el).backgroundColor
                    )
                    const channels = color
                        .match(/[\d.]+/g)
                        .slice(0, 3)
                        .map(Number)
                    assert.ok(
                        Math.max(...channels) < 100,
                        `${theme} bright dropdown: ${color}`
                    )
                    await page.screenshot({
                        path: path.join(
                            artifacts,
                            `${width}-${theme}-dropdown.png`
                        ),
                        animations: 'disabled'
                    })
                    await page.locator('.model-heading h2').click()
                }
                await page.screenshot({
                    path: path.join(artifacts, `${width}-${theme}.png`),
                    fullPage: true,
                    animations: 'disabled'
                })
                const overflow = await page.evaluate(
                    () => document.documentElement.scrollWidth > innerWidth
                )
                assert.equal(
                    overflow,
                    false,
                    `${width}/${theme} horizontal overflow`
                )
                await editCapabilities.click()
                await dialog.waitFor({ state: 'visible' })
                const layout = await dialog.evaluate((el) => ({
                    width: el.scrollWidth,
                    clientWidth: el.clientWidth,
                    right: el.getBoundingClientRect().right,
                    footerBottom: el
                        .querySelector('.editor-actions')
                        .getBoundingClientRect().bottom,
                    surfaces: [
                        el,
                        ...el.querySelectorAll(
                            'select, .el-button:not(.el-button--primary)'
                        )
                    ].map((e) => getComputedStyle(e).backgroundColor)
                }))
                assert.ok(
                    layout.width <= layout.clientWidth + 1,
                    `dialog ${width}/${theme} internal overflow`
                )
                assert.ok(
                    layout.right <= width && layout.footerBottom <= 900,
                    `dialog ${width}/${theme} unreachable actions`
                )
                if (theme !== 'light')
                    for (const color of layout.surfaces) {
                        const channels = color
                            .match(/[\d.]+/g)
                            .slice(0, 3)
                            .map(Number)
                        if (color.startsWith('color(srgb'))
                            for (let i = 0; i < 3; i++) channels[i] *= 255
                        assert.ok(
                            Math.max(...channels) < 100,
                            `dialog ${width}/${theme} bright surface: ${color}`
                        )
                    }
                await page.screenshot({
                    path: path.join(
                        artifacts,
                        `capabilities-${width}-${theme}.png`
                    ),
                    animations: 'disabled'
                })
                await dialog
                    .getByRole('button', { name: '取消', exact: true })
                    .click()
            }
        }
        // Exercise the actual source/key forms, with only the console transport mocked.
        await page.evaluate(() => {
            const key = {
                id: 'key-one',
                name: 'Primary key',
                apiKey: '',
                hasApiKey: true,
                apiKeyPreview: 'saved…1234',
                enabled: true,
                generation: 1,
                secretAction: 'keep'
            }
            const provider = {
                id: 'stable-platform',
                provider: 'alpha',
                name: 'Alpha primary',
                platform: 'hub-a',
                apiKey: '',
                hasApiKey: true,
                apiKeyPreview: 'saved…1234',
                apiEndpoint: 'https://primary.example/v1',
                enabled: true,
                pullModels: true,
                customHeaders: [],
                chatConcurrentMaxSize: 3,
                chatTimeLimit: 200,
                configMode: 'default',
                maxRetries: 4,
                timeout: 300000,
                proxyMode: 'system',
                proxyAddress: '',
                maxContextRatio: 0.35,
                temperature: 1,
                presencePenalty: 0,
                frequencyPenalty: 0,
                nonStreaming: false,
                expandReasoningVariants: false,
                nonLlmInputTokenLimit: 8192,
                sources: [
                    {
                        id: 'source-one',
                        name: 'Primary',
                        provider: 'alpha',
                        apiEndpoint: 'https://primary.example/v1',
                        enabled: true,
                        pullModels: true,
                        priority: 0,
                        weight: 1,
                        settings: {},
                        credentials: [key]
                    }
                ],
                routes: []
            }
            const data = window.qaStore.chatluna_model_hub
            data.settings = {
                schemaVersion: 2,
                revision: 5,
                providers: [provider],
                additionalModels: [],
                blacklistModels: []
            }
            data.presets = [
                {
                    id: 'alpha',
                    name: 'Alpha',
                    adapter: 'openai-chat',
                    defaultEndpoint: 'https://primary.example/v1',
                    defaultPlatform: 'hub-a',
                    kind: 'cloud'
                }
            ]
            data.presets.push({
                id: 'gemini',
                name: 'Gemini',
                adapter: 'gemini',
                defaultEndpoint:
                    'https://generativelanguage.googleapis.com/v1beta',
                defaultPlatform: 'gemini',
                kind: 'cloud'
            })
            data.providers[0].error =
                '模型目录暂时不可用，当前显示上次成功的结果。请检查连接源配置后重试。'
            data.providers[0].connections = [
                {
                    sourceId: 'source-one',
                    credentialId: 'key-one',
                    state: 'ready',
                    modelCount: 2
                }
            ]
            data.revision++
            window.qaCalls = []
        })
        await page.getByRole('tab', { name: '服务商', exact: true }).click()
        await page.setViewportSize({ width: 1280, height: 1000 })
        await page
            .getByRole('heading', { name: '连接源与密钥', exact: true })
            .waitFor()
        assert.equal(await page.locator('.source-card').count(), 1)
        assert.equal(
            (await page.evaluate(() => window.qaCalls)).length,
            0,
            'Opening provider does not call vendor APIs'
        )
        await page
            .locator('.source-card')
            .getByRole('button', { name: '添加 Key', exact: true })
            .click()
        const keys = page.locator('.source-card .key-card')
        assert.equal(await keys.count(), 2)
        await keys.nth(1).locator('input[type=password]').fill('ui-test-secret')
        assert.ok(
            !(await page.evaluate(() => JSON.stringify(localStorage))).includes(
                'ui-test-secret'
            )
        )
        await page.getByRole('button', { name: '保存', exact: true }).click()
        await page.getByText('已保存并重新加载', { exact: true }).waitFor()
        const saves = await page.evaluate(() =>
            window.qaCalls.filter((c) => c.event.endsWith('/saveSettings'))
        )
        assert.equal(saves.length, 1)
        assert.equal(saves[0].args[0].revision, 5)
        assert.equal(
            saves[0].args[0].providers[0].sources[0].credentials[1].apiKey,
            'ui-test-secret'
        )
        assert.equal(
            await page.locator('.key-card input[type=password]').count(),
            2
        )
        assert.ok(
            (
                await page
                    .locator('.key-card input[type=password]')
                    .evaluateAll((inputs) => inputs.map((input) => input.value))
            ).every((v) => v === '')
        )
        await page
            .getByRole('button', { name: '添加连接源', exact: true })
            .click()
        assert.equal(await page.locator('.source-card').count(), 2)
        await page.locator('.source-card > summary').nth(1).click()
        await page.locator('.routes-editor > summary').click()
        await page
            .getByRole('button', { name: '添加路由', exact: true })
            .click()
        assert.equal(await page.locator('.route-card').count(), 1)
        await page
            .locator('.source-card')
            .nth(1)
            .locator('.overrides > summary')
            .click()
        const secondSource = page.locator('.source-card').nth(1)
        await secondSource
            .locator('label')
            .filter({ hasText: '接口模板' })
            .locator('.el-select')
            .click()
        await page
            .getByRole('option', { name: 'Gemini · gemini', exact: true })
            .click()
        await page
            .locator('.section')
            .filter({
                has: page.getByRole('heading', {
                    name: '自定义请求头',
                    exact: true
                })
            })
            .getByRole('button', { name: '添加', exact: true })
            .click()
        const jsonInput = secondSource
            .locator('label')
            .filter({ hasText: '响应 JSON Schema' })
            .locator('textarea')
        await jsonInput.fill('{broken')
        assert.equal(
            await jsonInput.inputValue(),
            '{broken',
            'Invalid JSON remains editable'
        )
        assert.equal(
            await page
                .getByRole('button', { name: '保存', exact: true })
                .isDisabled(),
            true
        )
        await jsonInput.fill('{"type":"object"}')
        assert.equal(
            await page
                .getByRole('button', { name: '保存', exact: true })
                .isDisabled(),
            false
        )
        await page.getByRole('tab', { name: '模型', exact: true }).click()
        await editCapabilities.click()
        await dialog
            .getByRole('alert')
            .filter({ hasText: '未保存的修改' })
            .waitFor()
        assert.equal(
            await dialog
                .getByLabel('图片输入能力', { exact: true })
                .isDisabled(),
            true
        )
        assert.equal(
            await dialog
                .getByRole('button', { name: '保存能力', exact: true })
                .isDisabled(),
            true
        )
        await dialog.getByRole('button', { name: '取消', exact: true }).click()
        await page.getByRole('tab', { name: '服务商', exact: true }).click()
        for (const width of [1280, 768, 375]) {
            await page.setViewportSize({ width, height: 1000 })
            for (const theme of ['light', 'dark', 'black']) {
                await page.evaluate((value) => {
                    document.documentElement.dataset.theme = value
                    document.documentElement.classList.toggle(
                        'dark',
                        value !== 'light'
                    )
                    document.documentElement.setAttribute(
                        'theme',
                        `default-${value}`
                    )
                }, theme)
                await page.evaluate(() => {
                    const main = document.querySelector('.model-hub-main')
                    const panel = document.querySelector('.detail-panel')
                    panel.querySelector('.detail-scroll').scrollTop = 0
                    if (innerWidth < 1180)
                        main.scrollTop +=
                            panel.getBoundingClientRect().top -
                            main.getBoundingClientRect().top
                })
                assert.equal(
                    await page.evaluate(
                        () => document.documentElement.scrollWidth > innerWidth
                    ),
                    false,
                    `connections ${width}/${theme} overflow`
                )
                await page.screenshot({
                    path: path.join(
                        artifacts,
                        `connections-${width}-${theme}.png`
                    ),
                    fullPage: true,
                    animations: 'disabled'
                })
                const layout = await page.evaluate(() => {
                    const panel = document.querySelector('.detail-panel')
                    const scroll = panel.querySelector('.detail-scroll')
                    const error = scroll.querySelector('.error-box')
                    const style = getComputedStyle(error)
                    return {
                        overflowingControls: [
                            ...panel.querySelectorAll(
                                '.el-input, .el-select, .el-textarea, .el-input-number, .header-row'
                            )
                        ]
                            .filter((el) => {
                                const rect = el.getBoundingClientRect()
                                const bounds = panel.getBoundingClientRect()
                                return (
                                    rect.width > 0 &&
                                    rect.height > 0 &&
                                    (rect.left < bounds.left ||
                                        rect.right > bounds.right)
                                )
                            })
                            .map((el) => el.className),
                        switchColumns: getComputedStyle(
                            panel.querySelector('.switch-grid')
                        ).gridTemplateColumns.split(' ').length,
                        headerColumns: getComputedStyle(
                            panel.querySelector('.header-row')
                        ).gridTemplateColumns.split(' ').length,
                        panelBottom: panel.getBoundingClientRect().bottom,
                        contentBottom: Math.max(
                            ...[...scroll.children].map(
                                (el) => el.getBoundingClientRect().bottom
                            )
                        ),
                        errorHeight: error.getBoundingClientRect().height,
                        errorMinimum:
                            parseFloat(style.fontSize) +
                            parseFloat(style.paddingTop) +
                            parseFloat(style.paddingBottom),
                        errorClientHeight: error.clientHeight,
                        errorScrollHeight: error.scrollHeight
                    }
                })
                assert.ok(
                    layout.errorHeight >= layout.errorMinimum &&
                        layout.errorScrollHeight <=
                            layout.errorClientHeight + 1,
                    `connections ${width}/${theme} clipped error: ${JSON.stringify(layout)}`
                )
                assert.deepEqual(
                    layout.overflowingControls,
                    [],
                    `connections ${width}/${theme} clipped controls`
                )
                if (width <= 900) {
                    assert.equal(
                        layout.switchColumns,
                        1,
                        'Narrow switches use a full-width row'
                    )
                    assert.equal(
                        layout.headerColumns,
                        1,
                        'Narrow header inputs use full-width rows'
                    )
                }
                if (width < 1180) {
                    assert.ok(
                        layout.contentBottom <= layout.panelBottom + 1,
                        `connections ${width}/${theme} content outside detail card: ${JSON.stringify(layout)}`
                    )
                }
                const lastControl = page
                    .locator('.detail-scroll button:visible')
                    .last()
                await lastControl.scrollIntoViewIfNeeded()
                await lastControl.click({ trial: true })
            }
        }
        assert.deepEqual(errors, [])
        console.log(
            JSON.stringify({
                result: 'PASS',
                groups: 3,
                tested: [
                    'provider isolation',
                    'variant toggle',
                    'favorite persistence',
                    'recent scope',
                    'capability filter',
                    'tri-state capability editing, cancel and restore auto',
                    'per-key capability payload and error-preserved drafts',
                    'variant capability editing resolves to base and unsaved settings block writes',
                    'themed capability dialogs and reachable mobile actions',
                    'large-list incremental rendering',
                    'dark surfaces and dropdown brightness',
                    'light/dark/black',
                    'desktop/mobile overflow',
                    'multi-source/key form, secret write and revision readback',
                    'explicit model routes and source overrides',
                    'JSON validation prevents invalid saves',
                    'unclipped errors, contained mobile cards and reachable final controls'
                ],
                artifacts
            })
        )
    } finally {
        await browser?.close()
        await new Promise((resolve) => server.close(resolve))
    }
}
main().catch((error) => {
    console.error(error)
    process.exitCode = 1
})
