import type { ModelHubRequester } from '../requester';
export interface GeminiResourceRequest {
    resource: 'files' | 'cachedContents' | 'interactions';
    action: 'list' | 'get' | 'create' | 'update' | 'delete' | 'cancel';
    name?: string;
    body?: Record<string, unknown>;
    pageToken?: string;
}
/** Explicit resource operations; uploading is separately opt-in. All HTTP uses plugin.fetch. */
export declare class GeminiResources {
    private requester;
    private uploads;
    private lifetime;
    constructor(requester: ModelHubRequester);
    request(request: GeminiResourceRequest, signal?: AbortSignal): Promise<any>;
    upload(buffer: Buffer, mimeType: string, signal?: AbortSignal): Promise<any>;
    private fetch;
    dispose(): void;
}
