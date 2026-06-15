import type { Context } from 'koishi';
import type { ProviderModelEntry } from './types';
export declare class ModelMetadataStore {
    private ctx;
    private options;
    private _models;
    private _timer?;
    readonly path: string;
    constructor(ctx: Context, options?: {
        url?: string;
        cachePath?: string;
        updateHours?: number;
    });
    start(): Promise<void>;
    load(): Promise<void>;
    refresh(): Promise<void>;
    enhance(provider: string, model: ProviderModelEntry): ProviderModelEntry;
    getMaxTokens(provider: string, model: string): number;
    private apply;
    private find;
}
