import { openAIChatProvider } from './helpers'

export default openAIChatProvider({
    id: 'xinference',
    name: 'Xinference',
    icon: 'xinference',
    kind: 'local',
    defaultPlatform: 'hub-xinference',
    defaultEndpoint: 'http://127.0.0.1:9997/v1',
    website: 'https://inference.readthedocs.io',
    allowEmptyApiKey: true,
    models: []
})
