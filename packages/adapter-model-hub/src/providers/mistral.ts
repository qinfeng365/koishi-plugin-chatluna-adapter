import { openAIChatProvider } from './helpers'

export default openAIChatProvider({
    id: 'mistral',
    name: 'Mistral AI',
    icon: 'mistral',
    kind: 'cloud',
    defaultPlatform: 'hub-mistral',
    defaultEndpoint: 'https://api.mistral.ai/v1',
    website: 'https://console.mistral.ai',
    models: []
})
