import { openAIChatProvider } from './helpers'

export default openAIChatProvider({
    id: 'xai',
    name: 'xAI',
    icon: 'xai',
    kind: 'cloud',
    defaultPlatform: 'hub-xai',
    defaultEndpoint: 'https://api.x.ai/v1',
    website: 'https://console.x.ai',
    models: []
})
