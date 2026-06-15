import { openAIChatProvider } from './helpers'

export default openAIChatProvider({
    id: 'baichuan',
    name: 'Baichuan',
    icon: 'baichuan',
    kind: 'cloud',
    defaultPlatform: 'hub-baichuan',
    defaultEndpoint: 'https://api.baichuan-ai.com/v1',
    website: 'https://platform.baichuan-ai.com',
    models: []
})
