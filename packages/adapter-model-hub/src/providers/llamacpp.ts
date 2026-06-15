import { openAIChatProvider } from './helpers'

export default openAIChatProvider({
    id: 'llamacpp',
    name: 'llama.cpp',
    icon: 'llamacpp',
    kind: 'local',
    defaultPlatform: 'hub-llamacpp',
    defaultEndpoint: 'http://127.0.0.1:8080/v1',
    website: 'https://github.com/ggerganov/llama.cpp',
    allowEmptyApiKey: true,
    models: []
})
