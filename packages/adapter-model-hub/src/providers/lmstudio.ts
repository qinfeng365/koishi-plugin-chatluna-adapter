import { openAIChatProvider } from './helpers'

export default openAIChatProvider({
    id: 'lmstudio',
    name: 'LM Studio',
    icon: 'lmstudio',
    kind: 'local',
    defaultPlatform: 'hub-lmstudio',
    defaultEndpoint: 'http://127.0.0.1:1234/v1',
    website: 'https://lmstudio.ai',
    allowEmptyApiKey: true,
    models: []
})
