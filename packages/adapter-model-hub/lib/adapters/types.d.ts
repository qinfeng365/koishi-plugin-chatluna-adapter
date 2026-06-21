import type { ChatGeneration, ChatGenerationChunk } from '@langchain/core/outputs';
import type { RunnableConfig } from '@langchain/core/runnables';
import type { EmbeddingsRequestParams, EmbeddingsResult, ModelRequestParams, RerankerRequestParams, RerankerResult, RerankerUsageResult } from 'koishi-plugin-chatluna/llm-core/platform/api';
import type { ProviderAdapterId } from '../types';
import type { ModelHubRequester } from '../requester';
import type { ProviderModelEntry } from '../types';
export interface ProviderAdapter {
    id: ProviderAdapterId;
    completion(requester: ModelHubRequester, params: ModelRequestParams): Promise<ChatGeneration>;
    completionStream(requester: ModelHubRequester, params: ModelRequestParams): AsyncGenerator<ChatGenerationChunk>;
    completionStreamInternal(requester: ModelHubRequester, params: ModelRequestParams): AsyncGenerator<ChatGenerationChunk>;
    embeddings(requester: ModelHubRequester, params: EmbeddingsRequestParams): Promise<EmbeddingsResult>;
    rerank(requester: ModelHubRequester, params: RerankerRequestParams): Promise<RerankerResult[] | RerankerUsageResult>;
    getModels(requester: ModelHubRequester, config?: RunnableConfig): Promise<ProviderModelEntry[]>;
    dispose?(requester: ModelHubRequester, model?: string, id?: string): Promise<void>;
}
