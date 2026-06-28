import { anthropicProvider } from './helpers'

export default anthropicProvider({
    id: 'anthropic',
    name: 'Anthropic',
    icon: 'anthropic',
    kind: 'cloud',
    defaultPlatform: 'hub-anthropic',
    defaultEndpoint: 'https://api.anthropic.com/v1',
    website: 'https://www.anthropic.com',
    reasoningEffort: 'passthrough',
    models: []
})
