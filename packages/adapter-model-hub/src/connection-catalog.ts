import { mkdir, readFile, rename, unlink, writeFile } from 'fs/promises'
import { dirname } from 'path'
import { randomUUID } from 'crypto'
import type { ModelInfo } from 'koishi-plugin-chatluna/llm-core/platform/types'

interface Directory {
    models: ModelInfo[]
    updatedAt: number
}
/** Non-secret, permission-scoped last-good directories, separate from administrator settings. */
export class ConnectionCatalogStore {
    private directories = new Map<string, Directory>()
    private origins = new Map<string, string>()
    private resourceOwners = new Map<string, string>()
    private writes: Promise<void> = Promise.resolve()
    constructor(
        private path?: string,
        private onRecovery?: () => void
    ) {}
    async load() {
        if (!this.path) return
        try {
            const raw = await readFile(this.path, 'utf8')
            if (raw.length > 16 * 1024 * 1024)
                throw new Error('连接模型缓存过大')
            const data = JSON.parse(raw)
            if (
                data.version !== 1 ||
                !Array.isArray(data.directories) ||
                !Array.isArray(data.origins)
            )
                throw new Error('连接模型缓存格式无效')
            const directories = new Map<string, Directory>()
            for (const [key, entry] of data.directories) {
                if (
                    typeof key !== 'string' ||
                    !entry ||
                    !Array.isArray(entry.models) ||
                    !Number.isFinite(entry.updatedAt)
                )
                    throw new Error('连接模型缓存条目无效')
                if (
                    !entry.models.every(
                        (m: ModelInfo) =>
                            typeof m.name === 'string' &&
                            [1, 2, 3].includes(m.type) &&
                            Array.isArray(m.capabilities) &&
                            Number.isFinite(m.maxTokens)
                    )
                )
                    throw new Error('连接模型缓存能力无效')
                directories.set(key, entry)
            }
            this.directories = directories
            this.origins = new Map(
                data.origins.filter(
                    ([key, value]) =>
                        typeof key === 'string' && typeof value === 'string'
                )
            )
            this.resourceOwners = new Map(
                (data.resourceOwners ?? [])
                    .filter(
                        ([key, value]) =>
                            typeof key === 'string' && typeof value === 'string'
                    )
                    .slice(-10000)
            )
            this.onRecovery?.()
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
        }
    }
    get(key: string) {
        const value = this.directories.get(key)
        return value ? structuredClone(value) : undefined
    }
    set(key: string, models: ModelInfo[], updatedAt: number) {
        // Explicit allowlist: no requester/config objects (and consequently no credentials).
        this.directories.set(key, {
            updatedAt,
            models: models.map((model) => ({
                name: model.name,
                type: model.type,
                maxTokens: model.maxTokens,
                capabilities: [...model.capabilities],
                ...((model as ModelInfo & { reasoningVariantOf?: string })
                    .reasoningVariantOf
                    ? {
                          reasoningVariantOf: (
                              model as ModelInfo & {
                                  reasoningVariantOf?: string
                              }
                          ).reasoningVariantOf
                      }
                    : {})
            }))
        })
        if (this.directories.size > 2000)
            this.directories.delete(this.directories.keys().next().value)
    }
    origin(platform: string, model: string) {
        return this.origins.get(JSON.stringify([platform, model]))
    }
    rememberOrigin(platform: string, model: string, sourceId: string) {
        const key = JSON.stringify([platform, model])
        if (!this.origins.has(key)) this.origins.set(key, sourceId)
    }
    resourceOwner(key: string) {
        return this.resourceOwners.get(key)
    }
    rememberResource(key: string, owner: string) {
        this.resourceOwners.set(key, owner)
        if (this.resourceOwners.size > 10000)
            this.resourceOwners.delete(this.resourceOwners.keys().next().value)
    }
    flush() {
        if (!this.path) return Promise.resolve()
        const write = async () => {
            const text = JSON.stringify({
                version: 1,
                directories: [...this.directories],
                origins: [...this.origins],
                resourceOwners: [...this.resourceOwners]
            })
            await mkdir(dirname(this.path), { recursive: true })
            const temp = `${this.path}.${randomUUID()}.tmp`
            try {
                await writeFile(temp, text, { mode: 0o600, flag: 'wx' })
                await rename(temp, this.path)
                this.onRecovery?.()
            } finally {
                await unlink(temp).catch(() => {})
            }
        }
        const task = this.writes.then(write)
        this.writes = task.catch(() => {})
        return task
    }
}
