/** Lookup-only keys: retain namespaces, version digits and variant tokens. */
export function modelIdentityKey(model: string) {
    return model
        .trim()
        .toLowerCase()
        .replace(/[\s_.-]+/g, '-')
}

/** Name hints only. Never use this value as the upstream request model ID. */
export function modelNameForInference(model: string) {
    const name = model.slice(model.lastIndexOf('/') + 1)
    return name
        .trim()
        .toLowerCase()
        .replace(/[\s_.-]+/g, '-')
        .replace(/(\d)-(\d{1,2})(?=-|$)/, '$1.$2')
}
