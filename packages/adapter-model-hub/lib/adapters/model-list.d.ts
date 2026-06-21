import type { ProviderModelEntry, ProviderPreset } from '../types';
export declare function parseOpenAIModels(payload: unknown, provider?: Pick<ProviderPreset, 'id' | 'reasoningEffort'>): ProviderModelEntry[];
export declare function expandReasoningVariantsForProvider(provider: Pick<ProviderPreset, 'id' | 'reasoningEffort'> | undefined, models: ProviderModelEntry[]): ProviderModelEntry[];
export declare function parseGeminiModels(payload: unknown): ProviderModelEntry[];
