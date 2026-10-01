import {
    fetchFileLikeUrl,
    supportAudioInput,
    supportImageInput
} from '@chatluna/v1-shared-adapter'
import {
    ModelCapabilities as Cap,
    type FileHandlingConfig
} from 'koishi-plugin-chatluna/llm-core/platform/types'
import type { ModelRequestParams } from 'koishi-plugin-chatluna/llm-core/platform/api'
import type { ProviderAdapterId, ProviderModelEntry } from './types'

export function resolveCapabilities(
    adapter: ProviderAdapterId,
    model: ProviderModelEntry,
    responseApi = false
) {
    responseApi ||= adapter === 'openai' && /^gpt-6/i.test(model.name)
    const result = new Set(model.capabilities ?? [])
    if (adapter !== 'dify') {
        result.add(Cap.ToolCall)
        if (
            supportImageInput(model.name) ||
            /^(gpt-6|kimi-k3)/i.test(model.name)
        )
            result.add(Cap.ImageInput)
        if (/^kimi-k3/i.test(model.name)) result.add(Cap.VideoInput)
        if (supportAudioInput(model.name)) result.add(Cap.AudioInput)
        if (isThinkingModelName(model.name)) result.add(Cap.Thinking)
    }
    for (const [capability, supported] of Object.entries(
        model.capabilityOverrides ?? {}
    )) {
        if (supported) result.add(capability as Cap)
        else result.delete(capability as Cap)
    }
    return protocolCapabilities(adapter, [...result], responseApi)
}

export function protocolCapabilities(
    adapter: ProviderAdapterId,
    capabilities: Cap[],
    responseApi = false
) {
    // The official Responses input serializer supports images/files, not audio/video.
    return adapter === 'openai' && responseApi
        ? capabilities.filter(
              (capability) =>
                  capability !== Cap.AudioInput && capability !== Cap.VideoInput
          )
        : capabilities
}

function isThinkingModelName(model: string) {
    const lower = model.toLowerCase()
    return (
        ['reasoner', 'thinking', 'reasoning', 'r1'].some((name) =>
            lower.includes(name)
        ) ||
        [
            'o1',
            'o3',
            'o4',
            'gpt-5',
            'gpt-6',
            'kimi-k3',
            'glm-5.3',
            'minimax-m3.1'
        ].some((name) => lower.startsWith(name))
    )
}

const IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
const AUDIO_MIMES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav']

export function capabilityFileHandling(
    adapter: ProviderAdapterId,
    capabilities: Cap[]
): FileHandlingConfig | undefined {
    const mimes = new Set<string>()
    if (capabilities.includes(Cap.ImageInput))
        IMAGE_MIMES.forEach((mime) => mimes.add(mime))
    if (capabilities.includes(Cap.AudioInput)) {
        AUDIO_MIMES.forEach((mime) => mimes.add(mime))
        if (adapter === 'gemini') {
            ;[
                'audio/ogg',
                'audio/flac',
                'audio/aac',
                'audio/mp4',
                'audio/webm'
            ].forEach((mime) => mimes.add(mime))
        }
    }
    if (capabilities.includes(Cap.VideoInput)) {
        ;['video/mp4', 'video/quicktime', 'video/webm', 'video/mpeg'].forEach(
            (mime) => mimes.add(mime)
        )
    }
    if (capabilities.includes(Cap.FileInput)) mimes.add('application/pdf')
    if (!mimes.size) return undefined
    // Gemini's inline request limit is 20 MB, including base64 expansion.
    const limit = (adapter === 'gemini' ? 14 : 20) * 1024 * 1024
    return {
        supportedMimeTypes: mimes,
        maxTotalSizeBytes: limit,
        maxFileSizeBytes: limit
    }
}

/** Prepare declared media before the shared serializer's name-based audio check. */
export async function prepareCapabilityParams<T extends ModelRequestParams>(
    params: T,
    capabilities: Cap[] | undefined,
    adapter: ProviderAdapterId,
    plugin: Parameters<typeof fetchFileLikeUrl>[0],
    responseApi = false
): Promise<T> {
    if (!capabilities) return params
    const native =
        adapter === 'gemini' || adapter === 'anthropic' || adapter === 'dify'
    const input = await Promise.all(
        params.input.map(async (message) => {
            if (!Array.isArray(message.content)) return message
            const content = []
            for (const part of message.content) {
                const capability = (
                    {
                        image_url: Cap.ImageInput,
                        input_image: Cap.ImageInput,
                        audio_url: Cap.AudioInput,
                        input_audio: Cap.AudioInput,
                        video_url: Cap.VideoInput,
                        file_url: Cap.FileInput,
                        file: Cap.FileInput
                    } as Record<string, Cap>
                )[part.type]
                if (capability && !capabilities.includes(capability)) continue
                if (!native && part.type === 'audio_url') {
                    const file = await fetchFileLikeUrl(plugin, part as any)
                    const format = (
                        {
                            'audio/mpeg': 'mp3',
                            'audio/mp3': 'mp3',
                            'audio/wav': 'wav',
                            'audio/x-wav': 'wav'
                        } as Record<string, string>
                    )[file.mimeType.toLowerCase()]
                    if (!format)
                        throw new Error(
                            `Unsupported OpenAI audio input MIME: ${file.mimeType}`
                        )
                    content.push({
                        type: 'input_audio',
                        input_audio: {
                            data: file.buffer.toString('base64'),
                            format
                        }
                    })
                } else if (
                    !native &&
                    !responseApi &&
                    part.type === 'file_url'
                ) {
                    const file = await fetchFileLikeUrl(plugin, part as any)
                    content.push({
                        type: 'file',
                        file: {
                            filename: 'attachment.pdf',
                            file_data: `data:${file.mimeType};base64,${file.buffer.toString('base64')}`
                        }
                    })
                } else content.push(part)
            }
            return Object.assign(
                Object.create(Object.getPrototypeOf(message)),
                message,
                { content }
            )
        })
    )
    const overrides = { ...params.overrideRequestParams }
    if (!capabilities.includes(Cap.ToolCall)) {
        delete overrides.tools
        delete overrides.tool_choice
        delete overrides.parallel_tool_calls
    }
    return {
        ...params,
        input,
        tools: capabilities.includes(Cap.ToolCall) ? params.tools : undefined,
        overrideRequestParams: overrides
    }
}
