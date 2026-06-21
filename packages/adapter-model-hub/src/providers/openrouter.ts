import { openAIChatProvider } from './helpers'

export default openAIChatProvider({
    id: 'openrouter',
    name: 'OpenRouter',
    icon: 'openrouter',
    kind: 'cloud',
    defaultPlatform: 'hub-openrouter',
    defaultEndpoint: 'https://openrouter.ai/api/v1',
    website: 'https://openrouter.ai',
    reasoningEffort: 'passthrough',
    models: []
})
