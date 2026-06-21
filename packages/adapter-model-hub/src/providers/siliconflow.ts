import { openAIChatProvider } from './helpers'

export default openAIChatProvider({
    id: 'siliconflow',
    name: 'SiliconFlow',
    icon: 'siliconcloud',
    kind: 'cloud',
    defaultPlatform: 'hub-siliconflow',
    defaultEndpoint: 'https://api.siliconflow.cn/v1',
    website: 'https://siliconflow.cn',
    reasoningEffort: 'passthrough',
    models: []
})
