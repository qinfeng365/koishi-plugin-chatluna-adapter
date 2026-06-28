import type { OpenAICompatibleReasoningProtocol, ProviderModelEntry, ProviderPreset } from '../types';
export declare function parseOpenAIModels(payload: unknown, provider?: Pick<ProviderPreset, 'id' | 'reasoningEffort'>): ProviderModelEntry[];
export declare function expandReasoningVariantsForProvider(provider: Pick<ProviderPreset, 'id' | 'reasoningEffort'> | undefined, models: ProviderModelEntry[], options?: {
    reasoningProtocol?: OpenAICompatibleReasoningProtocol;
}): ProviderModelEntry[];
export declare function parseGeminiModels(payload: unknown): ProviderModelEntry[];
export declare function parseAnthropicModels(payload: unknown): ProviderModelEntry[];
