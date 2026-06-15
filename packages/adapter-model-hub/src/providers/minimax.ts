import { openAIChatProvider } from './helpers'

export default openAIChatProvider({
    id: 'minimax',
    name: 'MiniMax',
    icon: 'minimax',
    kind: 'cloud',
    defaultPlatform: 'hub-minimax',
    defaultEndpoint: 'https://api.minimaxi.com/v1',
    website: 'https://platform.minimaxi.com',
    models: []
})
