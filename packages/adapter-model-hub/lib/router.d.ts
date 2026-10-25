import type { Context } from 'koishi';
import type { RunnableConfig } from '@langchain/core/runnables';
import type { ChatGenerationChunk } from '@langchain/core/outputs';
import type { ModelRequestParams, EmbeddingsRequestParams, RerankerRequestParams } from 'koishi-plugin-chatluna/llm-core/platform/api';
import { ModelCapabilities as Cap, type ModelInfo } from 'koishi-plugin-chatluna/llm-core/platform/types';
import { ModelHubRequester } from './requester';
import type { GeminiResourceRequest } from './adapters/gemini-resources';
import type { ModelMetadataStore } from './metadata';
import { ConnectionCatalogStore } from './connection-catalog';
import type { ConnectionStatus, ModelHubClientConfig, ModelHubPlugin, ModelHubResolvedConfig, RuntimeProvider } from './types';
interface Connection {
    key: string;
    signature: string;
    config: ModelHubClientConfig;
    requester: ModelHubRequester;
    models: ModelInfo[];
    discovered: boolean;
    updatedAt?: number;
    error?: string;
    retryAt: number;
    authFailed: boolean;
    denied: Set<string>;
}
interface Candidate {
    connection: Connection;
    upstreamModel: string;
    embeddingSpace?: string;
    capabilities?: Cap[];
    reasoningVariantOf?: string;
}
interface Route {
    info: ModelInfo;
    candidates: Candidate[];
    allowFallback: boolean;
}
interface State {
    id: number;
    platform: string;
    providerId: string;
    config: ModelHubResolvedConfig;
    connections: Connection[];
    routes: Map<string, Route>;
}
/** Only transport facts drive failover. Provider error text may contain secrets. */
export declare class UpstreamFailure extends Error {
    readonly status: number;
    readonly retryAt: number;
    readonly kind: 'auth' | 'permission' | 'rate' | 'source' | 'request';
    constructor(status: number, retryAt?: number, kind?: 'auth' | 'permission' | 'rate' | 'source' | 'request', param?: string);
}
export declare function retryAfter(value: string | null, now?: number): number;
/** One public requester; each connection has its own immutable pool and transport. */
export declare class ModelHubRouter extends ModelHubRequester {
    private plugin;
    private metadata;
    private catalog;
    private state;
    private roundRobin;
    private counters;
    private sticky;
    private uses;
    private queued;
    private active;
    private retired;
    private refreshTasks;
    private refreshTail;
    private sequence;
    private resourceRequests;
    private closed;
    private attempt;
    constructor(ctx: Context, config: ModelHubResolvedConfig, plugin: ModelHubPlugin, runtime: RuntimeProvider, metadata: ModelMetadataStore, catalog?: ConnectionCatalogStore);
    /** Build first; activation is one synchronous pointer replacement. */
    prepare(config: ModelHubResolvedConfig, runtime: RuntimeProvider): State;
    activate(next: State): void;
    private collect;
    lastUsedAt(model: string): number;
    status(): ConnectionStatus[];
    modelCandidates(model: string): {
        sourceId: string;
        sourceProviderId: string;
        credentialId: string;
        upstreamModel: string;
        sourceName: string;
        credentialName: string;
        capabilities: Cap[];
        capabilityOverrides: Partial<Record<Cap, boolean>>;
        available: boolean;
    }[];
    getModels(config?: RunnableConfig): Promise<ModelInfo[]>;
    refreshCatalog(config?: RunnableConfig, sourceId?: string): Promise<ModelInfo[]>;
    private buildRoutes;
    private addRoute;
    private effectiveModel;
    private capabilityOverrides;
    private limits;
    private available;
    private reserve;
    private pick;
    private fail;
    private owner;
    private scoped;
    private execute;
    completion(params: ModelRequestParams): Promise<any>;
    completionStream(params: ModelRequestParams): AsyncGenerator<ChatGenerationChunk>;
    embeddings(params: EmbeddingsRequestParams): Promise<any>;
    rerank(params: RerankerRequestParams): Promise<any>;
    fileHandling(model: string): {
        supportedMimeTypes: Set<string>;
        maxFileSizeBytesOverrides: {
            [k: string]: number;
        };
        maxTotalSizeBytes: number;
        maxFileSizeBytes: number;
    };
    platformFileHandling(): {
        supportedMimeTypes: Set<string>;
        maxTotalSizeBytes: number;
        maxFileSizeBytes: number;
    };
    resource(request: GeminiResourceRequest & {
        sourceId?: string;
        credentialId?: string;
    }): Promise<any>;
    dispose(model?: string, id?: string): Promise<void>;
}
export {};
