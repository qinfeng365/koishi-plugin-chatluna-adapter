import { StructuredTool } from '@langchain/core/tools';
import { ChatGenerationChunk } from '@langchain/core/outputs';
import type { ProviderAdapter } from './types';
import type { ModelHubRequester } from '../requester';
type GeminiToolNameMapper = {
    sanitize(name: string | undefined): string;
    restore(name: string | undefined): string;
};
export declare const geminiAdapter: ProviderAdapter;
export declare function createGeminiRequest(requester: ModelHubRequester, params: any, toolNameMapper: GeminiToolNameMapper): Promise<any>;
export declare function mergeGeminiRequest(base: Record<string, any>, override: Record<string, any>): any;
export declare function createGeminiToolNameMapper(tools: StructuredTool[]): GeminiToolNameMapper;
export type GeminiStreamState = {
    nextToolIndex: number;
    partIndex: number;
    currentToolIndex?: number;
    currentToolId?: string;
};
export declare function parseGeminiResponse(text: string, requester: ModelHubRequester, toolNameMapper: GeminiToolNameMapper, streamState?: GeminiStreamState): Promise<ChatGenerationChunk>;
export {};
