import { openAIChatProvider } from './helpers'

export default openAIChatProvider({
    id: 'together',
    name: 'Together AI',
    icon: 'together',
    kind: 'cloud',
    defaultPlatform: 'hub-together',
    defaultEndpoint: 'https://api.together.xyz/v1',
    website: 'https://api.together.xyz',
    models: []
})
