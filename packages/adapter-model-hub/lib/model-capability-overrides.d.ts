import type { ModelCapabilityOverrideEntry, ModelHubSettings, ProviderEntry, ProviderModelEntry } from './types';
export declare function normalizeModelCapabilityOverrides(input: unknown, providers: readonly ProviderEntry[]): ModelCapabilityOverrideEntry[];
export declare function manualModelCapabilities(settings: Pick<ModelHubSettings, 'modelCapabilityOverrides'>, scope: Omit<ModelCapabilityOverrideEntry, 'model' | 'overrides'>, model: Pick<ProviderModelEntry, 'name' | 'reasoningVariantOf'>): ModelCapabilityOverrideEntry['overrides'];
/** Apply after automatic inference; auto means absence, not a saved guess. */
export declare function applyManualModelCapabilities<T extends ProviderModelEntry>(model: T, overrides: ModelCapabilityOverrideEntry['overrides']): T & Pick<ProviderModelEntry, 'capabilityOverrides'>;
