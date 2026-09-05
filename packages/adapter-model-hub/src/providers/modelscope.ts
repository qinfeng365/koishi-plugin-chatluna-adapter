import { openAIChatProvider } from './helpers'

export default openAIChatProvider({
    id: 'modelscope',
    name: 'ModelScope 魔搭',
    icon: 'modelscope',
    kind: 'cloud',
    defaultPlatform: 'hub-modelscope',
    defaultEndpoint: 'https://api-inference.modelscope.cn/v1',
    website: 'https://www.modelscope.cn',
    reasoningEffort: 'passthrough',
    models: [],
    patchEmbeddingsBody(body) {
        body.encoding_format ??= 'float'
    }
})
