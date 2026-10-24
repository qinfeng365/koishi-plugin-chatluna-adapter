<template>
    <section class="sources-editor" aria-label="连接源管理">
        <header>
            <div>
                <h3>连接源与密钥</h3>
                <p>
                    源间默认主备，源内 Key
                    轮询。新增源不会自动接管其他源的同名模型。
                </p>
            </div>
            <el-button @click="addSource">添加连接源</el-button>
        </header>
        <details
            v-for="(source, index) in provider.sources"
            :key="source.id"
            class="source-card"
            :open="provider.sources.length === 1"
        >
            <summary>
                <span class="source-title"
                    >{{ source.name }}
                    <small>{{ preset(source.provider)?.name }}</small></span
                ><span class="source-meta"
                    >{{ source.apiEndpoint }} ·
                    {{
                        source.credentials.filter(
                            (c) => c.enabled && (c.hasApiKey || c.apiKey)
                        ).length
                    }}/{{ source.credentials.length }} Key</span
                ><span>{{
                    source.enabled ? summary(source.id) : '已停用'
                }}</span>
            </summary>
            <div class="source-body">
                <div class="actions">
                    <el-switch
                        v-model="source.enabled"
                        active-text="启用连接"
                    /><el-button
                        :disabled="dirty"
                        @click="$emit('refresh', source.id)"
                        >刷新此源目录</el-button
                    ><el-button :disabled="index === 0" @click="move(index, -1)"
                        >上移</el-button
                    ><el-button
                        :disabled="index === provider.sources.length - 1"
                        @click="move(index, 1)"
                        >下移</el-button
                    ><el-button type="danger" @click="removeSource(index)"
                        >删除连接</el-button
                    >
                </div>
                <div class="fields">
                    <label>连接名称<el-input v-model="source.name" /></label>
                    <label
                        >接口模板<el-select
                            v-model="source.provider"
                            filterable
                            @change="changeProtocol(source)"
                            ><el-option
                                v-for="p in presets"
                                :key="p.id"
                                :label="p.name + ' · ' + p.adapter"
                                :value="p.id" /></el-select
                    ></label>
                    <label class="wide"
                        >API 基础地址<el-input v-model="source.apiEndpoint"
                    /></label>
                    <label
                        >优先级（小值优先）<el-input-number
                            v-model="source.priority"
                            :min="0" /></label
                    ><label
                        >源权重（仅负载均衡）<el-input-number
                            v-model="source.weight"
                            :min="1"
                    /></label>
                    <label class="inline"
                        >读取模型目录<el-switch v-model="source.pullModels"
                    /></label>
                </div>
                <div class="key-heading">
                    <h4>API Keys</h4>
                    <el-button
                        size="small"
                        @click="source.credentials.push(newCredential())"
                        >添加 Key</el-button
                    >
                </div>
                <details
                    v-for="(credential, ci) in source.credentials"
                    :key="credential.id"
                    class="key-card"
                    :open="!credential.hasApiKey"
                >
                    <summary>
                        <span>{{ credential.name }}</span
                        ><small>{{
                            credential.apiKeyPreview ||
                            (credential.apiKey
                                ? '新密钥，待保存'
                                : '未配置密钥')
                        }}</small
                        ><span>{{
                            credential.enabled
                                ? keyStatus(source.id, credential.id)
                                : '已停用'
                        }}</span>
                    </summary>
                    <div class="fields key-fields">
                        <label
                            >Key 名称<el-input
                                v-model="credential.name" /></label
                        ><label class="inline"
                            >启用<el-switch v-model="credential.enabled"
                        /></label>
                        <label class="wide"
                            >密钥（空白不会覆盖已保存值）<el-input
                                v-model="credential.apiKey"
                                show-password
                                :placeholder="
                                    credential.hasApiKey
                                        ? '保留已保存密钥；输入新值以替换'
                                        : '输入密钥'
                                "
                                @input="
                                    credential.secretAction = credential.apiKey
                                        ? 'replace'
                                        : credential.hasApiKey
                                          ? 'keep'
                                          : 'clear'
                                "
                        /></label>
                        <label
                            >Organization（可选）<el-input
                                v-model="credential.organization" /></label
                        ><label
                            >Project（可选）<el-input
                                v-model="credential.project"
                        /></label>
                        <label
                            >共享配额组（相同账户填相同值）<el-input
                                v-model="credential.quotaGroup" /></label
                        ><label
                            >Key 并发数<el-input-number
                                v-model="credential.concurrentMaxSize"
                                :min="1"
                                :max="200" /></label
                        ><label
                            >Key / 配额组每小时上限<el-input-number
                                v-model="credential.hourlyLimit"
                                :min="1"
                                :max="1000000"
                        /></label>
                        <div class="actions wide">
                            <el-button
                                v-if="credential.hasApiKey"
                                @click="clearKey(credential)"
                                >清除密钥</el-button
                            ><el-button
                                type="danger"
                                @click="removeKey(source, ci)"
                                >删除 Key</el-button
                            >
                        </div>
                        <p
                            v-if="connection(source.id, credential.id)?.error"
                            class="wide error"
                        >
                            {{ connection(source.id, credential.id)?.error }}
                        </p>
                    </div>
                </details>
                <details class="batch">
                    <summary>批量添加 Key</summary>
                    <p>
                        每行一个
                        Key；仅显示数量预览，不回显密钥。保存后由后端生成身份。
                    </p>
                    <el-input
                        v-model="batches[source.id]"
                        type="textarea"
                        :rows="3"
                        placeholder="每行一个 API Key"
                    />
                    <div class="actions">
                        <span
                            >{{ batchKeys(source.id).length }} 个不重复
                            Key</span
                        ><el-button
                            :disabled="!batchKeys(source.id).length"
                            @click="addBatch(source)"
                            >确认添加</el-button
                        >
                    </div>
                </details>
                <details class="overrides">
                    <summary>
                        此源设置覆盖
                        <small>留空继承平台；恢复继承会删除覆盖值</small>
                    </summary>
                    <div class="fields">
                        <label class="wide"
                            >固定远端资源绑定 Key（显式缓存、Vector Store
                            等）<el-select
                                v-model="source.resourceCredentialId"
                                clearable
                                @change="
                                    source.resourceCredentialGeneration =
                                        source.credentials.find(
                                            (c) =>
                                                c.id ===
                                                source.resourceCredentialId
                                        )?.generation
                                "
                                ><el-option
                                    v-for="key in source.credentials"
                                    :key="key.id"
                                    :label="key.name"
                                    :value="key.id" /></el-select
                            ><small
                                >未选时，首次保存固定资源默认绑定第一个 Key。Key
                                换值后旧资源不会自动继承。</small
                            ></label
                        >
                        <el-button
                            v-if="source.resourceCredentialId"
                            @click="rebindResource(source)"
                            >确认资源归属并重新绑定当前代次</el-button
                        >
                    </div>
                    <div class="fields">
                        <label
                            v-for="field in fieldsFor(source)"
                            :key="field.key"
                            :class="{ wide: field.kind === 'json' }"
                        >
                            <span
                                >{{ field.label }}
                                <button
                                    v-if="
                                        source.settings[field.key] !==
                                            undefined ||
                                        jsonInputs[fieldId(source, field)] !==
                                            undefined
                                    "
                                    type="button"
                                    class="reset"
                                    @click="resetField(source, field)"
                                >
                                    恢复继承
                                </button></span
                            >
                            <el-switch
                                v-if="field.kind === 'boolean'"
                                :model-value="!!effective(source, field.key)"
                                @update:model-value="
                                    source.settings[field.key] = $event
                                "
                            />
                            <el-select
                                v-else-if="field.options"
                                :model-value="effective(source, field.key)"
                                @update:model-value="
                                    source.settings[field.key] = $event
                                "
                                ><el-option
                                    v-for="option in field.options"
                                    :key="option"
                                    :label="option"
                                    :value="option"
                            /></el-select>
                            <el-input-number
                                v-else-if="field.kind === 'number'"
                                :model-value="effective(source, field.key)"
                                :min="field.min ?? 0"
                                @update:model-value="
                                    source.settings[field.key] = $event
                                "
                            />
                            <el-input
                                v-else
                                :model-value="
                                    jsonInputs[fieldId(source, field)] ??
                                    display(
                                        effective(source, field.key),
                                        field.kind
                                    )
                                "
                                :type="
                                    field.kind === 'json' ? 'textarea' : 'text'
                                "
                                :rows="3"
                                @update:model-value="
                                    setField(source, field, $event)
                                "
                            />
                            <small
                                v-if="jsonErrors[fieldId(source, field)]"
                                role="alert"
                                class="error"
                                >{{ jsonErrors[fieldId(source, field)] }}</small
                            >
                            <small>{{
                                source.settings[field.key] === undefined
                                    ? '继承平台默认值'
                                    : '已覆盖'
                            }}</small>
                        </label>
                    </div>
                    <div class="key-heading">
                        <h4>此源请求头</h4>
                        <el-button size="small" @click="addHeader(source)"
                            >添加 / 覆盖</el-button
                        ><el-button
                            v-if="source.settings.customHeaders"
                            size="small"
                            @click="delete source.settings.customHeaders"
                            >恢复继承</el-button
                        >
                    </div>
                    <div
                        v-for="(header, hi) in source.settings.customHeaders"
                        :key="hi"
                        class="header-fields"
                    >
                        <el-input
                            v-model="header.name"
                            placeholder="Header 名称"
                        /><el-input
                            v-model="header.value"
                            show-password
                            :placeholder="header.valuePreview || 'Header 值'"
                            @input="header.clearValue = false"
                        /><el-button @click="clearHeader(header)"
                            >清空</el-button
                        ><el-button
                            type="danger"
                            @click="source.settings.customHeaders.splice(hi, 1)"
                            >删除</el-button
                        >
                    </div>
                </details>
            </div>
        </details>
        <p v-if="!provider.sources?.length">
            暂无连接源，请添加。停用或删除连接不会删除厂商侧资源。
        </p>
        <p v-if="error" role="alert" class="error">{{ error }}</p>
    </section>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type {
    ConnectionStatus,
    ConsoleProviderEntry,
    ConsoleSourceConnection,
    ConsoleSourceCredential,
    ModelHubConsolePreset
} from 'koishi-plugin-chatluna-model-hub-adapter'
import { newCredential, newSource } from './connection-form'
const props = defineProps<{
    provider: ConsoleProviderEntry
    presets: ModelHubConsolePreset[]
    statuses?: ConnectionStatus[]
    dirty: boolean
}>()
const emit = defineEmits<{
    refresh: [sourceId: string]
    validation: [valid: boolean]
}>()
const batches = ref<Record<string, string>>({})
const error = ref('')
const jsonInputs = ref<Record<string, string>>({})
const jsonErrors = ref<Record<string, string>>({})
watch(
    () => Object.keys(jsonErrors.value).length,
    (count) => emit('validation', count === 0),
    { immediate: true }
)
function clearJson(sourceId: string) {
    for (const key of Object.keys(jsonInputs.value))
        if (key.startsWith(`${sourceId}/`)) {
            delete jsonInputs.value[key]
            delete jsonErrors.value[key]
        }
}
const preset = (id: string) => props.presets.find((p) => p.id === id)
const connection = (sid: string, cid: string) =>
    props.statuses?.find((s) => s.sourceId === sid && s.credentialId === cid)
const states = {
    ready: '可用',
    stale: '目录陈旧',
    error: '异常',
    cooldown: '冷却中',
    disabled: '停用'
}
const keyStatus = (sid: string, cid: string) =>
    states[connection(sid, cid)?.state] || '待保存 / 刷新'
function summary(id: string) {
    const all = props.statuses?.filter((s) => s.sourceId === id) ?? []
    const ready = all.filter(
        (s) => s.state === 'ready' || s.state === 'stale'
    ).length
    return all.length
        ? ready === all.length
            ? '可用'
            : ready
              ? '部分可用'
              : '不可用'
        : '待保存 / 刷新'
}
function addSource() {
    ;(props.provider.sources ??= []).push(newSource(props.provider))
}
function move(index: number, delta: number) {
    const list = props.provider.sources
    list.splice(index + delta, 0, ...list.splice(index, 1))
    list.forEach((s, i) => {
        s.priority = i
    })
}
function removeSource(index: number) {
    const source = props.provider.sources[index]
    const affected =
        props.provider.routes
            ?.filter((r) => r.candidates.some((c) => c.sourceId === source.id))
            .map((r) => r.model) ?? []
    if (affected.length) {
        error.value = `请先移除以下路由对该源的引用：${affected.join('、')}`
        return
    }
    if (
        !window.confirm(
            '删除此连接源？绑定此源的缓存、文件和会话可能不可用；不会删除远端资源。'
        )
    )
        return
    props.provider.sources.splice(index, 1)
    clearJson(source.id)
}
function removeKey(source: ConsoleSourceConnection, index: number) {
    const credential = source.credentials[index]
    if (
        props.provider.routes?.some((r) =>
            r.candidates.some((c) => c.credentialIds?.includes(credential.id))
        )
    ) {
        error.value = '请先移除路由对该 Key 的引用'
        return
    }
    if (
        window.confirm(
            '删除此 Key？已有资源绑定可能不可用，厂商侧资源不会被删除。'
        )
    )
        source.credentials.splice(index, 1)
}
function clearKey(credential: ConsoleSourceCredential) {
    if (!window.confirm('清除密钥后，已有会话的资源绑定可能不可用。继续？'))
        return
    credential.apiKey = ''
    credential.hasApiKey = false
    credential.apiKeyPreview = ''
    credential.secretAction = 'clear'
}
function clearHeader(header: ConsoleProviderEntry['customHeaders'][number]) {
    header.value = ''
    header.clearValue = true
    header.hasValue = false
}
const batchKeys = (id: string) => [
    ...new Set(
        (batches.value[id] ?? '')
            .split(/\r?\n/)
            .map((v) => v.trim())
            .filter(Boolean)
    )
]
function addBatch(source: ConsoleSourceConnection) {
    const values = batchKeys(source.id)
    const existing = new Set(
        source.credentials.map((c) => c.apiKey).filter(Boolean)
    )
    values
        .filter((key) => !existing.has(key))
        .forEach((key) => {
            source.credentials.push({
                ...newCredential(),
                name: `Key ${source.credentials.length + 1}`,
                apiKey: key,
                secretAction: 'replace'
            })
        })
    batches.value[source.id] = ''
}
function changeProtocol(source: ConsoleSourceConnection) {
    source.apiEndpoint =
        preset(source.provider)?.defaultEndpoint ?? source.apiEndpoint
    source.settings = {}
    clearJson(source.id)
}
function addHeader(source: ConsoleSourceConnection) {
    source.settings.customHeaders ??= JSON.parse(
        JSON.stringify(props.provider.customHeaders)
    )
    source.settings.customHeaders.push({
        target: '*',
        name: '',
        value: '',
        valuePreview: '',
        hasValue: false,
        clearValue: false
    })
}
function rebindResource(source: ConsoleSourceConnection) {
    if (
        window.confirm(
            '只有确认当前 Key 确实拥有这些远端资源时才能重新绑定。继续？'
        )
    )
        source.resourceCredentialGeneration = source.credentials.find(
            (c) => c.id === source.resourceCredentialId
        )?.generation
}
type Field = {
    key: string
    label: string
    kind?: 'boolean' | 'number' | 'json' | 'list'
    options?: string[]
    min?: number
}
const common: Field[] = [
    { key: 'proxyMode', label: '代理模式', options: ['system', 'off', 'on'] },
    { key: 'proxyAddress', label: '代理地址' },
    { key: 'timeout', label: '请求超时（毫秒）', kind: 'number', min: 1000 },
    { key: 'chatConcurrentMaxSize', label: '源并发数', kind: 'number', min: 1 },
    { key: 'chatTimeLimit', label: '源每小时上限', kind: 'number', min: 1 },
    { key: 'nonStreaming', label: '强制非流式', kind: 'boolean' },
    { key: 'expandReasoningVariants', label: '展开推理等级', kind: 'boolean' },
    {
        key: 'reasoningProtocol',
        label: '思考协议',
        options: [
            'openai',
            'auto',
            'deepseek',
            'qwen',
            'gemini',
            'anthropic',
            'openrouter'
        ]
    }
]
const native: Record<string, Field[]> = {
    openai: [
        { key: 'responseApi', label: 'Responses API', kind: 'boolean' },
        {
            key: 'responseBuiltinTools',
            label: '原生工具（逗号分隔）',
            kind: 'list'
        },
        {
            key: 'responseBuiltinToolSupportModel',
            label: '原生工具支持模型',
            kind: 'list'
        },
        {
            key: 'responseFileSearchVectorStoreIds',
            label: 'Vector Store IDs',
            kind: 'list'
        }
    ],
    gemini: [
        {
            key: 'geminiApi',
            label: 'Gemini API',
            options: ['generateContent', 'interactions']
        },
        ...[
            'geminiFileUpload',
            'googleSearch',
            'codeExecution',
            'urlContext',
            'imageGeneration',
            'agenticVideo',
            'useCamelCaseMediaFields',
            'includeThoughts',
            'groundingContentDisplay'
        ].map((key) => ({ key, label: key, kind: 'boolean' as const })),
        {
            key: 'geminiMaxFileSizeMb',
            label: '上传文件上限 MB',
            kind: 'number',
            min: 1
        },
        {
            key: 'thinkingBudget',
            label: 'Thinking Budget',
            kind: 'number',
            min: -1
        },
        { key: 'geminiCachedContent', label: 'Cached Content ID' },
        { key: 'geminiResponseMimeType', label: '响应 MIME' },
        {
            key: 'geminiResponseJsonSchema',
            label: '响应 JSON Schema',
            kind: 'json'
        }
    ],
    anthropic: [
        { key: 'anthropicPromptCache', label: 'Prompt Cache', kind: 'boolean' },
        {
            key: 'anthropicPromptCacheTtl',
            label: 'Cache TTL',
            options: ['5m', '1h']
        }
    ],
    dify: [
        {
            key: 'difyAppType',
            label: '应用类型',
            options: ['chat', 'agent', 'workflow', 'completion']
        },
        { key: 'difyModelName', label: '应用模型名' },
        { key: 'difyWorkflowId', label: 'Workflow ID' },
        { key: 'difyOutputVariable', label: '输出变量' },
        { key: 'difyEnableFileUpload', label: '上传文件', kind: 'boolean' },
        { key: 'difyContextSize', label: '上下文上限', kind: 'number', min: 1 }
    ]
}
const cache: Field[] = [
    {
        key: 'promptCacheMode',
        label: '缓存模式',
        options: ['default', 'implicit', 'explicit']
    },
    { key: 'promptCacheTtl', label: '缓存 TTL', options: ['5m', '30m', '1h'] },
    {
        key: 'promptCacheRetention',
        label: '缓存保留',
        options: ['in-memory', '24h']
    },
    { key: 'promptCacheKey', label: 'Prompt Cache Key' }
]
function fieldsFor(source: ConsoleSourceConnection) {
    const adapter = preset(source.provider)?.adapter ?? 'openai-chat'
    return [
        ...common,
        ...(native[adapter] ?? []),
        ...(['openai-chat', 'openai'].includes(adapter) ? cache : [])
    ]
}
const effective = (source: ConsoleSourceConnection, key: string) =>
    source.settings[key] ?? props.provider[key]
const display = (value: unknown, kind: string) =>
    kind === 'json'
        ? value
            ? JSON.stringify(value, null, 2)
            : ''
        : Array.isArray(value)
          ? value.join(', ')
          : String(value ?? '')
const fieldId = (source: ConsoleSourceConnection, field: Field) =>
    `${source.id}/${field.key}`
function resetField(source: ConsoleSourceConnection, field: Field) {
    delete source.settings[field.key]
    delete jsonInputs.value[fieldId(source, field)]
    delete jsonErrors.value[fieldId(source, field)]
}
function setField(
    source: ConsoleSourceConnection,
    field: Field,
    input: string
) {
    const id = fieldId(source, field)
    if (field.kind === 'json') jsonInputs.value[id] = input
    try {
        source.settings[field.key] =
            field.kind === 'json'
                ? input.trim()
                    ? JSON.parse(input)
                    : undefined
                : field.kind === 'list'
                  ? input
                        .split(',')
                        .map((v) => v.trim())
                        .filter(Boolean)
                  : input
        delete jsonErrors.value[id]
    } catch {
        jsonErrors.value[id] = `${field.label} JSON 无效，请修正后保存`
    }
}
</script>

<style scoped>
.sources-editor {
    display: grid;
    gap: 12px;
    color: var(--k-text-dark);
}
header,
.actions,
.key-heading {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
}
header,
.key-heading {
    justify-content: space-between;
}
h3,
h4,
p {
    margin: 0;
}
p,
small {
    color: var(--k-text-light);
    font-size: 0.8rem;
    line-height: 1.6;
}
.source-card,
.key-card {
    border: 1px solid var(--k-card-border);
    border-radius: 8px;
    min-width: 0;
    background: transparent;
}
summary {
    cursor: pointer;
    padding: 12px;
    overflow-wrap: anywhere;
}
.source-card > summary,
.key-card > summary {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
}
.source-title {
    font-weight: 600;
}
.source-meta {
    flex: 1;
    min-width: 120px;
    color: var(--k-text-light);
    font-size: 0.8rem;
}
.source-body {
    display: grid;
    gap: 12px;
    padding: 0 12px 12px;
}
.fields {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
}
label {
    display: grid;
    gap: 6px;
    font-size: 0.8rem;
    min-width: 0;
}
.wide {
    grid-column: 1 / -1;
}
.inline {
    display: flex;
    align-items: center;
    justify-content: space-between;
}
.key-fields {
    padding: 0 12px 12px;
}
.key-heading {
    margin-top: 4px;
}
.reset {
    background: transparent;
    border: 0;
    color: var(--k-color-primary);
    cursor: pointer;
    font-size: 0.75rem;
}
.header-fields {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 8px 0;
}
.header-fields > .el-input {
    flex: 1;
    min-width: 110px;
}
.batch > :not(summary) {
    margin-bottom: 8px;
}
.error {
    color: var(--el-color-danger);
}
.el-select,
.el-input-number {
    width: 100%;
}
@media (max-width: 600px) {
    .fields {
        grid-template-columns: minmax(0, 1fr);
    }
    .source-body {
        padding: 0 8px 8px;
    }
    .source-meta {
        flex-basis: 100%;
    }
    .actions .el-button {
        margin-left: 0;
    }
}
</style>
