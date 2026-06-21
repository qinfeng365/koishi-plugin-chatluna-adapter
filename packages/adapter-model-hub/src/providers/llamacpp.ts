import { openAIChatProvider } from './helpers'

export default openAIChatProvider({
    id: 'llamacpp',
    name: 'llama.cpp',
    icon: 'openai',
    kind: 'local',
    defaultPlatform: 'hub-llamacpp',
    defaultEndpoint: 'http://127.0.0.1:8080/v1',
    website: 'https://github.com/ggml-org/llama.cpp',
    allowEmptyApiKey: true,
    models: []
})
