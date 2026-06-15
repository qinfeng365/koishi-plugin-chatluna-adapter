import { openAIChatProvider } from './helpers'

export default openAIChatProvider({
    id: 'zhipu',
    name: 'Zhipu AI',
    icon: 'zhipu',
    kind: 'cloud',
    defaultPlatform: 'hub-zhipu',
    defaultEndpoint: 'https://open.bigmodel.cn/api/paas/v4',
    website: 'https://open.bigmodel.cn',
    models: []
})
