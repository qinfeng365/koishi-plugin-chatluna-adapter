/** Lookup-only keys: retain namespaces, version digits and variant tokens. */
export declare function modelIdentityKey(model: string): string;
/** Name hints only. Never use this value as the upstream request model ID. */
export declare function modelNameForInference(model: string): string;
