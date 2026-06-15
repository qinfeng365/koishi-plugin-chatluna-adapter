import { openAIChatProvider } from './helpers'

export default openAIChatProvider({
    id: 'yi',
    name: '01.AI',
    icon: 'yi',
    kind: 'cloud',
    defaultPlatform: 'hub-yi',
    defaultEndpoint: 'https://api.lingyiwanwu.com/v1',
    website: 'https://platform.lingyiwanwu.com',
    models: []
})
