import { openAIChatProvider } from './helpers'

export default openAIChatProvider({
    id: 'deepseek',
    name: 'DeepSeek',
    icon: 'deepseek',
    kind: 'cloud',
    defaultPlatform: 'hub-deepseek',
    defaultEndpoint: 'https://api.deepseek.com',
    website: 'https://platform.deepseek.com',
    models: [],
    patchCompletionBody(body, model) {
        const lower = model.toLowerCase()
        if (!lower.includes('reasoner') && !lower.includes('r1')) return
        delete body.temperature
        delete body.presence_penalty
        delete body.frequency_penalty
        delete body.top_p
    }
})
