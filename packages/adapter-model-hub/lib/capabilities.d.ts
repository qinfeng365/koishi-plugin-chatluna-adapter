import { fetchFileLikeUrl } from '@chatluna/v1-shared-adapter';
import { ModelCapabilities as Cap, type FileHandlingConfig } from 'koishi-plugin-chatluna/llm-core/platform/types';
import type { ModelRequestParams } from 'koishi-plugin-chatluna/llm-core/platform/api';
import type { ProviderAdapterId, ProviderModelEntry } from './types';
export declare function resolveCapabilities(adapter: ProviderAdapterId, model: ProviderModelEntry, responseApi?: boolean): Cap[];
export declare function protocolCapabilities(adapter: ProviderAdapterId, capabilities: Cap[], responseApi?: boolean): Cap[];
export declare function capabilityFileHandling(adapter: ProviderAdapterId, capabilities: Cap[]): FileHandlingConfig | undefined;
/** Prepare declared media before the shared serializer's name-based audio check. */
export declare function prepareCapabilityParams<T extends ModelRequestParams>(params: T, capabilities: Cap[] | undefined, adapter: ProviderAdapterId, plugin: Parameters<typeof fetchFileLikeUrl>[0], responseApi?: boolean): Promise<T>;
