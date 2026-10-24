<template>
    <details class="routes-editor">
        <summary>
            模型路由（高级） · {{ provider.routes?.length ?? 0 }} 条显式规则
        </summary>
        <p>
            默认模型仅使用一个源。只有在此明确选择候选源并开启回退，才允许跨源发送请求。手动模型目录无权限时，请完整填写类型、能力及上下文。
        </p>
        <el-button size="small" @click="addRoute">添加路由</el-button>
        <section
            v-for="(route, index) in provider.routes"
            :key="index"
            class="route-card"
        >
            <div class="fields">
                <label
                    >公开模型 ID<el-input
                        v-model="route.model"
                        placeholder="ChatLuna 中使用的名称"
                /></label>
                <label
                    >类型契约<el-select
                        v-model="route.modelType"
                        clearable
                        placeholder="从目录推断"
                        ><el-option label="LLM" value="llm" /><el-option
                            label="Embeddings"
                            value="embeddings" /><el-option
                            label="Reranker"
                            value="reranker" /></el-select
                ></label>
                <label
                    >能力契约<el-select
                        v-model="route.capabilities"
                        multiple
                        clearable
                        placeholder="默认取所有候选能力交集"
                        ><el-option
                            v-for="cap in capabilities"
                            :key="cap.value"
                            :label="cap.label"
                            :value="cap.value" /></el-select
                ></label>
                <label
                    >上下文上限<el-input-number
                        v-model="route.contextSize"
                        :min="1"
                        placeholder="默认取兼容下限"
                /></label>
                <label class="inline wide"
                    >允许跨源回退 / 负载均衡<el-switch
                        v-model="route.allowFallback"
                /></label>
            </div>
            <div
                v-for="(candidate, ci) in route.candidates"
                :key="ci"
                class="candidate"
            >
                <label
                    >候选连接源<el-select
                        v-model="candidate.sourceId"
                        @change="candidate.credentialIds = []"
                        ><el-option
                            v-for="source in provider.sources"
                            :key="source.id"
                            :label="
                                source.name +
                                (source.enabled ? '' : '（已停用）')
                            "
                            :value="source.id" /></el-select
                ></label>
                <label
                    >上游模型 ID<el-input v-model="candidate.upstreamModel"
                /></label>
                <label
                    >Key 范围<el-select
                        v-model="candidate.credentialIds"
                        multiple
                        clearable
                        collapse-tags
                        placeholder="该源所有有权限 Key"
                        ><el-option
                            v-for="key in source(candidate.sourceId)
                                ?.credentials ?? []"
                            :key="key.id"
                            :label="key.name"
                            :value="key.id" /></el-select
                ></label>
                <label v-if="route.modelType === 'embeddings'"
                    >Embedding 语义空间及版本<el-input
                        v-model="candidate.embeddingSpace"
                        placeholder="例如 deployment:model-version:dimensions"
                /></label>
                <el-button
                    type="danger"
                    size="small"
                    :disabled="route.candidates.length === 1"
                    @click="route.candidates.splice(ci, 1)"
                    >移除候选</el-button
                >
            </div>
            <div class="actions">
                <el-button
                    size="small"
                    :disabled="!provider.sources?.length"
                    @click="
                        route.candidates.push({
                            sourceId: provider.sources[0].id,
                            upstreamModel: route.model,
                            credentialIds: []
                        })
                    "
                    >添加候选</el-button
                ><el-button
                    type="danger"
                    size="small"
                    @click="provider.routes.splice(index, 1)"
                    >删除路由</el-button
                >
            </div>
        </section>
    </details>
</template>
<script setup lang="ts">
import type { ConsoleProviderEntry } from 'koishi-plugin-chatluna-model-hub-adapter'
const props = defineProps<{ provider: ConsoleProviderEntry }>()
const source = (id: string) => props.provider.sources?.find((s) => s.id === id)
const capabilities = [
    { label: '文本', value: 'text_input' },
    { label: '工具调用', value: 'tool_call' },
    { label: '图片输入', value: 'image_input' },
    { label: '推理', value: 'thinking' },
    { label: '生图', value: 'image_generation' },
    { label: '音频', value: 'audio_input' },
    { label: '视频', value: 'video_input' },
    { label: '文件', value: 'file_input' }
]
function addRoute() {
    ;(props.provider.routes ??= []).push({
        model: '',
        allowFallback: false,
        candidates: [
            {
                sourceId: props.provider.sources?.[0]?.id ?? '',
                upstreamModel: ''
            }
        ]
    })
}
</script>
<style scoped>
.routes-editor {
    color: var(--k-text-dark);
}
summary {
    cursor: pointer;
    font-weight: 600;
    padding: 12px 0;
}
p {
    font-size: 0.8rem;
    color: var(--k-text-light);
    line-height: 1.6;
}
.route-card {
    border: 1px solid var(--k-card-border);
    border-radius: 8px;
    padding: 12px;
    margin-top: 12px;
}
.fields,
.candidate {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
}
.candidate {
    border-top: 1px solid var(--k-card-border);
    padding: 12px 0;
    margin-top: 12px;
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
    justify-content: space-between;
    align-items: center;
}
.actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}
.el-select,
.el-input-number {
    width: 100%;
}
@media (max-width: 600px) {
    .fields,
    .candidate {
        grid-template-columns: minmax(0, 1fr);
    }
}
</style>
