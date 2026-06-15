import { openAIChatProvider } from './helpers'

export default openAIChatProvider({
    id: 'qwen',
    name: 'Qwen',
    icon: 'qwen',
    kind: 'cloud',
    defaultPlatform: 'hub-qwen',
    defaultEndpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    website: 'https://dashscope.aliyun.com',
    models: []
})
