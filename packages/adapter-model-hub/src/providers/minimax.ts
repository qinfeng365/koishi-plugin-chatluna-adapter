import { openAIChatProvider } from './helpers'

export default openAIChatProvider({
    id: 'minimax',
    name: 'MiniMax',
    icon: 'minimax',
    kind: 'cloud',
    defaultPlatform: 'hub-minimax',
    defaultEndpoint: 'https://api.minimax.io/v1',
    website: 'https://platform.minimax.io',
    models: []
})
