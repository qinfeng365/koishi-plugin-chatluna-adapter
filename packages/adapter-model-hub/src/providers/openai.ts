import { openAIProvider } from './helpers'

export default openAIProvider({
    id: 'openai',
    name: 'OpenAI',
    icon: 'openai',
    kind: 'cloud',
    defaultPlatform: 'hub-openai',
    defaultEndpoint: 'https://api.openai.com/v1',
    website: 'https://platform.openai.com',
    models: []
})
