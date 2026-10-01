import { StructuredTool } from '@langchain/core/tools';
import { ChatGenerationChunk } from '@langchain/core/outputs';
import type { ProviderAdapter } from './types';
import type { ModelHubRequester } from '../requester';
type GeminiPart = Record<string, any>;
type GeminiContent = {
    role: 'user' | 'model';
    parts: GeminiPart[];
};
type GeminiToolNameMapper = {
    sanitize(name: string | undefined): string;
    restore(name: string | undefined): string;
};
type GeminiThinkingLevel = 'low' | 'medium' | 'high';
export declare const geminiAdapter: ProviderAdapter;
export declare function createGeminiRequest(requester: ModelHubRequester, params: any, toolNameMapper: GeminiToolNameMapper): Promise<Partial<{
    generationConfig: Partial<{
        temperature: any;
        topP: any;
        maxOutputTokens: any;
        stopSequences: any;
        responseModalities: string[];
        thinkingConfig: Partial<{
            includeThoughts: boolean;
            thinkingLevel: GeminiThinkingLevel;
        }> | Partial<{
            thinkingBudget: number;
            includeThoughts: boolean;
        }>;
    }>;
    safetySettings: {
        category: string;
        threshold: string;
    }[];
    tools: GeminiPart[];
    toolConfig: {
        includeServerSideToolInvocations: boolean;
    };
    contents: GeminiContent[];
    systemInstruction?: {
        parts: GeminiPart[];
    };
}>>;
export declare function createGeminiToolNameMapper(tools: StructuredTool[]): GeminiToolNameMapper;
export type GeminiStreamState = {
    nextToolIndex: number;
    partIndex: number;
    currentToolIndex?: number;
    currentToolId?: string;
};
export declare function parseGeminiResponse(text: string, requester: ModelHubRequester, toolNameMapper: GeminiToolNameMapper, streamState?: GeminiStreamState): Promise<ChatGenerationChunk>;
export {};
