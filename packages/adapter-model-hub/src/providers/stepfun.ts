import { openAIChatProvider } from './helpers'

export default openAIChatProvider({
    id: 'stepfun',
    name: 'StepFun',
    icon: 'stepfun',
    kind: 'cloud',
    defaultPlatform: 'hub-stepfun',
    defaultEndpoint: 'https://api.stepfun.com/v1',
    website: 'https://platform.stepfun.com',
    models: []
})
