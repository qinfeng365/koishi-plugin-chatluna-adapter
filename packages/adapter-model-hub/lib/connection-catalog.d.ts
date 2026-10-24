import type { ModelInfo } from 'koishi-plugin-chatluna/llm-core/platform/types';
interface Directory {
    models: ModelInfo[];
    updatedAt: number;
}
/** Non-secret, permission-scoped last-good directories, separate from administrator settings. */
export declare class ConnectionCatalogStore {
    private path?;
    private onRecovery?;
    private directories;
    private origins;
    private resourceOwners;
    private writes;
    constructor(path?: string, onRecovery?: () => void);
    load(): Promise<void>;
    get(key: string): Directory;
    set(key: string, models: ModelInfo[], updatedAt: number): void;
    origin(platform: string, model: string): string;
    rememberOrigin(platform: string, model: string, sourceId: string): void;
    resourceOwner(key: string): string;
    rememberResource(key: string, owner: string): void;
    flush(): Promise<void>;
}
export {};
