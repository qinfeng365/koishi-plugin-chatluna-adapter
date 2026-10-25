<template>
    <div class="browser-model-row">
        <button
            type="button"
            class="model-favorite"
            :class="{ active: favorite }"
            :aria-pressed="favorite"
            :aria-label="`${favorite ? '取消收藏' : '收藏'} ${model.platform}/${model.name}`"
            :title="favorite ? '取消收藏' : '收藏'"
            @click.stop.prevent="$emit('favorite')"
        >
            {{ favorite ? '★' : '☆' }}
        </button>
        <div class="model-identity">
            <strong>{{ model.name }}</strong>
            <small>
                {{ model.type.toLowerCase() === 'llm' ? 'LLM' : model.type }}
                <template v-if="model.lastUsedAt">
                    · 使用于 {{ usedAt }}</template
                >
            </small>
            <details
                v-if="model.candidates?.length"
                class="model-connections"
                @click.stop
            >
                <summary>
                    {{
                        model.candidates.filter((c) => c.available !== false)
                            .length
                    }}/{{ model.candidates.length }} 可用连接
                </summary>
                <div
                    v-for="candidate in model.candidates"
                    :key="candidate.sourceId + candidate.credentialId"
                >
                    {{ candidate.sourceName || candidate.sourceId }} ·
                    {{ candidate.credentialName || 'Key' }} →
                    {{ candidate.upstreamModel }}
                    <small
                        >{{
                            candidate.available === false ? '暂不可用' : '可用'
                        }}
                        ·
                        {{
                            candidate.capabilities
                                ?.map((c) => labels[c] || c)
                                .join(' / ')
                        }}</small
                    >
                </div>
            </details>
        </div>
        <span class="model-capabilities">
            {{ capabilities || '未声明能力' }}
            <small v-if="hasOverrides" class="model-overridden">已覆盖</small>
        </span>
        <div class="model-actions">
            <button
                v-if="model.type.toLowerCase() === 'llm'"
                type="button"
                class="model-edit"
                :disabled="!model.candidates?.length"
                :aria-label="`编辑 ${model.platform}/${model.name} 能力`"
                title="按连接编辑模型能力"
                @click.stop.prevent="$emit('edit')"
            >
                能力
            </button>
            <button
                type="button"
                class="model-copy"
                :aria-label="`复制 ${model.platform}/${model.name}`"
                title="复制平台/模型标识"
                @click.stop.prevent="$emit('copy')"
            >
                复制
            </button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ModelHubConsoleModel } from 'koishi-plugin-chatluna-model-hub-adapter'

const props = defineProps<{
    model: ModelHubConsoleModel
    favorite: boolean
}>()
defineEmits<{ favorite: []; copy: []; edit: [] }>()

const labels: Record<string, string> = {
    text_input: '文本',
    tool_call: '工具',
    image_input: '图片',
    thinking: '推理',
    image_generation: '生图',
    audio_input: '音频',
    video_input: '视频',
    file_input: '文件'
}
const capabilities = computed(() =>
    (props.model.capabilities ?? [])
        .map((item) => labels[item] || item)
        .join(' · ')
)
const usedAt = computed(() =>
    props.model.lastUsedAt
        ? new Date(props.model.lastUsedAt).toLocaleString()
        : ''
)
const hasOverrides = computed(() =>
    props.model.candidates?.some(
        (candidate) =>
            Object.keys(candidate.capabilityOverrides ?? {}).length > 0
    )
)
</script>

<style scoped lang="scss">
.browser-model-row {
    display: grid;
    grid-template-columns: 2rem minmax(0, 1.5fr) minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.65rem;
    padding: 0.7rem 0.85rem;
    color: var(--k-text-dark);
}
.model-identity {
    display: grid;
    gap: 0.2rem;
    min-width: 0;
    overflow-wrap: anywhere;
    small {
        color: var(--k-text-light);
        font-size: 0.75rem;
    }
}
.model-capabilities {
    color: var(--k-text-light);
    font-size: 0.8rem;
    overflow-wrap: anywhere;
}
.model-overridden {
    display: inline-block;
    margin-left: 0.4rem;
    color: var(--k-color-primary);
    font-size: 0.7rem;
}
.model-actions {
    display: flex;
    gap: 0.35rem;
}
.model-connections {
    font-size: 0.75rem;
    color: var(--k-text-light);
}
.model-connections summary {
    cursor: pointer;
}
.model-connections div {
    margin-top: 0.4rem;
    overflow-wrap: anywhere;
}
.model-favorite,
.model-edit,
.model-copy {
    min-height: 2rem;
    padding: 0.25rem 0.4rem;
    border: 1px solid var(--k-card-border);
    border-radius: 6px;
    background: transparent;
    color: var(--k-text-light);
    cursor: pointer;
    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
    &:focus-visible {
        outline: 2px solid var(--k-color-primary);
        outline-offset: 2px;
    }
    &:hover,
    &.active {
        color: var(--k-color-primary);
        background: color-mix(in srgb, var(--k-color-primary) 8%, transparent);
    }
}
.model-favorite {
    font-size: 1.1rem;
}
@media (max-width: 600px) {
    .browser-model-row {
        grid-template-columns: 2rem minmax(0, 1fr) auto;
        gap: 0.5rem;
        padding: 0.65rem;
    }
    .model-capabilities {
        grid-column: 2 / 3;
    }
    .model-actions {
        grid-column: 3;
        grid-row: 1;
        flex-direction: column;
    }
}
</style>
