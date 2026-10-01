import { ChatGenerationChunk } from '@langchain/core/outputs';
import type { ModelRequestParams } from 'koishi-plugin-chatluna/llm-core/platform/api';
import type { ModelHubRequester } from '../requester';
import { createGeminiToolNameMapper } from './gemini';
type Json = Record<string, any>;
export declare function parseGeminiInteraction(data: Json, mapper: ReturnType<typeof createGeminiToolNameMapper>, metadataOnly?: boolean): ChatGenerationChunk;
export declare function geminiInteractionCompletion(requester: ModelHubRequester, params: ModelRequestParams): Promise<ChatGenerationChunk>;
export declare function geminiInteractionStream(requester: ModelHubRequester, params: ModelRequestParams): AsyncGenerator<ChatGenerationChunk, void, unknown>;
export {};
