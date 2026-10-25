<template>
    <el-dialog
        :model-value="!!model"
        title="编辑模型能力"
        width="min(640px, calc(100vw - 24px))"
        top="6vh"
        append-to-body
        class="model-hub-capability-dialog"
        :close-on-click-modal="!saving"
        :close-on-press-escape="!saving"
        :show-close="!saving"
        @update:model-value="!$event && !saving && $emit('close')"
    >
        <div v-if="model" class="capability-editor">
            <div class="editor-identity">
                <strong>{{ model.name }}</strong>
                <small>{{ model.provider }} · {{ model.platform }}</small>
            </div>
            <p class="editor-hint">
                覆盖按连接源、Key
                和上游模型单独保存，优先于接口与名称推断；基础模型的覆盖会传递到自动推理变体。不会更改路由或开启跨源回退。
            </p>
            <p v-if="blocked" class="editor-error" role="alert">
                服务商配置有未保存的修改，请先关闭此窗口并保存或重新载入配置。
            </p>
            <label class="connection-picker">
                <span>编辑连接</span>
                <select
                    v-model="selected"
                    :disabled="saving"
                    aria-label="编辑能力的连接"
                >
                    <option
                        v-for="(candidate, index) in candidates"
                        :key="index"
                        :value="index"
                    >
                        {{ candidate.sourceName || candidate.sourceId }} ·
                        {{ candidate.credentialName || 'Key' }} →
                        {{ candidate.upstreamModel }}
                    </option>
                </select>
            </label>
            <p v-if="!candidates.length" class="editor-error" role="alert">
                此模型暂无可编辑的连接，请刷新模型目录。
            </p>
            <template v-if="current">
                <div class="capability-list">
                    <label
                        v-for="capability in options"
                        :key="capability.value"
                        class="capability-control"
                    >
                        <span>
                            <strong>{{ capability.label }}</strong>
                            <small>{{
                                current.capabilities?.includes(capability.value)
                                    ? '当前生效：支持'
                                    : '当前生效：不支持'
                            }}</small>
                        </span>
                        <select
                            :value="stateOf(capability.value)"
                            :aria-label="`${capability.label}能力`"
                            :disabled="saving || blocked"
                            @change="setState(capability.value, $event)"
                        >
                            <option value="auto">自动识别</option>
                            <option value="on">强制启用</option>
                            <option value="off">强制禁用</option>
                        </select>
                    </label>
                </div>
                <p class="editor-hint">
                    这里只修正能力声明，不会让上游获得其不支持的功能。适配协议、候选能力交集与显式路由契约仍然生效；恢复自动识别后，需保存才会生效。
                </p>
            </template>
            <p v-if="error" class="editor-error" role="alert">{{ error }}</p>
        </div>
        <template #footer>
            <div class="editor-actions">
                <el-button
                    :disabled="saving || blocked || !current"
                    @click="drafts[selected] = {}"
                    >当前连接恢复自动</el-button
                >
                <span class="editor-action-spacer"></span>
                <el-button :disabled="saving" @click="$emit('close')"
                    >取消</el-button
                >
                <el-button
                    type="primary"
                    :loading="saving"
                    :disabled="blocked || !changed.length"
                    @click="save"
                    >保存能力</el-button
                >
            </div>
        </template>
    </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { send } from '@koishijs/client'
import type {
    ModelHubActionResult,
    ModelHubConsoleModel,
    ModelCapabilityOverrideEntry
} from 'koishi-plugin-chatluna-model-hub-adapter'
import { ModelCapabilities as Cap } from 'koishi-plugin-chatluna/llm-core/platform/types'

const props = defineProps<{
    model?: ModelHubConsoleModel
    revision: number
    blocked: boolean
}>()
const emit = defineEmits<{
    close: []
    saved: [result: ModelHubActionResult]
}>()
type Overrides = ModelCapabilityOverrideEntry['overrides']
const options = [
    { label: '文本输入', value: Cap.TextInput },
    { label: '工具调用', value: Cap.ToolCall },
    { label: '图片输入', value: Cap.ImageInput },
    { label: '思考 / 推理', value: Cap.Thinking },
    { label: '图片生成', value: Cap.ImageGeneration },
    { label: '音频输入', value: Cap.AudioInput },
    { label: '视频输入', value: Cap.VideoInput },
    { label: '文件输入', value: Cap.FileInput }
]
const selected = ref(0)
const drafts = ref<Overrides[]>([])
const originals = ref<Overrides[]>([])
const saving = ref(false)
const error = ref('')
let revision = 0
const candidates = computed(() =>
    (props.model?.candidates ?? []).filter((c) => c.sourceProviderId)
)
const current = computed(() => candidates.value[selected.value])
watch(
    () => props.model,
    () => {
        selected.value = 0
        error.value = ''
        revision = props.revision
        originals.value = candidates.value.map((c) => ({
            ...c.capabilityOverrides
        }))
        drafts.value = originals.value.map((o) => ({ ...o }))
    },
    { immediate: true }
)
const changed = computed(() =>
    candidates.value.flatMap((candidate, index) =>
        Object.values(Cap).some(
            (capability) =>
                drafts.value[index]?.[capability] !==
                originals.value[index]?.[capability]
        )
            ? [{ ...candidate, overrides: { ...drafts.value[index] } }]
            : []
    )
)
function stateOf(capability: Cap) {
    const value = drafts.value[selected.value]?.[capability]
    return value == null ? 'auto' : value ? 'on' : 'off'
}
function setState(capability: Cap, event: Event) {
    const value = (event.target as HTMLSelectElement).value
    if (value === 'auto') delete drafts.value[selected.value][capability]
    else drafts.value[selected.value][capability] = value === 'on'
}
async function save() {
    if (!props.model || props.blocked || saving.value || !changed.value.length)
        return
    saving.value = true
    error.value = ''
    try {
        const result = await send(
            'chatluna-model-hub/updateModelCapabilities',
            {
                revision,
                providerId: props.model.providerId ?? props.model.provider,
                platform: props.model.platform,
                model: props.model.name,
                updates: changed.value.map((c) => ({
                    sourceId: c.sourceId,
                    sourceProviderId: c.sourceProviderId!,
                    credentialId: c.credentialId,
                    upstreamModel: c.upstreamModel,
                    overrides: c.overrides
                }))
            }
        )
        emit('saved', result)
        emit('close')
    } catch (cause) {
        error.value = `保存失败：${String(cause)}`
    } finally {
        saving.value = false
    }
}
</script>

<style scoped>
:global(.model-hub-capability-dialog) {
    --el-dialog-bg-color: var(--k-card-bg);
    --el-text-color-primary: var(--k-text-dark);
    --el-text-color-regular: var(--k-text-dark);
    --el-text-color-secondary: var(--k-text-light);
    --el-fill-color-blank: var(--k-card-bg);
    --el-border-color: var(--k-card-border);
    --el-fill-color-light: color-mix(
        in srgb,
        var(--k-color-primary) 8%,
        var(--k-card-bg)
    );
}
:global(html.dark .model-hub-capability-dialog) {
    color-scheme: dark;
}
.capability-editor {
    display: grid;
    gap: 16px;
    color: var(--k-text-dark);
    max-height: 65vh;
    overflow-y: auto;
}
.editor-identity {
    display: grid;
    gap: 4px;
    overflow-wrap: anywhere;
}
small,
.editor-hint {
    color: var(--k-text-light);
}
.editor-hint {
    margin: 0;
    font-size: 12px;
    line-height: 1.7;
}
.connection-picker {
    display: grid;
    gap: 8px;
    font-size: 13px;
}
select {
    box-sizing: border-box;
    min-width: 0;
    width: 100%;
    min-height: 36px;
    border: 1px solid var(--k-card-border);
    border-radius: 6px;
    padding: 6px 8px;
    color: var(--k-text-dark);
    background: var(--k-card-bg);
    font: inherit;
}
select:focus-visible {
    outline: 2px solid var(--k-color-primary);
    outline-offset: 2px;
}
.capability-list {
    border-block: 1px solid var(--k-card-border);
}
.capability-control {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 9rem;
    gap: 12px;
    align-items: center;
    padding: 9px 0;
}
.capability-control + .capability-control {
    border-top: 1px solid var(--k-card-border);
}
.capability-control span {
    display: grid;
    gap: 3px;
    font-size: 13px;
}
.capability-control strong {
    font-weight: 500;
}
.capability-control small {
    font-size: 11px;
}
.editor-error {
    color: var(--el-color-danger);
    font-size: 13px;
    line-height: 1.6;
    overflow-wrap: anywhere;
    margin: 0;
}
.editor-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
}
.editor-actions :deep(.el-button) {
    margin-left: 0;
}
.editor-action-spacer {
    flex: 1;
}
@media (max-width: 480px) {
    .capability-editor {
        max-height: 61vh;
        gap: 12px;
    }
    .capability-control {
        grid-template-columns: minmax(0, 1fr) 8rem;
    }
    .editor-action-spacer {
        display: none;
    }
    .editor-actions {
        justify-content: flex-end;
    }
}
</style>
