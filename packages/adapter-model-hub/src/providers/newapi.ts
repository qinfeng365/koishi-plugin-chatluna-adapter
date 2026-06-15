import { openAIChatProvider } from './helpers'

export default openAIChatProvider({
    id: 'newapi',
    name: 'New API',
    icon: 'newapi',
    kind: 'local',
    defaultPlatform: 'hub-newapi',
    defaultEndpoint: 'http://127.0.0.1:3000/v1',
    website: 'https://github.com/QuantumNous/new-api',
    allowEmptyApiKey: true,
    models: []
})
