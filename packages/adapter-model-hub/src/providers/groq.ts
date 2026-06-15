import { openAIChatProvider } from './helpers'

export default openAIChatProvider({
    id: 'groq',
    name: 'Groq',
    icon: 'groq',
    kind: 'cloud',
    defaultPlatform: 'hub-groq',
    defaultEndpoint: 'https://api.groq.com/openai/v1',
    website: 'https://console.groq.com',
    models: []
})
