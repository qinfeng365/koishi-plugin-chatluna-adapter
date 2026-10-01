import { ChatGenerationChunk, type ChatGeneration } from '@langchain/core/outputs';
import { type ModelRequestParams } from 'koishi-plugin-chatluna/llm-core/platform/api';
import type { ModelHubRequester } from '../requester';
export declare function usesResponses(requester: ModelHubRequester, params: ModelRequestParams): boolean;
/** Per invocation: never put response history or SSE state on a pooled requester. */
export declare function createOpenAIBridge(requester: ModelHubRequester, params: ModelRequestParams): {
    context: any;
    enrich: <T extends ChatGeneration>(generation: T) => T;
    finish<T extends ChatGeneration>(generation: T): T;
    historyChunk(): ChatGenerationChunk;
};
