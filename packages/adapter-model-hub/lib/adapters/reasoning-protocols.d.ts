import type { OpenAICompatibleReasoningProtocol } from '../types';
export declare function applyReasoningProtocol(protocol: OpenAICompatibleReasoningProtocol, body: Record<string, unknown>, model: string): void;
export declare function resolveReasoningProtocol(configured: OpenAICompatibleReasoningProtocol | undefined, model: string): OpenAICompatibleReasoningProtocol;
export declare function normalizeDeepSeekReasoningEffort(effort: unknown): "high" | "max";
export declare function qwenThinkingBudgetForEffort(effort: unknown): 0 | 4096 | 8192 | 1024 | 512 | 16384;
export declare function geminiThinkingConfig(model: string, effort: unknown): {
    include_thoughts?: boolean;
    thinking_level: string;
    thinking_budget?: undefined;
} | {
    thinking_budget: number;
};
export declare function anthropicThinkingConfig(effort: unknown): {
    type: string;
    display?: undefined;
} | {
    type: string;
    display: string;
};
