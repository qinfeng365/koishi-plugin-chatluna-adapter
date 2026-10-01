import { openAIProvider } from './helpers'

export default openAIProvider({
    id: 'xai',
    name: 'xAI',
    icon: 'xai',
    kind: 'cloud',
    defaultPlatform: 'hub-xai',
    defaultEndpoint: 'https://api.x.ai/v1',
    website: 'https://console.x.ai',
    reasoningEffort: 'passthrough',
    models: []
})
