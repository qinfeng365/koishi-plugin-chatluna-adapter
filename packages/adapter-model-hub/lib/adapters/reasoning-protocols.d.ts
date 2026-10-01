import type { OpenAICompatibleReasoningProtocol } from '../types';
type ReasoningEffort = 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';
export declare function applyReasoningProtocol(protocol: OpenAICompatibleReasoningProtocol, body: Record<string, unknown>, model: string): void;
export declare function resolveReasoningProtocol(configured: OpenAICompatibleReasoningProtocol | undefined, model: string): OpenAICompatibleReasoningProtocol;
export declare function normalizeDeepSeekReasoningEffort(effort: unknown): "none" | "low" | "high" | "max";
export declare function qwenThinkingBudgetForEffort(effort: unknown): 0 | 512 | 1024 | 4096 | 8192 | 16384;
export declare function geminiThinkingConfig(model: string, effort: unknown): {
    include_thoughts?: boolean;
    thinking_level: string;
    thinking_budget?: undefined;
} | {
    thinking_budget: number;
};
export declare function anthropicThinkingConfig(effort: unknown, model?: string, maxTokens?: number): {
    type: string;
    budget_tokens?: undefined;
    display?: undefined;
} | {
    type: string;
    budget_tokens: number;
    display?: undefined;
} | {
    type: string;
    display: string;
    budget_tokens?: undefined;
};
export declare function normalizeReasoningEffort(value: unknown): ReasoningEffort | undefined;
export declare function supportsAdaptiveThinking(model: string): boolean;
export declare function anthropicSupportedEfforts(model: string): Exclude<ReasoningEffort, 'none' | 'minimal'>[] | undefined;
/** Only emit output_config.effort on model families whose API supports it. */
export declare function anthropicEffortForModel(model: string, effort: unknown): "low" | "medium" | "high" | "xhigh" | "max";
export declare function nativeReasoningEfforts(model: string): ReasoningEffort[] | undefined;
export declare function validateNativeReasoningEffort(body: Record<string, unknown>, model: string): void;
export {};
