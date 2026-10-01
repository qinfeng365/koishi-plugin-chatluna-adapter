// Check the actual script-setup body; ordinary tsc does not inspect .vue scripts.
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const { parse, compileScript } = require('vue/compiler-sfc')

const root = path.resolve(__dirname, '..')
const component = path.join(
    root,
    'packages/adapter-model-hub/client/dashboard.vue'
)
const virtual = path.join(path.dirname(component), 'dashboard.qa.ts')
const script = compileScript(
    parse(fs.readFileSync(component, 'utf8'), { filename: component })
        .descriptor,
    { id: 'model-hub-qa' }
).content
const configFile = path.join(path.dirname(component), 'tsconfig.json')
const config = ts.readConfigFile(configFile, ts.sys.readFile)
const parsed = ts.parseJsonConfigFileContent(
    config.config,
    ts.sys,
    path.dirname(configFile),
    undefined,
    configFile
)
const options = { ...parsed.options, noEmit: true, skipLibCheck: true }
const host = ts.createCompilerHost(options)
const read = host.readFile.bind(host)
const exists = host.fileExists.bind(host)
host.readFile = (file) => (path.resolve(file) === virtual ? script : read(file))
host.fileExists = (file) => path.resolve(file) === virtual || exists(file)
// The console's legacy globals need Node resolution, but Vite resolves API
// package exports as a bundler. Use that fallback only for unresolved imports.
host.resolveModuleNames = (names, containing) =>
    names.map(
        (name) =>
            ts.resolveModuleName(name, containing, options, host)
                .resolvedModule ??
            ts.resolveModuleName(
                name,
                containing,
                {
                    ...options,
                    moduleResolution: ts.ModuleResolutionKind.Bundler
                },
                host
            ).resolvedModule
    )
const program = ts.createProgram({
    rootNames: [...parsed.fileNames, virtual],
    options,
    host
})
const diagnostics = ts.getPreEmitDiagnostics(program)
const local = diagnostics.filter(
    (item) => !item.file || !item.file.fileName.includes('node_modules')
)
const formatHost = {
    getCanonicalFileName: (f) => f,
    getCurrentDirectory: () => root,
    getNewLine: () => '\n'
}
if (local.length) process.stderr.write(ts.formatDiagnostics(local, formatHost))
const dependencies = diagnostics.filter((item) => !local.includes(item))
if (dependencies.length)
    process.stdout.write(ts.formatDiagnostics(dependencies, formatHost))
process.stdout.write(
    JSON.stringify({
        repositoryDiagnostics: local.length,
        installedDependencyDiagnostics: dependencies.length
    }) + '\n'
)
process.exitCode = local.length ? 1 : 0
