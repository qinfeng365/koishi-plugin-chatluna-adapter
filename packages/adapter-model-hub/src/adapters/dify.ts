import {
    AIMessageChunk,
    BaseMessage,
    type MessageContent
} from '@langchain/core/messages'
import { ChatGenerationChunk } from '@langchain/core/outputs'
import type { UsageMetadata } from '@langchain/core/messages'
import fs from 'fs'
import path from 'path'
import { readFile } from 'fs/promises'
import { fileURLToPath } from 'url'
import { checkResponse, sseIterable } from 'koishi-plugin-chatluna/utils/sse'
import {
    getMessageContent,
    isMessageContentImageUrl,
    isMessageContentText
} from 'koishi-plugin-chatluna/utils/string'
import {
    ChatLunaError,
    ChatLunaErrorCode
} from 'koishi-plugin-chatluna/utils/error'
import { createUsageMetadata } from '@chatluna/v1-shared-adapter'
import { ModelCapabilities } from 'koishi-plugin-chatluna/llm-core/platform/types'
import type { ProviderAdapter } from './types'
import type { ModelHubRequester } from '../requester'
import type {
    DifyAppType,
    DifyFileHandlingLimits,
    DifyFileType,
    DifyInputControl,
    DifyRuntimeAppConfig,
    DifyTransferMethod,
    ProviderModelEntry
} from '../types'

type DifyInputFileObject =
    | {
          type: DifyFileType
          transfer_method: 'local_file'
          upload_file_id: string
      }
    | {
          type: DifyFileType
          transfer_method: 'remote_url'
          url: string
      }

interface DifyUploadedFileObject {
    type: DifyFileType
    transfer_method: 'local_file'
    upload_file_id: string
}

interface DifyUploadCandidate {
    source: string | ArrayBuffer | Uint8Array | Buffer
    type: DifyFileType
    fileName?: string
    mimeType?: string
}

interface DifyFilePayload {
    buffer: Buffer
    fileName: string
    mimeType?: string
}

interface DifyStreamResponse {
    event?: string
    answer?: string
    data?: {
        outputs?: Record<string, unknown>
        usage?: DifyUsage
        text?: string
        total_tokens?: number
        status?: string
        error?: string | null
        execution_metadata?: {
            total_tokens?: number
        }
    }
    conversation_id?: string
    message_id?: string
    task_id?: string
    metadata?: {
        usage?: DifyUsage
    }
    error?: string
    message?: string
    code?: string
    status?: number
}

interface DifyParametersResponse {
    user_input_form?: Record<string, DifyFormControl>[]
    file_upload?: {
        image?: {
            enabled?: boolean
            number_limits?: number
            transfer_methods?: string[]
        }
    } & Record<string, unknown>
    system_parameters?: {
        file_size_limit?: number
        image_file_size_limit?: number
        audio_file_size_limit?: number
        video_file_size_limit?: number
        workflow_file_upload_limit?: number
    }
}

interface DifyFormControl {
    variable?: string
    required?: boolean
    default?: unknown
    type?: string
    label?: string
    options?: unknown[]
    allowed_file_types?: DifyFileType[]
    allowed_file_upload_methods?: string[]
    max_length?: number
}

interface DifyUsage {
    prompt_tokens?: number
    prompt_unit_price?: string
    prompt_price_unit?: string
    prompt_price?: string
    completion_tokens?: number
    completion_unit_price?: string
    completion_price_unit?: string
    completion_price?: string
    total_tokens?: number
    total_price?: string
    currency?: string
    latency?: number
}

export const difyAdapter: ProviderAdapter = {
    id: 'dify',

    async completion(requester, params) {
        let generation = new ChatGenerationChunk({
            message: new AIMessageChunk({ content: '' }),
            text: ''
        })
        for await (const chunk of difyCompletionStream(requester, params)) {
            generation = generation.concat(chunk)
        }
        return generation
    },

    async *completionStream(requester, params) {
        yield* difyCompletionStream(requester, params)
    },

    async *completionStreamInternal(requester, params) {
        yield* difyCompletionStream(requester, params)
    },

    async embeddings(requester, params) {
        throw new ChatLunaError(
            ChatLunaErrorCode.API_REQUEST_FAILED,
            new Error(`Dify does not provide embeddings for ${params.model}.`)
        )
    },

    async rerank(requester, params) {
        throw new ChatLunaError(
            ChatLunaErrorCode.API_REQUEST_FAILED,
            new Error(`Dify does not provide rerank for ${params.model}.`)
        )
    },

    async getModels(requester, config) {
        return await difyModels(requester, config?.signal)
    },

    async dispose(requester, model, id) {
        await disposeDifyConversation(requester, model, id)
    }
}

async function* difyCompletionStream(
    requester: ModelHubRequester,
    params: any
) {
    const config = resolveDifyApp(requester, params.model)
    const conversationId = resolveChatLunaConversationId(params)

    const difyUser = resolveDifyUser(requester, params)
    const difyConversationId =
        config.appType === 'workflow' ||
        config.appType === 'completion' ||
        !conversationId
            ? undefined
            : await getDifyConversationId(requester, conversationId, config)
    const response = await callDify(requester, params, config, {
        chatLunaConversationId: conversationId,
        difyConversationId,
        difyUser
    })

    await checkResponse(response)

    let updatedDifyConversationId: string | undefined
    let usage: UsageMetadata | undefined

    for await (const event of sseIterable(response)) {
        if (!event.data || event.data === '[DONE]') continue
        const data = parseDifyEvent(event.data)

        if (isDifyErrorEvent(data)) {
            throw new ChatLunaError(
                ChatLunaErrorCode.API_REQUEST_FAILED,
                new Error(formatDifyError(data, event.data))
            )
        }

        updatedDifyConversationId =
            data.conversation_id ?? updatedDifyConversationId
        usage =
            usageFromDify(data.metadata?.usage ?? data.data?.usage) ??
            usageFromWorkflowData(data.data) ??
            usage

        const content = textFromDifyEvent(data, config)
        if (content) {
            yield createDifyChunk(content, usage)
        }

        if (isDifyTerminalEvent(data.event, config.appType)) {
            break
        }
    }

    if (
        conversationId &&
        updatedDifyConversationId &&
        config.appType !== 'workflow' &&
        config.appType !== 'completion'
    ) {
        await updateDifyConversationId(
            requester,
            conversationId,
            config,
            updatedDifyConversationId,
            difyUser
        )
    }

    if (usage) {
        yield createDifyChunk('', usage)
    }
}

async function callDify(
    requester: ModelHubRequester,
    params: any,
    config: DifyRuntimeAppConfig,
    context: {
        chatLunaConversationId?: string
        difyConversationId?: string
        difyUser: string
    }
) {
    const lastMessage = params.input?.[params.input.length - 1] as
        | BaseMessage
        | undefined
    const { files, chatlunaMultimodal } = await prepareDifyFiles(
        requester,
        params,
        lastMessage,
        config,
        context.difyUser
    )
    const inputs = buildDifyInputs(
        params,
        context.chatLunaConversationId,
        lastMessage,
        config,
        chatlunaMultimodal
    )

    if (config.appType === 'workflow') {
        const workflowInputs = withWorkflowFileInputs(inputs, files, config)
        const body = filterEmpty({
            inputs: workflowInputs,
            response_mode: 'streaming',
            user: context.difyUser,
            files: files.length > 0 ? files : undefined
        })
        const path = config.workflowId
            ? `/workflows/${encodeURIComponent(config.workflowId)}/run`
            : '/workflows/run'
        return postDify(requester, config, path, body, params.signal)
    }

    if (config.appType === 'completion') {
        const query = buildDifyQuery(params, lastMessage, config, inputs)
        const body = filterEmpty({
            inputs,
            query,
            response_mode: 'streaming',
            user: context.difyUser,
            files: files.length > 0 ? files : undefined
        })
        return postDify(
            requester,
            config,
            '/completion-messages',
            body,
            params.signal
        )
    }

    const query = buildDifyQuery(params, lastMessage, config, inputs)
    const body = filterEmpty({
        query,
        inputs,
        response_mode: 'streaming',
        user: context.difyUser,
        conversation_id: context.difyConversationId ?? '',
        files: files.length > 0 ? files : undefined
    })
    return postDify(requester, config, '/chat-messages', body, params.signal)
}

async function difyModels(
    requester: ModelHubRequester,
    signal?: AbortSignal
): Promise<ProviderModelEntry[]> {
    const apps = await resolveDifyAppsWithParameters(requester, signal)
    const result = apps.map((app) => ({
        name: app.modelName,
        type: undefined,
        maxTokens: app.contextSize,
        capabilities: difyCapabilities(app)
    }))

    if (result.length > 0) return result

    const current = await enrichDifyAppParameters(
        requester,
        resolveDifyApp(requester, undefined),
        signal
    )
    const modelName = resolveDifyModelName(current)
    return [
        {
            name: modelName,
            maxTokens: current.contextSize,
            capabilities: difyCapabilities(current)
        }
    ]
}

function resolveDifyApp(
    requester: ModelHubRequester,
    model: string | undefined
): DifyRuntimeAppConfig {
    const apps = requester.currentConfig().difyApps ?? {}
    const key = model?.trim() ?? ''
    const app = key ? apps[key] : Object.values(apps)[0]
    if (app) return app

    if (key && Object.keys(apps).length > 0) {
        throw new ChatLunaError(
            ChatLunaErrorCode.MODEL_NOT_FOUND,
            new Error(`Dify app not found for model: ${key}`)
        )
    }

    const current = requester.currentConfig()
    return {
        apiKey: current.apiKey,
        apiEndpoint: current.apiEndpoint ?? '',
        platform: current.platform ?? 'hub-dify',
        providerName: current.providerName,
        modelName: resolveDifyModelName(current),
        appType: current.difyAppType ?? 'chat',
        workflowId: current.difyWorkflowId,
        outputVariable: current.difyOutputVariable,
        enableFileUpload: current.difyEnableFileUpload !== false,
        contextSize: current.difyContextSize ?? 128_000
    }
}

async function resolveDifyAppsWithParameters(
    requester: ModelHubRequester,
    signal?: AbortSignal
) {
    const config = requester.currentConfig()
    const apps = Object.values(config.difyApps ?? {})
    const normalized =
        apps.length > 0 ? apps : [resolveDifyApp(requester, undefined)]
    const seen = new Map<string, number>()
    const result: DifyRuntimeAppConfig[] = []

    for (const app of normalized) {
        const next = await enrichDifyAppParameters(requester, app, signal)
        const baseName = next.modelName
        const index = seen.get(baseName) ?? 0
        seen.set(baseName, index + 1)
        const unique = {
            ...next,
            modelName: index === 0 ? baseName : `${baseName}-${index + 1}`
        }
        result.push(unique)

        if (config.difyApps != null) {
            delete config.difyApps[app.modelName]
            config.difyApps[unique.modelName] = unique
        }
    }

    return result
}

async function enrichDifyAppParameters(
    requester: ModelHubRequester,
    config: DifyRuntimeAppConfig,
    signal?: AbortSignal
): Promise<DifyRuntimeAppConfig> {
    const parameters = await getDifyAppParameters(requester, config, signal)
    if (!parameters) return config
    return {
        ...config,
        parameters: {
            inputControls: parseDifyInputControls(parameters),
            fileHandling: parseDifyFileHandling(parameters)
        }
    }
}

async function getDifyAppParameters(
    requester: ModelHubRequester,
    config: DifyRuntimeAppConfig,
    signal?: AbortSignal
): Promise<DifyParametersResponse | undefined> {
    try {
        const response = await requester.requestContext().plugin.fetch(
            concatDifyUrl(config.apiEndpoint, '/parameters'),
            {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${config.apiKey}`
                },
                signal
            }
        )
        if (!response.ok) {
            requester.logger.warn(
                `Dify parameters fetch failed for ${config.modelName}: ${response.status} ${response.statusText}`
            )
            return undefined
        }
        return (await response.json()) as DifyParametersResponse
    } catch (error) {
        requester.logger.warn(error)
        return undefined
    }
}

function parseDifyInputControls(
    parameters: DifyParametersResponse
): DifyInputControl[] {
    const result: DifyInputControl[] = []
    for (const item of parameters.user_input_form ?? []) {
        const [type, control] = Object.entries(item)[0] ?? []
        if (!type || !control?.variable) continue
        result.push({
            variable: control.variable,
            type,
            required: control.required,
            defaultValue: control.default
        })
    }
    return result
}

function isDifyFileControlType(type: string | undefined) {
    return type != null && /file/i.test(type)
}

function parseDifyFileHandling(
    parameters: DifyParametersResponse
): DifyFileHandlingLimits | undefined {
    const system = parameters.system_parameters
    const imageUpload = parameters.file_upload?.image
    const imageEnabled =
        imageUpload?.enabled === true &&
        (imageUpload.transfer_methods == null ||
            imageUpload.transfer_methods.some(
                (method) => method === 'local_file' || method === 'remote_url'
            ))
    const supportedMimeTypes = new Set<string>()
    const allowedFileTypes: DifyFileType[] = []
    const allowedTransferMethods = new Set<DifyTransferMethod>()
    const declaredFileControls =
        parameters.user_input_form
            ?.map((item) => Object.entries(item)[0])
            .filter(([type]) => isDifyFileControlType(type))
            .map(([, control]) => control) ?? []
    const controlFileTypes = new Set<DifyFileType>()

    for (const control of declaredFileControls) {
        for (const type of control?.allowed_file_types ?? []) {
            controlFileTypes.add(type)
        }
        for (const method of control?.allowed_file_upload_methods ?? []) {
            addDifyTransferMethod(allowedTransferMethods, method)
        }
    }

    const workflowFileEnabled =
        declaredFileControls.length > 0 ||
        (configHasWorkflowFileLimit(parameters) && controlFileTypes.size > 0)

    if (workflowFileEnabled) {
        const types =
            controlFileTypes.size > 0
                ? [...controlFileTypes]
                : (['document', 'image', 'audio', 'video'] as DifyFileType[])
        for (const type of types) {
            addDifyFileType(supportedMimeTypes, allowedFileTypes, type)
        }
    }

    if (imageEnabled) {
        addDifyFileType(supportedMimeTypes, allowedFileTypes, 'image')
        for (const method of imageUpload?.transfer_methods ?? []) {
            addDifyTransferMethod(allowedTransferMethods, method)
        }
    }

    if (supportedMimeTypes.size > 0 && allowedTransferMethods.size < 1) {
        allowedTransferMethods.add('local_file')
    }

    if (supportedMimeTypes.size < 1) return undefined

    const fallbackLimit = mbToBytes(system?.file_size_limit, 15)
    const imageLimit = mbToBytes(
        system?.image_file_size_limit,
        fallbackLimit / 1024 / 1024
    )
    const audioLimit = mbToBytes(
        system?.audio_file_size_limit,
        fallbackLimit / 1024 / 1024
    )
    const videoLimit = mbToBytes(
        system?.video_file_size_limit,
        fallbackLimit / 1024 / 1024
    )
    const maxFileSizeBytes = Math.max(
        fallbackLimit,
        imageLimit,
        audioLimit,
        videoLimit
    )
    const maxFileCount =
        system?.workflow_file_upload_limit ?? imageUpload?.number_limits ?? 10

    return {
        supportedMimeTypes: [...supportedMimeTypes],
        maxFileSizeBytes,
        maxTotalSizeBytes: maxFileSizeBytes * Math.max(1, maxFileCount),
        maxFileSizeBytesOverrides: {
            'image/png': imageLimit,
            'image/jpeg': imageLimit,
            'image/gif': imageLimit,
            'image/webp': imageLimit,
            'image/svg+xml': imageLimit,
            'audio/mpeg': audioLimit,
            'audio/mp4': audioLimit,
            'audio/wav': audioLimit,
            'audio/ogg': audioLimit,
            'video/mp4': videoLimit,
            'video/quicktime': videoLimit,
            'video/webm': videoLimit
        },
        maxFileCount,
        allowedFileTypes,
        allowedTransferMethods: [...allowedTransferMethods]
    }
}

function addDifyTransferMethod(
    target: Set<DifyTransferMethod>,
    value: string | undefined
) {
    if (value === 'remote_url' || value === 'local_file') target.add(value)
}

function addDifyFileType(
    supportedMimeTypes: Set<string>,
    allowedFileTypes: DifyFileType[],
    type: DifyFileType
) {
    if (type === 'custom') return
    addMimeGroup(supportedMimeTypes, type)
    if (!allowedFileTypes.includes(type)) allowedFileTypes.push(type)
}

function configHasWorkflowFileLimit(parameters: DifyParametersResponse) {
    const value = parameters.system_parameters?.workflow_file_upload_limit
    return typeof value === 'number' && value > 0
}

function addMimeGroup(target: Set<string>, type: DifyFileType) {
    const groups: Record<DifyFileType, string[]> = {
        image: [
            'image/png',
            'image/jpeg',
            'image/gif',
            'image/webp',
            'image/svg+xml'
        ],
        document: [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'text/plain',
            'text/markdown',
            'text/csv'
        ],
        audio: ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg', 'audio/webm'],
        video: ['video/mp4', 'video/quicktime', 'video/webm'],
        custom: []
    }

    for (const mime of groups[type]) target.add(mime)
}

function mbToBytes(value: unknown, fallback: number) {
    const number = Number(value)
    const mb = Number.isFinite(number) ? number : fallback
    return Math.max(1, mb) * 1024 * 1024
}

function difyCapabilities(config: DifyRuntimeAppConfig) {
    if (!config.enableFileUpload) return []
    const allowed = config.parameters?.fileHandling?.allowedFileTypes
    if (allowed == null || allowed.length < 1) return []

    const result = new Set<ModelCapabilities>()
    if (allowed.includes('image')) result.add(ModelCapabilities.ImageInput)
    if (allowed.some((item) => item !== 'image')) {
        result.add(ModelCapabilities.FileInput)
    }
    if (allowed.includes('audio')) result.add(ModelCapabilities.AudioInput)
    if (allowed.includes('video')) result.add(ModelCapabilities.VideoInput)
    return [...result]
}

function resolveDifyModelName(config: {
    difyModelName?: string
    providerName?: string
    platform?: string
}) {
    return (
        config.difyModelName?.trim() ||
        config.providerName?.trim() ||
        config.platform?.trim() ||
        'dify-app'
    )
}

function parseDifyEvent(data: string): DifyStreamResponse {
    try {
        return JSON.parse(data)
    } catch (error) {
        throw new ChatLunaError(
            ChatLunaErrorCode.API_REQUEST_FAILED,
            new Error(`Failed to parse Dify stream event: ${data}`)
        )
    }
}

function textFromDifyEvent(
    data: DifyStreamResponse,
    config: DifyRuntimeAppConfig
) {
    if (typeof data.answer === 'string') return data.answer
    if (typeof data.data?.text === 'string') return data.data.text

    if (
        config.appType === 'workflow' &&
        data.event != null &&
        data.event !== 'workflow_finished'
    ) {
        return ''
    }

    const outputs = data.data?.outputs
    if (!outputs || typeof outputs !== 'object') return ''

    const key = config.outputVariable?.trim()
    if (key && outputs[key] != null) return outputToText(outputs[key])

    for (const candidate of ['answer', 'text', 'output', 'result']) {
        if (outputs[candidate] != null) return outputToText(outputs[candidate])
    }

    return outputToText(outputs)
}

function outputToText(value: unknown) {
    if (typeof value === 'string') return value
    if (value == null) return ''
    try {
        return JSON.stringify(value)
    } catch {
        return String(value)
    }
}

function isDifyTerminalEvent(event: string | undefined, type: DifyAppType) {
    if (event === 'message_end') return true
    if (event === 'workflow_finished') return true
    if (event === 'tts_message_end') return false
    return type === 'completion' && event === 'message_end'
}

function isDifyErrorEvent(data: DifyStreamResponse) {
    return (
        data.event === 'error' ||
        data.status === 400 ||
        data.status === 500 ||
        data.data?.status === 'failed' ||
        data.data?.status === 'stopped'
    )
}

function formatDifyError(data: DifyStreamResponse, raw: string) {
    return (
        data.message ||
        data.error ||
        data.data?.error ||
        (data.code ? `${data.code}: ${raw}` : `Dify request failed: ${raw}`)
    )
}

function createDifyChunk(content: string, usage?: UsageMetadata) {
    const message = new AIMessageChunk({
        content,
        usage_metadata: usage
    })
    return new ChatGenerationChunk({
        generationInfo: usage ? { usage_metadata: usage } : undefined,
        message,
        text: content
    })
}

function usageFromDify(usage: DifyUsage | undefined) {
    if (!usage) return undefined
    const inputTokens = numberOrUndefined(usage.prompt_tokens) ?? 0
    const outputTokens = numberOrUndefined(usage.completion_tokens) ?? 0
    const totalTokens =
        numberOrUndefined(usage.total_tokens) ??
        inputTokens + outputTokens
    if (totalTokens < 1 && inputTokens < 1 && outputTokens < 1) return undefined
    return createUsageMetadata({
        inputTokens,
        outputTokens,
        totalTokens
    })
}

function usageFromWorkflowData(data: DifyStreamResponse['data']) {
    const totalTokens =
        numberOrUndefined(data?.total_tokens) ??
        numberOrUndefined(data?.execution_metadata?.total_tokens)
    if (totalTokens == null) return undefined
    return createUsageMetadata({
        inputTokens: 0,
        outputTokens: 0,
        totalTokens
    })
}

function numberOrUndefined(value: unknown) {
    const number = Number(value)
    return Number.isFinite(number) ? number : undefined
}

function resolveChatLunaConversationId(params: any) {
    return (
        params.id ??
        params.variables?.built?.conversationId ??
        params.variables?.chatluna_conversation_id ??
        resolveConversationIdFromMessages(params.input)
    )
}

function resolveConversationIdFromMessages(messages: BaseMessage[] = []) {
    for (const message of messages) {
        const id =
            message.additional_kwargs?.chatluna_conversation_id ??
            message.additional_kwargs?.conversationId ??
            message.additional_kwargs?.conversation_id
        if (typeof id === 'string' && id.length > 0) return id
    }
}

function resolveDifyUser(requester: ModelHubRequester, params: any) {
    if (
        requester.koishiContext().chatluna.config.defaultGroupRouteMode ===
        'personal'
    ) {
        return (
            params.variables?.user_id ||
            params.variables?.user ||
            params.user ||
            'chatluna'
        )
    }
    return 'chatluna'
}

function buildDifyInputs(
    params: any,
    conversationId: string | undefined,
    lastMessage?: BaseMessage,
    config?: DifyRuntimeAppConfig,
    chatlunaMultimodal?: string
): Record<string, unknown> {
    const variables = params.variables ?? {}
    const promptParts = promptPartsFromMessages(params.input ?? [])
    const query = getMessageContent(lastMessage?.content ?? '')
    const character = resolveChatLunaCharacter(variables)
    const inputs: Record<string, unknown> = {
        input: query,
        query,
        prompt: query,
        system: promptParts.system,
        chatluna_system_prompt: promptParts.system,
        chatluna_history: buildChatlunaHistory(params.input ?? []),
        chatluna_conversation_id: conversationId,
        chatluna_user_id: variables.user_id ?? variables.built?.userId,
        chatluna_bot_id: variables.bot_id ?? variables.built?.botId,
        chatluna_group_id: variables.group_id ?? variables.built?.guildId,
        chatluna_channel_id: variables.channel_id ?? variables.built?.channelId,
        chatluna_request_id: variables.request_id ?? variables.built?.requestId,
        chatluna_chat_platform: variables.built?.chatPlatform,
        chatluna_user_name: variables.user,
        chatluna_preset: variables.preset ?? variables.built?.preset,
        chatluna_character: serializeDifyInputValue(character),
        chatluna_character_name: firstDefined(
            variables.character_name,
            variables.characterName,
            variables.name,
            variables.built?.characterName
        ),
        chatluna_persona: serializeDifyInputValue(
            firstDefined(
                variables.persona,
                variables.role,
                variables.description,
                variables.built?.persona
            )
        ),
        chatluna_authors_note: serializeDifyInputValue(variables.authors_note),
        chatluna_lore_books: serializeDifyInputValue(variables.lore_books),
        chatluna_source: variables.source ?? variables.built?.source,
        chatluna_multimodal: chatlunaMultimodal
    }

    for (const key of Object.keys(variables)) {
        const alias = `chatluna_${key}`
        if (inputs[alias] === undefined) inputs[alias] = variables[key]
    }

    for (const control of config?.parameters?.inputControls ?? []) {
        if (inputs[control.variable] !== undefined) continue
        const resolved = resolveDifyControlValue(control, variables, query, inputs)
        if (resolved !== undefined) inputs[control.variable] = resolved
    }

    return stripUndefined(inputs)
}

function buildDifyQuery(
    params: any,
    lastMessage: BaseMessage | undefined,
    config: DifyRuntimeAppConfig,
    inputs: Record<string, unknown>
) {
    const query = getMessageContent(lastMessage?.content ?? '') ?? ''
    const prefix = buildDifyCharacterQueryPrefix(params, config, inputs)
    if (!prefix) return query
    if (!query.trim()) return prefix
    return `${prefix}\n\n${query}`
}

function buildDifyCharacterQueryPrefix(
    params: any,
    config: DifyRuntimeAppConfig,
    inputs: Record<string, unknown>
) {
    if (config.appType === 'workflow') return ''
    if (hasDeclaredCharacterInputs(config)) return ''

    const variables = params.variables ?? {}
    const source = firstDefined(variables.source, variables.built?.source)
    const character = stringifyForPrompt(inputs.chatluna_character)
    const persona = stringifyForPrompt(inputs.chatluna_persona)
    const characterName = stringifyForPrompt(inputs.chatluna_character_name)
    const system = stringifyForPrompt(inputs.chatluna_system_prompt)
    const preset = stringifyForPrompt(inputs.chatluna_preset)

    if (
        !character &&
        !persona &&
        !characterName &&
        !system &&
        !preset &&
        source !== 'character'
    ) {
        return ''
    }

    const parts: string[] = []
    if (system) parts.push(system)
    if (preset) parts.push(`Preset: ${preset}`)
    if (characterName) parts.push(`Character name: ${characterName}`)
    if (persona) parts.push(`Persona: ${persona}`)
    if (character) parts.push(`Character data: ${character}`)
    return parts.length > 0 ? parts.join('\n') : ''
}

function hasDeclaredCharacterInputs(config: DifyRuntimeAppConfig) {
    return (config.parameters?.inputControls ?? []).some((control) =>
        /(^|_)character($|_)|persona|preset|system/i.test(control.variable)
    )
}

function firstDefined<T>(...values: T[]) {
    return values.find((value) => value !== undefined && value !== null)
}

function resolveChatLunaCharacter(variables: Record<string, any>) {
    return firstDefined(
        variables.character,
        variables.character_card,
        variables.characterCard,
        variables.characterData,
        variables.character_data,
        variables.persona,
        variables.role,
        variables.built?.character,
        variables.built?.characterCard,
        variables.built?.characterData,
        variables.built?.persona
    )
}

function promptPartsFromMessages(messages: BaseMessage[] = []) {
    const system: string[] = []
    for (const message of messages) {
        if (message.getType() !== 'system') continue
        const content = extractTextFromMessageContent(message.content)
        if (content) system.push(content)
    }
    return {
        system: system.join('\n\n')
    }
}

function resolveDifyControlValue(
    control: DifyInputControl,
    variables: Record<string, unknown>,
    query: string | undefined,
    inputs: Record<string, unknown>
) {
    if (variables[control.variable] !== undefined) {
        return variables[control.variable]
    }
    if (inputs[`chatluna_${control.variable}`] !== undefined) {
        return inputs[`chatluna_${control.variable}`]
    }
    if (control.variable === 'query' || control.variable === 'input') {
        return query
    }
    if (control.defaultValue !== undefined) return control.defaultValue
    if (!control.required) return undefined
    if (control.type === 'number') return 0
    if (control.type === 'checkbox') return false
    return ''
}

function serializeDifyInputValue(value: unknown) {
    if (value == null || typeof value === 'string') return value
    try {
        return JSON.stringify(value)
    } catch {
        return String(value)
    }
}

function stringifyForPrompt(value: unknown) {
    if (value == null) return ''
    const text = typeof value === 'string' ? value : serializeDifyInputValue(value)
    return String(text ?? '').trim()
}

function withWorkflowFileInputs(
    inputs: Record<string, unknown>,
    files: DifyInputFileObject[],
    config: DifyRuntimeAppConfig
) {
    if (files.length < 1) return inputs
    const result = { ...inputs }
    const fileControls =
        config.parameters?.inputControls.filter((control) =>
            isDifyFileControlType(control.type)
        ) ?? []
    const target = fileControls[0]?.variable
    if (target && result[target] == null) {
        result[target] = files
    }
    return result
}

function buildChatlunaHistory(messages: BaseMessage[] = []) {
    const historyLimit = 130_000
    const history: { role: string; content: string }[] = []
    let totalLength = 0

    for (const message of messages) {
        const content = extractTextFromMessageContent(message.content)
        if (!content) continue

        const entry = {
            role: message.getType(),
            content
        }
        history.push(entry)
        totalLength += entry.content.length

        while (totalLength > historyLimit) {
            if (history.length === 1) {
                entry.content = entry.content.slice(-historyLimit)
                totalLength = entry.content.length
                break
            }

            const removed = history.shift()
            if (!removed) break
            totalLength -= removed.content.length
        }
    }

    return JSON.stringify(history)
}

function extractTextFromMessageContent(content: BaseMessage['content']) {
    if (typeof content === 'string') return content
    if (!content) return undefined

    const parts: string[] = []
    for (const part of content) {
        if (isMessageContentText(part)) parts.push(part.text)
    }
    return parts.length > 0 ? parts.join('') : undefined
}

async function prepareDifyFiles(
    requester: ModelHubRequester,
    params: any,
    lastMessage: BaseMessage | undefined,
    config: DifyRuntimeAppConfig,
    difyUser: string
): Promise<{
    files: DifyInputFileObject[]
    chatlunaMultimodal?: string
}> {
    const candidates = extractUploadCandidates(lastMessage)
    const chatlunaMultimodal = safeSerializeMultimodal(lastMessage, candidates)

    if (!config.enableFileUpload || candidates.length === 0) {
        return { files: [], chatlunaMultimodal }
    }

    const files: DifyInputFileObject[] = []
    const maxCount = config.parameters?.fileHandling?.maxFileCount
    const selected =
        maxCount != null && maxCount > 0
            ? candidates.slice(0, maxCount)
            : candidates

    if (selected.length < candidates.length) {
        requester.logger.warn(
            `Dify upload truncated to ${selected.length} files for ${config.modelName}.`
        )
    }

    for (const candidate of selected) {
        const file = await multimodalToDifyFile(
            requester,
            candidate,
            difyUser,
            config,
            params.signal
        )
        if (file) files.push(file)
    }

    return { files, chatlunaMultimodal }
}

function extractUploadCandidates(lastMessage?: BaseMessage) {
    if (!lastMessage) return []

    const candidates: DifyUploadCandidate[] = []
    const seen = new Set<string>()
    const add = (
        source: DifyUploadCandidate['source'],
        type: DifyFileType
    ) => {
        const key = typeof source === 'string' ? `${type}:${source}` : undefined
        if (key && seen.has(key)) return
        if (key) seen.add(key)
        candidates.push({ source, type })
    }

    const content = lastMessage.content as MessageContent
    if (Array.isArray(content)) {
        for (const part of content) {
            if (isMessageContentImageUrl(part)) {
                const imageUrl = part.image_url
                const url =
                    typeof imageUrl === 'string' ? imageUrl : imageUrl?.url
                if (url) add(url, 'image')
            } else if (isFileLikePart(part)) {
                const filePart = part as any
                const url =
                    filePart.file_url?.url ??
                    filePart.audio_url?.url ??
                    filePart.video_url?.url
                const type = fileTypeFromPart(part.type)
                if (url) add(url, type)
            }
        }
    }

    return candidates
}

function isFileLikePart(part: any) {
    return (
        part != null &&
        typeof part === 'object' &&
        ['file_url', 'audio_url', 'video_url'].includes(part.type)
    )
}

function fileTypeFromPart(type: string): DifyFileType {
    if (type === 'audio_url') return 'audio'
    if (type === 'video_url') return 'video'
    return 'document'
}

async function multimodalToDifyFile(
    requester: ModelHubRequester,
    candidate: DifyUploadCandidate,
    difyUser: string,
    config: DifyRuntimeAppConfig,
    signal?: AbortSignal
) {
    const remote = candidateToRemoteDifyFile(candidate, config)
    if (remote) return remote

    if (!isDifyLocalFileTransferAllowed(config)) {
        requester.logger.warn(
            `Dify upload skipped local_file because ${config.modelName} does not allow local_file transfer.`
        )
        return null
    }

    const payload = await resolveFilePayload(requester, candidate, signal)
    if (!payload) return null
    if (!isDifyPayloadAllowed(requester, payload, candidate, config)) return null

    const uploadFileId = await uploadFileToDify(
        requester,
        payload,
        difyUser,
        config,
        signal
    )
    if (!uploadFileId) return null

    return {
        type: resolveDifyPayloadType(payload.mimeType, candidate.type),
        transfer_method: 'local_file',
        upload_file_id: uploadFileId
    } satisfies DifyUploadedFileObject
}

function candidateToRemoteDifyFile(
    candidate: DifyUploadCandidate,
    config: DifyRuntimeAppConfig
): DifyInputFileObject | null {
    if (typeof candidate.source !== 'string') return null
    if (
        !candidate.source.startsWith('http://') &&
        !candidate.source.startsWith('https://')
    ) {
        return null
    }

    const methods = config.parameters?.fileHandling?.allowedTransferMethods
    if (methods != null && !methods.includes('remote_url')) return null

    return {
        type: candidate.type,
        transfer_method: 'remote_url',
        url: candidate.source
    }
}

function isDifyLocalFileTransferAllowed(config: DifyRuntimeAppConfig) {
    const methods = config.parameters?.fileHandling?.allowedTransferMethods
    return methods == null || methods.includes('local_file')
}

function isDifyPayloadAllowed(
    requester: ModelHubRequester,
    payload: DifyFilePayload,
    candidate: DifyUploadCandidate,
    config: DifyRuntimeAppConfig
) {
    const limits = config.parameters?.fileHandling
    if (!limits) return true

    const type = resolveDifyPayloadType(payload.mimeType, candidate.type)
    if (
        limits.allowedFileTypes != null &&
        limits.allowedFileTypes.length > 0 &&
        !limits.allowedFileTypes.includes(type)
    ) {
        requester.logger.warn(
            `Dify upload skipped unsupported ${type} file for ${config.modelName}.`
        )
        return false
    }

    const mimeType = payload.mimeType
    if (
        mimeType &&
        limits.supportedMimeTypes.length > 0 &&
        !limits.supportedMimeTypes.includes(mimeType)
    ) {
        requester.logger.warn(
            `Dify upload skipped unsupported mime type ${mimeType} for ${config.modelName}.`
        )
        return false
    }

    const maxFileSize =
        (mimeType ? limits.maxFileSizeBytesOverrides?.[mimeType] : undefined) ??
        limits.maxFileSizeBytes
    if (payload.buffer.byteLength > maxFileSize) {
        requester.logger.warn(
            `Dify upload skipped oversized file ${payload.fileName} for ${config.modelName}.`
        )
        return false
    }

    return true
}

function resolveDifyPayloadType(
    mimeType: string | undefined,
    fallback: DifyFileType
): DifyFileType {
    return mapMimeToFileType(mimeType) ?? fallback
}

async function resolveFilePayload(
    requester: ModelHubRequester,
    candidate: DifyUploadCandidate,
    signal?: AbortSignal
): Promise<DifyFilePayload | null> {
    const { source, fileName, mimeType } = candidate

    if (typeof source === 'string') {
        const dataUrlPayload = tryParseDataUrl(source, fileName, mimeType)
        if (dataUrlPayload) return dataUrlPayload

        if (source.startsWith('http://') || source.startsWith('https://')) {
            return fetchRemoteFile(requester, source, fileName, mimeType, signal)
        }

        return readLocalFile(requester, source, fileName, mimeType)
    }

    const buffer = convertToBuffer(source)
    if (!buffer) return null

    return {
        buffer,
        fileName: fileName ?? buildFallbackFileName(mimeType),
        mimeType
    }
}

function tryParseDataUrl(
    source: string,
    preferredName?: string,
    preferredMime?: string
): DifyFilePayload | null {
    const match = source.match(/^data:([^;]+);base64,(.+)$/)
    if (!match) return null

    const mimeType = preferredMime ?? match[1]
    return {
        buffer: Buffer.from(match[2], 'base64'),
        fileName: preferredName ?? buildFallbackFileName(mimeType),
        mimeType
    }
}

async function readLocalFile(
    requester: ModelHubRequester,
    source: string,
    preferredName?: string,
    preferredMime?: string
): Promise<DifyFilePayload | null> {
    try {
        const filePath = source.startsWith('file://')
            ? fileURLToPath(source)
            : source

        if (!fs.existsSync(filePath)) return null

        const buffer = await readFile(filePath)
        const mimeType = preferredMime ?? guessMimeTypeFromPath(filePath)
        const rawName = path.basename(filePath)
        return {
            buffer,
            fileName:
                preferredName ||
                (rawName.length > 0
                    ? rawName
                    : buildFallbackFileName(mimeType)),
            mimeType
        }
    } catch (error) {
        requester.logger.warn(error)
        return null
    }
}

async function fetchRemoteFile(
    requester: ModelHubRequester,
    source: string,
    preferredName?: string,
    preferredMime?: string,
    signal?: AbortSignal
): Promise<DifyFilePayload | null> {
    try {
        const response = await requester.requestContext().plugin.fetch(source, {
            method: 'GET',
            signal
        })
        if (!response.ok) return null

        const contentType = response.headers
            .get('content-type')
            ?.split(';')?.[0]
        const fileName = preferredName ?? fileNameFromUrl(source, contentType)

        return {
            buffer: Buffer.from(await response.arrayBuffer()),
            fileName,
            mimeType: preferredMime ?? contentType
        }
    } catch (error) {
        requester.logger.warn(error)
        return null
    }
}

async function uploadFileToDify(
    requester: ModelHubRequester,
    file: DifyFilePayload,
    difyUser: string,
    config: DifyRuntimeAppConfig,
    signal?: AbortSignal
) {
    const formData = new FormData()
    const mimeType = file.mimeType ?? 'application/octet-stream'
    formData.set(
        'file',
        new Blob([new Uint8Array(file.buffer)], { type: mimeType }),
        file.fileName
    )
    formData.set('user', difyUser)

    const response = await requester.requestContext().plugin.fetch(
        concatDifyUrl(config.apiEndpoint, '/files/upload'),
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${config.apiKey}`
            },
            body: formData,
            signal
        }
    )

    if (!response.ok) {
        requester.logger.warn(
            `Failed to upload file to Dify: ${response.status} ${response.statusText}`
        )
        return null
    }

    const result = await response.json().catch(async () => response.text())
    return typeof result === 'object' && result != null
        ? ((result as { data?: { id?: string }; id?: string }).data?.id ??
              (result as { id?: string }).id)
        : undefined
}

function postDify(
    requester: ModelHubRequester,
    config: DifyRuntimeAppConfig,
    path: string,
    body: Record<string, unknown>,
    signal?: AbortSignal
) {
    return requester.requestContext().plugin.fetch(
        concatDifyUrl(config.apiEndpoint, path),
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${config.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(stripUndefined(body)),
            signal
        }
    )
}

function concatDifyUrl(endpoint: string, path: string) {
    const base = endpoint.replace(/\/+$/, '')
    const next = path.startsWith('/') ? path : `/${path}`
    return `${base}${next}`
}

async function getDifyConversationId(
    requester: ModelHubRequester,
    conversationId: string,
    config: DifyRuntimeAppConfig
) {
    const cached = await requester.koishiContext().chatluna.cache.get(
        'chatluna/keys',
        difyCacheKey(conversationId, config)
    )
    if (cached == null) return undefined

    try {
        return (JSON.parse(cached) as { id?: string }).id
    } catch {
        return cached
    }
}

async function updateDifyConversationId(
    requester: ModelHubRequester,
    conversationId: string,
    config: DifyRuntimeAppConfig,
    difyConversationId: string,
    user: string
) {
    await requester.koishiContext().chatluna.cache.set(
        'chatluna/keys',
        difyCacheKey(conversationId, config),
        JSON.stringify({
            id: difyConversationId,
            user
        })
    )
}

async function disposeDifyConversation(
    requester: ModelHubRequester,
    model?: string,
    id?: string
) {
    if (!model || !id) return

    const config = resolveDifyApp(requester, model)
    if (config.appType === 'workflow' || config.appType === 'completion') {
        return
    }

    const key = difyCacheKey(id, config)
    const cached = await requester
        .koishiContext()
        .chatluna.cache.get('chatluna/keys', key)
    const difyConversationId = await getDifyConversationId(requester, id, config)
    if (!difyConversationId) return

    let user = 'chatluna'
    if (cached != null) {
        try {
            user = (JSON.parse(cached) as { user?: string }).user ?? user
        } catch {}
    }

    const response = await requester.requestContext().plugin.fetch(
        concatDifyUrl(config.apiEndpoint, `/conversations/${difyConversationId}`),
        {
            method: 'DELETE',
            headers: {
                Authorization: `Bearer ${config.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ user })
        }
    )

    if (response.ok) {
        await requester
            .koishiContext()
            .chatluna.cache.delete('chatluna/keys', key)
    } else {
        requester.logger.warn(`Dify clear failed: ${await response.text()}`)
    }
}

function difyCacheKey(conversationId: string, config: DifyRuntimeAppConfig) {
    return `dify/${conversationId}/${config.platform}/${config.modelName}`
}

function safeSerializeMultimodal(
    lastMessage?: BaseMessage,
    candidates: DifyUploadCandidate[] = []
) {
    if (!lastMessage) return undefined
    try {
        return JSON.stringify({
            has_files: candidates.length > 0,
            file_count: candidates.length,
            files: candidates.slice(0, 5).map((item, index) => ({
                idx: index,
                type: item.type,
                source:
                    typeof item.source === 'string'
                        ? item.source.slice(0, 64)
                        : undefined
            }))
        }).slice(0, 256)
    } catch {
        return undefined
    }
}

function stripUndefined<T extends Record<string, unknown>>(value: T): T {
    for (const key of Object.keys(value)) {
        if (value[key] === undefined) delete value[key]
        if (
            value[key] != null &&
            typeof value[key] === 'object' &&
            !Array.isArray(value[key])
        ) {
            stripUndefined(value[key] as Record<string, unknown>)
        }
    }
    return value
}

function filterEmpty<T extends Record<string, unknown>>(value: T): T {
    return Object.fromEntries(
        Object.entries(value).filter(([, item]) => item !== undefined)
    ) as T
}

function convertToBuffer(source: ArrayBuffer | Uint8Array | Buffer) {
    if (source instanceof Buffer) return source
    if (source instanceof ArrayBuffer) return Buffer.from(source)
    if (ArrayBuffer.isView(source)) {
        return Buffer.from(source.buffer, source.byteOffset, source.byteLength)
    }
    return null
}

function mapMimeToFileType(mimeType?: string): DifyFileType | undefined {
    if (!mimeType) return undefined
    if (mimeType.startsWith('image/')) return 'image'
    if (mimeType.startsWith('audio/')) return 'audio'
    if (mimeType.startsWith('video/')) return 'video'
    if (
        mimeType.startsWith('text/') ||
        mimeType === 'application/pdf' ||
        mimeType === 'application/msword' ||
        mimeType ===
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
        return 'document'
    }
    return 'custom'
}

function buildFallbackFileName(mimeType?: string) {
    return `chatluna_file.${guessExtensionFromMime(mimeType)}`
}

function guessMimeTypeFromPath(filePath: string) {
    const extension = path.extname(filePath).replace(/^\./, '').toLowerCase()
    const mapping: Record<string, string> = {
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        gif: 'image/gif',
        webp: 'image/webp',
        bmp: 'image/bmp',
        svg: 'image/svg+xml',
        pdf: 'application/pdf',
        txt: 'text/plain',
        md: 'text/markdown',
        csv: 'text/csv',
        doc: 'application/msword',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        xls: 'application/vnd.ms-excel',
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ppt: 'application/vnd.ms-powerpoint',
        pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        mp3: 'audio/mpeg',
        m4a: 'audio/mp4',
        wav: 'audio/wav',
        ogg: 'audio/ogg',
        webm: 'video/webm',
        mp4: 'video/mp4',
        mov: 'video/quicktime'
    }
    return mapping[extension] ?? 'application/octet-stream'
}

function guessExtensionFromMime(mimeType?: string) {
    if (!mimeType) return 'bin'
    if (mimeType === 'image/jpeg') return 'jpg'
    const [, subtype] = mimeType.split('/')
    return subtype?.replace(/[^a-z0-9]+/gi, '') || 'bin'
}

function fileNameFromUrl(source: string, mimeType?: string) {
    try {
        const parsed = new URL(source)
        const name = parsed.pathname.split('/').filter(Boolean).pop()
        return name || buildFallbackFileName(mimeType)
    } catch {
        return buildFallbackFileName(mimeType)
    }
}
