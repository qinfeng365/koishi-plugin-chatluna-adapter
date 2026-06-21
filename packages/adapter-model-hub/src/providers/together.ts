import { openAIChatProvider } from './helpers'

export default openAIChatProvider({
    id: 'together',
    name: 'Together AI',
    icon: 'together',
    kind: 'cloud',
    defaultPlatform: 'hub-together',
    defaultEndpoint: 'https://api.together.ai/v1',
    website: 'https://docs.together.ai',
    models: []
})
