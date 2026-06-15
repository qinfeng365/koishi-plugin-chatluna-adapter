import { openAIChatProvider } from './helpers'

export default openAIChatProvider({
    id: 'ollama',
    name: 'Ollama',
    icon: 'ollama',
    kind: 'local',
    defaultPlatform: 'hub-ollama',
    defaultEndpoint: 'http://127.0.0.1:11434/v1',
    website: 'https://ollama.com',
    allowEmptyApiKey: true,
    models: []
})
