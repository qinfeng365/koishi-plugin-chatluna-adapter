import { openAIChatProvider } from './helpers'

export default openAIChatProvider({
    id: 'vllm',
    name: 'vLLM',
    icon: 'vllm',
    kind: 'local',
    defaultPlatform: 'hub-vllm',
    defaultEndpoint: 'http://127.0.0.1:8000/v1',
    website: 'https://docs.vllm.ai',
    allowEmptyApiKey: true,
    models: []
})
