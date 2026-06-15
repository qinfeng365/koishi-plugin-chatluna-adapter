import { openAIChatProvider } from './helpers'

export default openAIChatProvider({
    id: 'openai-compatible',
    name: '自定义 OpenAI-compatible',
    icon: 'openai',
    kind: 'cloud',
    defaultPlatform: 'hub-openai-compatible',
    defaultEndpoint: 'https://api.example.com/v1',
    website: '',
    models: []
})
