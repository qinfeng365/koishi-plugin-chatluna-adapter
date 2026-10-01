import { createHash } from 'crypto'
import { checkResponse } from 'koishi-plugin-chatluna/utils/sse'
import type { ModelHubRequester } from '../requester'

export interface GeminiResourceRequest {
    resource: 'files' | 'cachedContents' | 'interactions'
    action: 'list' | 'get' | 'create' | 'update' | 'delete' | 'cancel'
    name?: string
    body?: Record<string, unknown>
    pageToken?: string
}

/** Explicit resource operations; uploading is separately opt-in. All HTTP uses plugin.fetch. */
export class GeminiResources {
    private uploads = new Map<
        string,
        { file: Record<string, any>; expires: number }
    >()
    private lifetime = new AbortController()
    constructor(private requester: ModelHubRequester) {
        requester.koishiContext().on?.('dispose', () => this.dispose())
    }

    async request(request: GeminiResourceRequest, signal?: AbortSignal) {
        if (this.lifetime.signal.aborted) throw this.lifetime.signal.reason
        signal ??= AbortSignal.timeout(
            this.requester.currentConfig().timeout ?? 60_000
        )
        if (this.requester.currentProviderPreset().adapter !== 'gemini')
            throw new Error('Gemini resources require a Gemini provider')
        const { resource, action, name, body } = request
        if (!['files', 'cachedContents', 'interactions'].includes(resource))
            throw new Error('Unknown Gemini resource')
        const methods = {
            list: 'GET',
            get: 'GET',
            create: 'POST',
            update: 'PATCH',
            delete: 'DELETE',
            cancel: 'POST'
        }
        const allowed =
            resource === 'cachedContents'
                ? ['list', 'get', 'create', 'update', 'delete']
                : resource === 'files'
                  ? ['list', 'get', 'delete']
                  : ['get', 'create', 'delete', 'cancel']
        if (!allowed.includes(action))
            throw new Error(`Unsupported ${resource} action: ${action}`)
        if (
            !['list', 'create'].includes(action) &&
            !new RegExp(`^${resource}/[A-Za-z0-9_-]+$`).test(name ?? '')
        ) {
            throw new Error('Invalid Gemini resource name')
        }
        let path = ['list', 'create'].includes(action) ? resource : name!
        if (action === 'cancel') path += ':cancel'
        if (request.pageToken)
            path += `?pageToken=${encodeURIComponent(request.pageToken)}`
        const response = await this.fetch(this.requester.concatUrl(path), {
            method: methods[action],
            signal,
            headers: this.requester.buildHeaders(),
            ...(body ? { body: JSON.stringify(body) } : {})
        })
        await checkResponse(response)
        if (resource === 'files' && action === 'delete') {
            for (const [key, value] of this.uploads)
                if (value.file.name === name) this.uploads.delete(key)
        }
        const text = await response.text()
        return text ? JSON.parse(text) : {}
    }

    async upload(buffer: Buffer, mimeType: string, signal?: AbortSignal) {
        if (this.lifetime.signal.aborted) throw this.lifetime.signal.reason
        if (signal?.aborted) throw signal.reason
        signal ??= AbortSignal.timeout(
            this.requester.currentConfig().timeout ?? 60_000
        )
        const config = this.requester.currentConfig()
        if (!config.geminiFileUpload)
            throw new Error('Gemini file upload is disabled')
        const limit =
            Math.min(config.geminiMaxFileSizeMb ?? 64, 2048) * 1024 * 1024
        if (buffer.length > limit)
            throw new Error(
                `Gemini file exceeds configured upload limit (${limit} bytes)`
            )
        const key = createHash('sha256')
            .update(config.apiEndpoint)
            .update(config.apiKey)
            .update(mimeType)
            .update(buffer)
            .digest('hex')
        const saved = this.uploads.get(key)
        if (saved && saved.expires > Date.now() + 60_000) return saved.file
        const url = new URL(this.requester.concatUrl('files'))
        url.pathname = url.pathname.replace(
            /\/(v1(?:beta)?)\/files$/,
            '/upload/$1/files'
        )
        const start = await this.fetch(url.toString(), {
            method: 'POST',
            signal,
            redirect: 'error',
            headers: {
                ...this.requester.buildHeaders(),
                'X-Goog-Upload-Protocol': 'resumable',
                'X-Goog-Upload-Command': 'start',
                'X-Goog-Upload-Header-Content-Length': String(buffer.length),
                'X-Goog-Upload-Header-Content-Type': mimeType
            },
            body: JSON.stringify({
                file: { display_name: `chatluna-${key.slice(0, 12)}` }
            })
        })
        await checkResponse(start)
        const location = start.headers.get('x-goog-upload-url')
        if (!location) throw new Error('Gemini did not return an upload URL')
        const uploadUrl = new URL(location, url)
        if (uploadUrl.origin !== url.origin)
            throw new Error('Gemini upload URL changed origin')
        const response = await this.fetch(uploadUrl.toString(), {
            method: 'POST',
            signal,
            redirect: 'error',
            headers: {
                ...this.requester.buildHeaders(),
                'Content-Type': mimeType,
                'X-Goog-Upload-Offset': '0',
                'X-Goog-Upload-Command': 'upload, finalize'
            },
            body: buffer
        })
        await checkResponse(response)
        let file = JSON.parse(await response.text()).file
        for (
            let attempt = 0;
            file?.state === 'PROCESSING' && attempt < 60;
            attempt++
        ) {
            await abortableDelay(1000, signal)
            file = await this.request(
                { resource: 'files', action: 'get', name: file.name },
                signal
            )
        }
        if (
            !file?.uri ||
            file.state === 'FAILED' ||
            file.state === 'PROCESSING'
        )
            throw new Error('Gemini file is not ready')
        const expires =
            Date.parse(file.expirationTime ?? '') || Date.now() + 48 * 3600_000
        if (this.uploads.size >= 64)
            this.uploads.delete(this.uploads.keys().next().value!)
        this.uploads.set(key, { file, expires })
        return file
    }

    private async fetch(url: string, init: Record<string, any>) {
        const controller = new AbortController()
        const cancelCaller = () => controller.abort(init.signal?.reason)
        const cancelLifetime = () =>
            controller.abort(this.lifetime.signal.reason)
        if (init.signal?.aborted) cancelCaller()
        if (this.lifetime.signal.aborted) cancelLifetime()
        init.signal?.addEventListener('abort', cancelCaller, { once: true })
        this.lifetime.signal.addEventListener('abort', cancelLifetime, {
            once: true
        })
        try {
            // Consume the response while cancellation is still attached.
            const response = await this.requester.vendorFetch(url, {
                ...init,
                signal: controller.signal
            })
            const buffer = await response.arrayBuffer()
            return new Response(
                [204, 205, 304].includes(response.status) ? null : buffer,
                { status: response.status, headers: response.headers as any }
            ) as unknown as Awaited<ReturnType<ModelHubRequester['vendorFetch']>>
        } finally {
            init.signal?.removeEventListener('abort', cancelCaller)
            this.lifetime.signal.removeEventListener('abort', cancelLifetime)
        }
    }

    dispose() {
        this.lifetime.abort(new Error('Gemini resource client disposed'))
        this.uploads.clear()
    }
}

function abortableDelay(ms: number, signal?: AbortSignal) {
    return new Promise<void>((resolve, reject) => {
        if (signal?.aborted) {
            reject(signal.reason)
            return
        }
        const abort = () => {
            clearTimeout(timer)
            reject(signal?.reason)
        }
        const timer = setTimeout(() => {
            signal?.removeEventListener('abort', abort)
            resolve()
        }, ms)
        signal?.addEventListener('abort', abort, { once: true })
    })
}
