import { geminiProvider } from './helpers'

export default geminiProvider({
    id: 'gemini',
    name: 'Google Gemini',
    icon: 'gemini',
    kind: 'cloud',
    defaultPlatform: 'hub-gemini',
    defaultEndpoint: 'https://generativelanguage.googleapis.com/v1beta',
    website: 'https://ai.google.dev/gemini-api',
    models: []
})
