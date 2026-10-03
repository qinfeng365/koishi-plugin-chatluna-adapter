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
                                    : `import {reactive,ref,watch} from 'vue'; export const store=reactive(window.fixture);window.qaStore=store; export async function send(){return {success:true}}; export function useStorage(key,version,fallback){const k='koishi.console.'+key;const state=ref(JSON.parse(localStorage.getItem(k)||'null')||fallback());watch(state,v=>localStorage.setItem(k,JSON.stringify(v)),{deep:true});return state;}`,
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
    const fixture = {
        chatluna_model_hub: {
            revision: 1,
            settings: {
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
                model('same'),
                model('same-high-thinking', {
                    reasoningVariantOf: 'same',
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
        for (const width of [1280, 375]) {
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
                    'large-list incremental rendering',
                    'dark surfaces and dropdown brightness',
                    'light/dark/black',
                    'desktop/mobile overflow'
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
