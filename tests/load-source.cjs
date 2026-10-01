const { buildSync } = require('esbuild')
const { readFileSync } = require('node:fs')
const { dirname, resolve } = require('node:path')
const Module = require('node:module')

const cache = new Map()
const logger = { warn() {}, error() {}, info() {}, debug() {} }

function compile(filename, code) {
    const mod = new Module(filename, module)
    mod.filename = filename
    mod.paths = Module._nodeModulePaths(dirname(filename))
    const originalRequire = mod.require.bind(mod)
    mod.require = (name) => {
        if (name.endsWith('.yml')) return {}
        if (name === 'koishi-plugin-chatluna')
            return { ...originalRequire(name), logger }
        if (name === '@chatluna/v1-shared-adapter') {
            const shared = require.resolve(name)
            if (!cache.has(shared))
                cache.set(shared, compile(shared, readFileSync(shared, 'utf8')))
            return cache.get(shared)
        }
        return originalRequire(name)
    }
    mod._compile(code, filename)
    return mod.exports
}

module.exports = function loadSource(relativePath) {
    const filename = resolve(
        __dirname,
        '../packages/adapter-model-hub/src',
        relativePath
    )
    if (!cache.has(filename)) {
        const result = buildSync({
            entryPoints: [filename],
            bundle: true,
            platform: 'node',
            format: 'cjs',
            packages: 'external',
            external: ['*.yml'],
            write: false
        })
        cache.set(filename, compile(filename, result.outputFiles[0].text))
    }
    return cache.get(filename)
}
