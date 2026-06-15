import { openAIChatProvider } from './helpers'

export default openAIChatProvider({
    id: 'moonshot',
    name: 'Moonshot AI',
    icon: 'moonshot',
    kind: 'cloud',
    defaultPlatform: 'hub-moonshot',
    defaultEndpoint: 'https://api.moonshot.cn/v1',
    website: 'https://platform.moonshot.cn',
    models: []
})
