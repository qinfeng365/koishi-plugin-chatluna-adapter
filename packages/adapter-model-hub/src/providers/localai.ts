import { openAIChatProvider } from './helpers'

export default openAIChatProvider({
    id: 'localai',
    name: 'LocalAI',
    icon: 'openai',
    kind: 'local',
    defaultPlatform: 'hub-localai',
    defaultEndpoint: 'http://127.0.0.1:8080/v1',
    website: 'https://localai.io',
    allowEmptyApiKey: true,
    models: []
})
