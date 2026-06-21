import type { ProviderAdapter } from './types';
export declare const openAIChatAdapter: ProviderAdapter;
export declare function preserveRealModelName<T extends {
    model?: string;
    overrideRequestParams?: Record<string, unknown>;
}>(params: T): T;
