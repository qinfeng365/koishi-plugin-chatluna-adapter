<template>
    <k-layout :class="['model-hub-page', modeClass]">
        <template #header>
            <div class="header-bar">
                <div class="title-block">
                    <strong>Model Hub</strong>
                    <span>{{ form.providers.length }} 个服务商</span>
                </div>
                <div class="header-actions">
                    <el-button :loading="refreshing" @click="refreshAll">
                        刷新模型
                    </el-button>
                </div>
            </div>
        </template>

        <main class="model-hub-main">
            <div v-if="message" class="notice" :data-tone="tone">
                {{ message }}
            </div>

            <nav class="mode-tabs">
                <button
                    v-for="tab in tabs"
                    :key="tab.value"
                    type="button"
                    :class="{ active: activeTab === tab.value }"
                    @click="activeTab = tab.value"
                >
                    {{ tab.label }}
                </button>
            </nav>

            <section v-show="activeTab === 'providers'" class="workspace">
                <aside class="provider-panel">
                    <div class="panel-head">
                        <div>
                            <h2>服务商</h2>
                            <span>{{ visibleProviders.length }} / {{ form.providers.length }}</span>
                        </div>
                        <el-button type="primary" @click="openAddDialog">
                            添加
                        </el-button>
                    </div>

                    <label class="search-box">
                        <span class="search-icon"></span>
                        <input
                            v-model.trim="providerSearch"
                            type="search"
                            placeholder="搜索服务商"
                        />
                    </label>

                    <div class="kind-filter-row">
                        <button
                            v-for="kind in kindOptions"
                            :key="kind.value"
                            type="button"
                            :class="{ active: providerKind === kind.value }"
                            @click="providerKind = kind.value"
                        >
                            {{ kind.label }}
                        </button>
                    </div>

                    <div class="provider-list">
                        <button
                            v-for="item in visibleProviders"
                            :key="`${item.provider.provider}:${item.provider.platform}:${item.index}`"
                            type="button"
                            class="provider-row"
                            :class="{ active: selectedProviderIndex === item.index }"
                            @click="selectProvider(item.index)"
                        >
                            <span class="provider-icon">
                                <span>{{ fallbackName(providerName(item.provider)) }}</span>
                                <img
                                    :key="providerIcon(item.provider)"
                                    :src="firstIconUrl(providerIcon(item.provider))"
                                    :alt="providerName(item.provider)"
                                    :data-icon="providerIcon(item.provider)"
                                    @load="showIcon"
                                    @error="tryNextIcon"
                                />
                            </span>
                            <span class="provider-copy">
                                <strong>{{ providerName(item.provider) }}</strong>
                                <small>
                                    {{ item.provider.platform || '未命名平台' }}
                                </small>
                            </span>
                            <span
                                class="status-dot"
                                :data-status="runtimeProvider(item.provider)?.status ?? 'preset'"
                            ></span>
                        </button>

                        <button
                            v-if="form.providers.length === 0"
                            class="empty-action"
                            type="button"
                            @click="openAddDialog"
                        >
                            添加服务商
                        </button>
                        <p v-else-if="visibleProviders.length === 0" class="empty-text compact">
                            没有匹配的服务商
                        </p>
                    </div>
                </aside>

                <transition name="panel-fade" mode="out-in">
                    <section v-if="selectedProvider" :key="selectedProviderIndex" class="detail-panel">
                    <header class="detail-head">
                        <div class="detail-title">
                            <span class="provider-icon large">
                                <span>{{ fallbackName(providerName(selectedProvider)) }}</span>
                                <img
                                    :key="providerIcon(selectedProvider)"
                                    :src="firstIconUrl(providerIcon(selectedProvider))"
                                    :alt="providerName(selectedProvider)"
                                    :data-icon="providerIcon(selectedProvider)"
                                    @load="showIcon"
                                    @error="tryNextIcon"
                                />
                            </span>
                            <div>
                                <strong>{{ providerName(selectedProvider) }}</strong>
                                <small>{{ selectedProvider.platform || '未命名平台' }}</small>
                            </div>
                        </div>

                        <div class="detail-actions">
                            <span
                                class="status-pill"
                                :data-status="selectedRuntimeProvider?.status ?? 'preset'"
                            >
                                {{ statusText(selectedRuntimeProvider?.status ?? 'preset') }}
                            </span>
                            <el-button
                                :loading="saving"
                                type="primary"
                                :disabled="!dirty"
                                @click="saveSettings"
                            >
                                保存
                            </el-button>
                            <el-button
                                :disabled="!selectedRuntimeProvider"
                                @click="refreshProvider(selectedProvider)"
                            >
                                刷新
                            </el-button>
                            <el-button @click="copyProvider(selectedProvider)">
                                复制
                            </el-button>
                            <el-button @click="duplicateProvider(selectedProviderIndex)">
                                克隆
                            </el-button>
                            <el-button
                                type="danger"
                                @click="removeProvider(selectedProviderIndex)"
                            >
                                删除
                            </el-button>
                        </div>
                    </header>

                    <div class="detail-scroll">
                        <p v-if="selectedRuntimeProvider?.error" class="error-box">
                            {{ selectedRuntimeProvider.error }}
                        </p>

                        <section class="section">
                            <div class="section-head">
                                <h3>连接</h3>
                                <div class="mini-stats">
                                    <span>{{ selectedRuntimeProvider?.modelCount ?? 0 }} 模型</span>
                                    <span>
                                        {{
                                            selectedProvider.hasApiKey
                                                ? selectedProvider.apiKeyPreview || '已保存密钥'
                                                : '未配置密钥'
                                        }}
                                    </span>
                                </div>
                            </div>

                            <div class="grid two">
                                <label>
                                    <span>服务商名称</span>
                                    <el-input v-model="selectedProvider.name" />
                                </label>
                                <label>
                                    <span>ChatLuna 平台 ID</span>
                                    <el-input v-model="selectedProvider.platform" />
                                </label>
                                <label class="wide">
                                    <span>API 地址</span>
                                    <el-input v-model="selectedProvider.apiEndpoint" />
                                </label>
                                <label class="wide">
                                    <span>API Key</span>
                                    <el-input
                                        v-model="selectedProvider.apiKey"
                                        show-password
                                        :placeholder="selectedProvider.apiKeyPreview || '输入新密钥'"
                                        @input="selectedProvider.clearApiKey = false"
                                    />
                                </label>
                            </div>

                            <div
                                v-if="selectedProvider.hasApiKey && !selectedProvider.clearApiKey"
                                class="secret-row"
                            >
                                <span>已保存 {{ selectedProvider.apiKeyPreview }}</span>
                                <button type="button" @click="clearProviderKey(selectedProvider)">
                                    清除
                                </button>
                            </div>

                            <div class="switch-grid">
                                <label>
                                    <span>启用服务商</span>
                                    <el-switch v-model="selectedProvider.enabled" />
                                </label>
                                <label>
                                    <span>拉取 /models</span>
                                    <el-switch v-model="selectedProvider.pullModels" />
                                </label>
                            </div>
                        </section>

                        <section v-if="selectedProvider.provider === 'openai'" class="section">
                            <div class="section-head">
                                <h3>Responses</h3>
                            </div>

                            <div class="switch-grid">
                                <label>
                                    <span>启用 Responses API</span>
                                    <el-switch v-model="selectedProvider.responseApi" />
                                </label>
                            </div>

                            <div v-if="selectedProvider.responseApi" class="grid two">
                                <label>
                                    <span>内置工具</span>
                                    <el-select v-model="selectedProvider.responseBuiltinTools" multiple>
                                        <el-option label="网页搜索" value="web_search_preview" />
                                        <el-option label="图片生成" value="image_generation" />
                                        <el-option label="代码解释器" value="code_interpreter" />
                                        <el-option label="文件搜索" value="file_search" />
                                    </el-select>
                                </label>
                                <label class="wide">
                                    <span>支持工具的模型</span>
                                    <el-input
                                        v-model="responseSupportModelsText"
                                        placeholder="用英文逗号分隔"
                                    />
                                </label>
                                <label class="wide">
                                    <span>File Search Vector Store IDs</span>
                                    <el-input
                                        v-model="responseVectorStoresText"
                                        placeholder="用英文逗号分隔"
                                    />
                                </label>
                            </div>
                        </section>

                        <section v-if="selectedProvider.provider === 'gemini'" class="section">
                            <div class="section-head">
                                <h3>Gemini Tools</h3>
                            </div>

                            <div class="switch-grid">
                                <label>
                                    <span>Google Search</span>
                                    <el-switch v-model="selectedProvider.googleSearch" />
                                </label>
                                <label>
                                    <span>Code Execution</span>
                                    <el-switch v-model="selectedProvider.codeExecution" />
                                </label>
                                <label>
                                    <span>URL Context</span>
                                    <el-switch v-model="selectedProvider.urlContext" />
                                </label>
                                <label>
                                    <span>Image Generation</span>
                                    <el-switch v-model="selectedProvider.imageGeneration" />
                                </label>
                                <label>
                                    <span>Include Thoughts</span>
                                    <el-switch v-model="selectedProvider.includeThoughts" />
                                </label>
                                <label>
                                    <span>Show Grounding</span>
                                    <el-switch v-model="selectedProvider.groundingContentDisplay" />
                                </label>
                            </div>

                            <div class="grid two">
                                <label>
                                    <span>Thinking Budget</span>
                                    <el-input-number
                                        v-model="selectedProvider.thinkingBudget"
                                        :min="-1"
                                        :max="24576"
                                        controls-position="right"
                                    />
                                </label>
                            </div>
                        </section>

                        <section class="section">
                            <div class="section-head">
                                <h3>请求</h3>
                            </div>

                            <div class="grid two">
                                <label class="slider-field">
                                    <span>最大上下文比例</span>
                                    <el-slider
                                        v-model="selectedProvider.maxContextRatio"
                                        :min="0"
                                        :max="1"
                                        :step="0.01"
                                        show-input
                                    />
                                </label>
                                <label class="slider-field">
                                    <span>Temperature</span>
                                    <el-slider
                                        v-model="selectedProvider.temperature"
                                        :min="0"
                                        :max="2"
                                        :step="0.1"
                                        show-input
                                    />
                                </label>
                                <label class="slider-field">
                                    <span>Presence penalty</span>
                                    <el-slider
                                        v-model="selectedProvider.presencePenalty"
                                        :min="-2"
                                        :max="2"
                                        :step="0.1"
                                        show-input
                                    />
                                </label>
                                <label class="slider-field">
                                    <span>Frequency penalty</span>
                                    <el-slider
                                        v-model="selectedProvider.frequencyPenalty"
                                        :min="-2"
                                        :max="2"
                                        :step="0.1"
                                        show-input
                                    />
                                </label>
                            </div>

                            <div class="switch-grid">
                                <label>
                                    <span>强制非流式</span>
                                    <el-switch v-model="selectedProvider.nonStreaming" />
                                </label>
                            </div>
                        </section>

                        <section class="section">
                            <div class="section-head">
                                <h3>网络</h3>
                            </div>

                            <div class="grid three">
                                <label>
                                    <span>超时毫秒</span>
                                    <el-input-number
                                        v-model="selectedProvider.timeout"
                                        :min="1000"
                                        :step="1000"
                                        controls-position="right"
                                    />
                                </label>
                                <label>
                                    <span>最大重试</span>
                                    <el-input-number
                                        v-model="selectedProvider.maxRetries"
                                        :min="0"
                                        :max="6"
                                        controls-position="right"
                                    />
                                </label>
                                <label>
                                    <span>并发数</span>
                                    <el-input-number
                                        v-model="selectedProvider.chatConcurrentMaxSize"
                                        :min="1"
                                        :max="8"
                                        controls-position="right"
                                    />
                                </label>
                                <label>
                                    <span>配置模式</span>
                                    <el-select v-model="selectedProvider.configMode">
                                        <el-option label="顺序" value="default" />
                                        <el-option label="负载均衡" value="balance" />
                                    </el-select>
                                </label>
                                <label>
                                    <span>代理模式</span>
                                    <el-select v-model="selectedProvider.proxyMode">
                                        <el-option label="跟随 ChatLuna" value="system" />
                                        <el-option label="关闭" value="off" />
                                        <el-option label="自定义" value="on" />
                                    </el-select>
                                </label>
                                <label v-if="selectedProvider.proxyMode === 'on'">
                                    <span>代理地址</span>
                                    <el-input v-model="selectedProvider.proxyAddress" />
                                </label>
                            </div>
                        </section>

                        <section class="section">
                            <div class="section-head">
                                <h3>自定义请求头</h3>
                                <el-button size="small" @click="addHeader(selectedProvider)">
                                    添加
                                </el-button>
                            </div>

                            <div class="header-list">
                                <div
                                    v-for="(header, index) in selectedProvider.customHeaders"
                                    :key="`${header.name}:${index}`"
                                    class="header-row"
                                >
                                    <el-input
                                        v-model="header.name"
                                        placeholder="Header 名称"
                                    />
                                    <el-input
                                        v-model="header.value"
                                        show-password
                                        :placeholder="header.valuePreview || 'Header 值'"
                                        @input="header.clearValue = false"
                                    />
                                    <el-button
                                        v-if="header.hasValue && !header.clearValue"
                                        @click="clearHeaderValue(header)"
                                    >
                                        清除值
                                    </el-button>
                                    <el-button
                                        type="danger"
                                        @click="removeHeader(selectedProvider, index)"
                                    >
                                        删除
                                    </el-button>
                                </div>
                                <p
                                    v-if="selectedProvider.customHeaders.length === 0"
                                    class="empty-text compact"
                                >
                                    暂无请求头
                                </p>
                            </div>
                        </section>
                    </div>
                </section>

                <section v-else key="empty" class="empty-detail">
                    <strong>暂无服务商</strong>
                    <el-button type="primary" @click="openAddDialog">
                        添加服务商
                    </el-button>
                </section>
                </transition>
            </section>

            <section v-show="activeTab === 'models'" class="workspace models-workspace">
                <div class="section-head">
                    <h2>已加载模型</h2>
                    <div class="detail-actions">
                        <span class="status-pill" :data-status="data?.totals?.models ? 'loaded' : 'missing-key'">
                            {{ data?.totals?.models ?? 0 }} 个模型
                        </span>
                        <el-button :loading="refreshing" @click="refreshAll">
                            刷新
                        </el-button>
                    </div>
                </div>

                <div class="section">
                    <div class="section-head">
                        <h3>自动获取</h3>
                        <span>服务商启用后只显示 /models 返回的结果。</span>
                    </div>

                    <div class="model-table">
                        <div class="model-head">
                            <span>模型</span>
                            <span>平台</span>
                            <span>类型</span>
                            <span>能力</span>
                        </div>
                        <div
                            v-for="model in filteredModels"
                            :key="`${model.platform}/${model.name}`"
                            class="model-row-view"
                        >
                            <strong>{{ model.name }}</strong>
                            <span>{{ model.platform }}</span>
                            <span>{{ typeText(model.type) }}</span>
                            <span>{{ capabilityText(model.capabilities) }}</span>
                        </div>
                        <p v-if="filteredModels.length === 0" class="empty-text compact">
                            暂无模型
                        </p>
                    </div>
                </div>
            </section>

            <el-dialog
                v-model="showAddDialog"
                append-to-body
                title="添加新服务商"
                width="90%"
                top="5vh"
                class="add-dialog"
            >
                <div class="dialog-shell">
                    <div class="catalog-panel">
                        <div class="dialog-toolbar">
                            <label class="search-box compact-search">
                                <span class="search-icon"></span>
                                <input
                                    v-model.trim="presetSearch"
                                    type="search"
                                    placeholder="搜索服务商"
                                />
                            </label>

                            <div class="kind-switch">
                                <button
                                    v-for="kind in kindOptions"
                                    :key="kind.value"
                                    type="button"
                                    :class="{ active: presetKind === kind.value }"
                                    @click="presetKind = kind.value"
                                >
                                    {{ kind.label }}
                                </button>
                            </div>
                        </div>

                        <div class="preset-grid">
                            <button
                                v-for="preset in filteredPresets"
                                :key="preset.id"
                                type="button"
                                class="preset-card"
                                :class="{ selected: selectedPreset?.id === preset.id }"
                                @click="selectPreset(preset)"
                            >
                                <span class="provider-icon large">
                                    <span>{{ fallbackName(preset.name) }}</span>
                                    <img
                                        :key="preset.icon"
                                        :src="firstIconUrl(preset.icon)"
                                        :alt="preset.name"
                                        :data-icon="preset.icon"
                                        loading="lazy"
                                        @load="showIcon"
                                        @error="tryNextIcon"
                                    />
                                </span>
                                <strong>{{ preset.name }}</strong>
                                <small>{{ preset.defaultPlatform }}</small>
                            </button>
                        </div>
                    </div>

                    <aside v-if="newProvider" class="new-provider">
                        <div class="detail-title">
                            <span class="provider-icon">
                                <span>{{ fallbackName(selectedPreset?.name || '') }}</span>
                                <img
                                    :key="selectedPreset?.icon || ''"
                                    :src="firstIconUrl(selectedPreset?.icon || '')"
                                    :alt="selectedPreset?.name"
                                    :data-icon="selectedPreset?.icon || ''"
                                    @load="showIcon"
                                    @error="tryNextIcon"
                                />
                            </span>
                            <div>
                                <strong>{{ selectedPreset?.name }}</strong>
                                <small>{{ selectedPreset?.adapter }}</small>
                            </div>
                        </div>

                        <div class="grid one">
                            <label>
                                <span>服务商名称</span>
                                <el-input v-model="newProvider.name" />
                            </label>
                            <label>
                                <span>ChatLuna 平台 ID</span>
                                <el-input v-model="newProvider.platform" />
                            </label>
                            <label>
                                <span>API 地址</span>
                                <el-input v-model="newProvider.apiEndpoint" />
                            </label>
                            <label>
                                <span>API Key</span>
                                <el-input
                                    v-model="newProvider.apiKey"
                                    show-password
                                    :placeholder="selectedPreset?.allowEmptyApiKey ? '本地服务可留空' : '输入 API Key'"
                                />
                            </label>
                            <div class="switch-grid compact">
                                <label>
                                    <span>启用服务商</span>
                                    <el-switch v-model="newProvider.enabled" />
                                </label>
                                <label>
                                    <span>拉取 /models</span>
                                    <el-switch v-model="newProvider.pullModels" />
                                </label>
                            </div>
                        </div>
                    </aside>
                </div>

                <template #footer>
                    <el-button @click="showAddDialog = false">取消</el-button>
                    <el-button
                        type="primary"
                        :disabled="!validNewProvider"
                        @click="confirmAddProvider"
                    >
                        添加
                    </el-button>
                </template>
            </el-dialog>
        </main>
    </k-layout>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { send, store } from '@koishijs/client'
import type {
    ConsoleHeaderEntry,
    ConsoleProviderEntry,
    ModelHubActionResult,
    ModelHubConsoleData,
    ModelHubConsolePreset,
    ModelHubConsoleSettings,
    ModelHubProviderStatus
} from 'koishi-plugin-chatluna-model-hub-adapter'
import type { ModelCapabilities } from 'koishi-plugin-chatluna/llm-core/platform/types'

const tabs = [
    { label: '服务商', value: 'providers' },
    { label: '模型', value: 'models' }
] as const

const kindOptions = [
    { label: '全部', value: 'all' },
    { label: '云端', value: 'cloud' },
    { label: '本地', value: 'local' }
] as const

const data = computed(() => store.chatluna_model_hub as ModelHubConsoleData)
const frontendMode = computed(() => data.value?.frontendMode || 'performance')
const modeClass = computed(() => `market-mode-${frontendMode.value}`)
const form = ref<ModelHubConsoleSettings>(emptySettings())
const activeTab = ref<(typeof tabs)[number]['value']>('providers')
const dirty = ref(false)
const saving = ref(false)
const refreshing = ref(false)
const showAddDialog = ref(false)
const message = ref('')
const tone = ref<'success' | 'danger' | 'info'>('info')
const presetSearch = ref('')
const presetKind = ref<(typeof kindOptions)[number]['value']>('all')
const selectedPreset = ref<ModelHubConsolePreset>()
const newProvider = ref<ConsoleProviderEntry>()
const providerSearch = ref('')
const providerKind = ref<(typeof kindOptions)[number]['value']>('all')
const modelKeyword = ref('')
const selectedProviderIndex = ref(-1)
let hydrating = false

watch(
    () => data.value?.revision,
    () => {
        if (!data.value?.settings || dirty.value) return
        hydrate(data.value.settings)
    },
    { immediate: true }
)

watch(
    form,
    () => {
        if (!hydrating) dirty.value = true
    },
    { deep: true }
)

watch(
    () => form.value.providers.length,
    () => normalizeSelectedProvider()
)

const visibleProviders = computed(() => {
    const text = providerSearch.value.toLowerCase()
    return form.value.providers
        .map((provider, index) => ({ provider, index }))
        .filter(({ provider }) => {
            if (providerKind.value !== 'all') {
                const preset = providerPreset(provider)
                if ((preset?.kind ?? 'cloud') !== providerKind.value) return false
            }
            if (!text) return true
            return [providerName(provider), provider.platform, provider.provider, provider.apiEndpoint]
                .join(' ')
                .toLowerCase()
                .includes(text)
        })
})

const filteredPresets = computed(() => {
    const text = presetSearch.value.toLowerCase()
    return (data.value?.presets ?? []).filter((preset) => {
        if (presetKind.value !== 'all' && preset.kind !== presetKind.value) {
            return false
        }
        if (!text) return true
        return [preset.name, preset.id, preset.defaultPlatform, preset.defaultEndpoint]
            .join(' ')
            .toLowerCase()
            .includes(text)
    })
})

const filteredModels = computed(() => {
    const text = modelKeyword.value.toLowerCase()
    return (data.value?.models ?? []).filter((model) => {
        if (!text) return true
        return [model.name, model.platform, model.provider]
            .join(' ')
            .toLowerCase()
            .includes(text)
    })
})

const selectedProvider = computed(() =>
    selectedProviderIndex.value >= 0 ? form.value.providers[selectedProviderIndex.value] : undefined
)

const selectedRuntimeProvider = computed(() =>
    selectedProvider.value ? runtimeProvider(selectedProvider.value) : undefined
)

const responseSupportModelsText = computed({
    get: () => selectedProvider.value?.responseBuiltinToolSupportModel?.join(', ') ?? '',
    set: (value: string) => {
        if (!selectedProvider.value) return
        selectedProvider.value.responseBuiltinToolSupportModel = splitList(value)
    }
})

const responseVectorStoresText = computed({
    get: () => selectedProvider.value?.responseFileSearchVectorStoreIds?.join(', ') ?? '',
    set: (value: string) => {
        if (!selectedProvider.value) return
        selectedProvider.value.responseFileSearchVectorStoreIds = splitList(value)
    }
})

const validNewProvider = computed(
    () =>
        !!newProvider.value?.provider &&
        !!newProvider.value.name.trim() &&
        !!newProvider.value.platform.trim() &&
        !!newProvider.value.apiEndpoint.trim()
)

function hydrate(settings: ModelHubConsoleSettings) {
    hydrating = true
    form.value = clone(settings)
    normalizeSelectedProvider()
    dirty.value = false
    queueMicrotask(() => {
        hydrating = false
    })
}

function emptySettings(): ModelHubConsoleSettings {
    return {
        providers: [],
        additionalModels: [],
        blacklistModels: []
    }
}

function createProviderDefaults() {
    return {
        customHeaders: [] as ConsoleHeaderEntry[],
        chatConcurrentMaxSize: 3,
        chatTimeLimit: 200,
        configMode: 'default' as const,
        maxRetries: 5,
        timeout: 300000,
        proxyMode: 'system' as const,
        proxyAddress: '',
        maxContextRatio: 0.35,
        temperature: 1,
        presencePenalty: 0,
        frequencyPenalty: 0,
        nonStreaming: false,
        responseApi: false,
        responseBuiltinTools: [],
        responseBuiltinToolSupportModel: ['gpt-4o', 'gpt-4.1', 'gpt-5', 'o3', 'o4'],
        responseFileSearchVectorStoreIds: [],
        googleSearch: false,
        codeExecution: false,
        urlContext: false,
        imageGeneration: false,
        thinkingBudget: -1,
        includeThoughts: false,
        groundingContentDisplay: false
    }
}

function clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value))
}

function normalizeSelectedProvider() {
    const last = form.value.providers.length - 1
    if (last < 0) {
        selectedProviderIndex.value = -1
        return
    }
    if (selectedProviderIndex.value < 0) selectedProviderIndex.value = 0
    if (selectedProviderIndex.value > last) selectedProviderIndex.value = last
}

function selectProvider(index: number) {
    selectedProviderIndex.value = index
}

function openAddDialog() {
    presetSearch.value = ''
    presetKind.value = 'all'
    if (!selectedPreset.value) {
        const first = data.value?.presets?.[0]
        if (first) selectPreset(first)
    }
    showAddDialog.value = true
}

function selectPreset(preset: ModelHubConsolePreset) {
    selectedPreset.value = preset
    newProvider.value = {
        ...createProviderDefaults(),
        provider: preset.id,
        name: preset.name,
        platform: uniquePlatform(preset.defaultPlatform),
        apiEndpoint: preset.defaultEndpoint,
        apiKey: '',
        apiKeyPreview: '',
        hasApiKey: false,
        clearApiKey: false,
        enabled: true,
        pullModels: true
    }
}

function confirmAddProvider() {
    if (!newProvider.value) return
    form.value.providers.push(clone(newProvider.value))
    selectedProviderIndex.value = form.value.providers.length - 1
    activeTab.value = 'providers'
    showAddDialog.value = false
}

function uniquePlatform(base: string) {
    const normalized = base || 'hub-provider'
    const platforms = new Set(form.value.providers.map((item) => item.platform))
    if (!platforms.has(normalized)) return normalized
    let index = 2
    while (platforms.has(`${normalized}-${index}`)) index += 1
    return `${normalized}-${index}`
}

function providerPreset(provider: ConsoleProviderEntry) {
    return data.value?.presets?.find((preset) => preset.id === provider.provider)
}

function providerName(provider: ConsoleProviderEntry) {
    return provider.name || providerPreset(provider)?.name || provider.provider
}

function providerIcon(provider: ConsoleProviderEntry) {
    return providerPreset(provider)?.icon ?? provider.provider
}

function runtimeProvider(provider: ConsoleProviderEntry) {
    return data.value?.providers?.find((item) => item.platform === provider.platform)
}

function clearProviderKey(provider: ConsoleProviderEntry) {
    provider.apiKey = ''
    provider.apiKeyPreview = ''
    provider.hasApiKey = false
    provider.clearApiKey = true
}

function duplicateProvider(index: number) {
    const source = form.value.providers[index]
    if (!source) return
    form.value.providers.splice(index + 1, 0, {
        ...clone(source),
        platform: uniquePlatform(source.platform),
        apiKey: '',
        apiKeyPreview: '',
        hasApiKey: false,
        clearApiKey: false,
        customHeaders: source.customHeaders.map((header) => ({
            ...clone(header),
            value: '',
            valuePreview: '',
            hasValue: false,
            clearValue: false
        }))
    })
    selectedProviderIndex.value = index + 1
}

function removeProvider(index: number) {
    if (index < 0) return
    form.value.providers.splice(index, 1)
    selectedProviderIndex.value = Math.min(index, form.value.providers.length - 1)
    normalizeSelectedProvider()
}

async function copyProvider(provider: ConsoleProviderEntry) {
    await navigator.clipboard?.writeText(JSON.stringify({ ...provider, apiKey: '' }, null, 2))
    showMessage('已复制配置', 'success')
}

async function saveSettings() {
    saving.value = true
    try {
        const result = (await send('chatluna-model-hub/saveSettings', clone(form.value))) as ModelHubActionResult
        dirty.value = false
        showMessage(
            result.success ? '已保存并重新加载' : '已保存，部分服务商加载失败',
            result.success ? 'success' : 'danger'
        )
    } finally {
        saving.value = false
    }
}

async function refreshAll() {
    refreshing.value = true
    try {
        const result = (await send('chatluna-model-hub/refresh')) as ModelHubActionResult
        showMessage(
            result.success ? `已刷新 ${result.models ?? 0} 个模型` : '刷新失败',
            result.success ? 'success' : 'danger'
        )
    } finally {
        refreshing.value = false
    }
}

async function refreshProvider(provider: ConsoleProviderEntry) {
    const result = (await send('chatluna-model-hub/refresh', provider.platform)) as ModelHubActionResult
    showMessage(
        result.success ? `已刷新 ${provider.platform}` : `${provider.platform} 刷新失败`,
        result.success ? 'success' : 'danger'
    )
}

function addHeader(provider: ConsoleProviderEntry) {
    provider.customHeaders.push({
        target: '*',
        name: '',
        value: '',
        valuePreview: '',
        hasValue: false,
        clearValue: false
    })
}

function removeHeader(provider: ConsoleProviderEntry, index: number) {
    provider.customHeaders.splice(index, 1)
}

function clearHeaderValue(header: ConsoleHeaderEntry) {
    header.value = ''
    header.valuePreview = ''
    header.hasValue = false
    header.clearValue = true
}

const iconAliases: Record<string, string[]> = {
    'openai-compatible': ['openai']
}

const colorIcons = new Set([
    'baichuan',
    'deepseek',
    'gemini',
    'minimax',
    'mistral',
    'newapi',
    'qwen',
    'siliconcloud',
    'stepfun',
    'together',
    'vllm',
    'xinference',
    'yi',
    'zhipu'
])

function iconBase() {
    const base = (data.value?.iconCdn ?? '').replace(/\/$/, '')
    return base
}

function iconCandidates(icon: string) {
    if (!icon) return []
    const base = iconBase()
    if (!base) return []
    const names = [icon, ...(iconAliases[icon] ?? [])]
    return [...new Set(names)].flatMap((name) => {
        const urls = [`${base}/${name}.svg`]
        return colorIcons.has(name)
            ? [`${base}/${name}-color.svg`, ...urls]
            : urls
    })
}

function firstIconUrl(icon: string) {
    return iconCandidates(icon)[0] ?? ''
}

function fallbackName(name: string) {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((item) => item[0])
        .join('')
        .toUpperCase()
}

function tryNextIcon(event: Event) {
    const target = event.target as HTMLImageElement
    const icon = target.dataset.icon ?? ''
    const urls = iconCandidates(icon)
    const nextIndex = Number(target.dataset.iconIndex ?? '0') + 1
    if (nextIndex < urls.length) {
        target.dataset.iconIndex = String(nextIndex)
        target.style.display = ''
        target.src = urls[nextIndex]
        return
    }

    const fallback = target.previousElementSibling as HTMLElement | null
    if (fallback) fallback.style.display = ''
    target.style.display = 'none'
}

function showIcon(event: Event) {
    const target = event.target as HTMLImageElement
    target.dataset.iconIndex = target.dataset.iconIndex ?? '0'
    target.style.display = ''
    const fallback = target.previousElementSibling as HTMLElement | null
    if (fallback) {
        fallback.style.display = 'none'
    }
}

function statusText(status: ModelHubProviderStatus) {
    const map: Record<ModelHubProviderStatus, string> = {
        loaded: '已加载',
        configured: '已配置',
        'missing-key': '待配置',
        disabled: '停用',
        error: '错误',
        preset: '未加载'
    }
    return map[status]
}

function typeText(type: string) {
    const map: Record<string, string> = {
        llm: 'LLM',
        embeddings: 'Embeddings',
        reranker: 'Reranker'
    }
    return map[type] ?? type
}

function capabilityText(capabilities: ModelCapabilities[]) {
    if (!capabilities?.length) return '-'
    return capabilities
        .map((item) =>
            String(item)
                .replace(/_/g, ' ')
                .replace(/\b\w/g, (char) => char.toUpperCase())
        )
        .join(', ')
}

function splitList(value: string) {
    return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
}

function showMessage(text: string, nextTone: 'success' | 'danger' | 'info') {
    message.value = text
    tone.value = nextTone
}
</script>

<style scoped lang="scss">
.model-hub-page {
    height: 100%;
    min-height: 0;
    overflow: hidden;
}

.header-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    width: 100%;
}

.title-block {
    display: flex;
    align-items: baseline;
    gap: 0.7rem;
    min-width: 0;

    strong {
        font-size: 1.05rem;
        font-weight: 700;
    }

    span {
        color: var(--k-text-light);
        font-size: 0.85rem;
    }
}

.header-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 0.5rem;
}

.model-hub-main {
    display: grid;
    align-content: start;
    gap: 1rem;
    height: calc(100vh - 4.5rem);
    min-height: 0;
    overflow: hidden;
    padding: var(--card-margin);
}

.notice {
    border: 1px solid color-mix(in srgb, var(--k-card-border), transparent 30%);
    border-radius: 10px;
    background: var(--k-card-bg);
    padding: 0.75rem 0.9rem;

    &[data-tone='success'] {
        color: var(--el-color-success);
    }

    &[data-tone='danger'] {
        color: var(--el-color-danger);
    }
}

.mode-tabs {
    display: inline-grid;
    grid-template-columns: repeat(2, minmax(6rem, 1fr));
    justify-self: start;
    border: 1px solid var(--k-card-border);
    border-radius: 8px;
    background: color-mix(in srgb, var(--k-card-bg), var(--k-page-bg) 10%);
    padding: 0.2rem;

    button {
        border: 0;
        border-radius: 6px;
        background: transparent;
        color: var(--k-text-light);
        cursor: pointer;
        font-weight: 600;
        padding: 0.55rem 0.95rem;

        &.active {
            background: var(--k-color-primary);
            color: #fff;
        }
    }
}

.workspace {
    display: grid;
    grid-template-columns: minmax(17rem, 22rem) minmax(0, 1fr);
    gap: 1rem;
    min-height: 0;
    height: min(78vh, calc(100vh - 10.5rem));
}

.models-workspace {
    grid-template-columns: 1fr;
    align-content: start;
    overflow-y: auto;
    padding-right: 0.2rem;
}

.provider-panel,
.detail-panel,
.empty-detail {
    min-height: 0;
    border: 1px solid color-mix(in srgb, var(--k-card-border), transparent 15%);
    border-radius: 12px;
    background: var(--k-card-bg);
}

.provider-panel {
    display: grid;
    grid-template-rows: auto auto auto minmax(0, 1fr);
    gap: 0.8rem;
    padding: 0.95rem;
}

.panel-head,
.section-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;

    h2,
    h3 {
        margin: 0;
        font-size: 1rem;
        font-weight: 700;
    }

    span {
        color: var(--k-text-light);
        font-size: 0.8rem;
    }
}

.search-box {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    box-sizing: border-box;
    border: 1px solid var(--k-card-border);
    border-radius: 8px;
    background: color-mix(in srgb, var(--k-card-bg), var(--k-page-bg) 8%);
    height: 2.55rem;
    min-width: 0;
    padding: 0 0.8rem;

    input {
        width: 100%;
        min-width: 0;
        border: 0;
        outline: 0;
        background: transparent;
        color: var(--k-text-dark);
        font-size: 0.9rem;
    }
}

.compact-search {
    min-width: 12rem;
}

.search-icon {
    position: relative;
    width: 0.86rem;
    height: 0.86rem;
    flex: 0 0 auto;
    border: 2px solid var(--k-text-light);
    border-radius: 999px;

    &::after {
        content: '';
        position: absolute;
        right: -0.34rem;
        bottom: -0.23rem;
        width: 0.45rem;
        height: 2px;
        border-radius: 999px;
        background: var(--k-text-light);
        transform: rotate(45deg);
    }
}

.kind-filter-row {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.35rem;

    button {
        border: 0;
        border-radius: 8px;
        background: color-mix(in srgb, var(--k-page-bg), transparent 22%);
        color: var(--k-text-light);
        cursor: pointer;
        font-weight: 600;
        padding: 0.55rem 0.6rem;

        &.active {
            background: color-mix(in srgb, var(--k-color-primary), transparent 88%);
            color: var(--k-color-primary);
        }
    }
}

.provider-list {
    display: grid;
    align-content: start;
    gap: 0.45rem;
    min-height: 0;
    overflow-y: auto;
    padding-right: 0.15rem;
}

.provider-row {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.7rem;
    width: 100%;
    border: 1px solid transparent;
    border-radius: 8px;
    background: transparent;
    color: var(--k-text-dark);
    cursor: pointer;
    padding: 0.62rem;
    text-align: left;

    &:hover {
        border-color: color-mix(in srgb, var(--k-color-primary), transparent 82%);
        background: color-mix(in srgb, var(--k-color-primary), transparent 96%);
    }

    &.active {
        border-color: color-mix(in srgb, var(--k-color-primary), transparent 62%);
        background: color-mix(in srgb, var(--k-color-primary), transparent 92%);
    }
}

.provider-copy {
    display: grid;
    gap: 0.12rem;
    min-width: 0;

    strong,
    small {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    small {
        color: var(--k-text-light);
    }
}

.provider-icon {
    position: relative;
    display: grid;
    place-items: center;
    overflow: hidden;
    width: 2.45rem;
    height: 2.45rem;
    border-radius: 8px;
    background: color-mix(in srgb, var(--k-card-bg), var(--k-color-divider) 28%);

    &.large {
        width: 3.25rem;
        height: 3.25rem;
    }

    img,
    span {
        grid-area: 1 / 1;
    }

    img {
        width: 78%;
        height: 78%;
        object-fit: contain;
    }

    span {
        color: var(--k-text-light);
        font-weight: 700;
    }
}

.status-dot {
    width: 0.62rem;
    height: 0.62rem;
    border-radius: 999px;
    background: var(--k-text-light);

    &[data-status='loaded'] {
        background: var(--el-color-success);
    }

    &[data-status='configured'] {
        background: var(--k-color-primary);
    }

    &[data-status='error'],
    &[data-status='missing-key'] {
        background: var(--el-color-danger);
    }
}

.detail-panel {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    overflow: hidden;
}

.detail-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    border-bottom: 1px solid var(--k-card-border);
    padding: 1rem;
}

.detail-title {
    display: flex;
    align-items: center;
    gap: 0.8rem;
    min-width: 0;

    div {
        display: grid;
        gap: 0.12rem;
        min-width: 0;
    }

    strong,
    small {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    strong {
        font-size: 1.05rem;
        font-weight: 700;
    }

    small {
        color: var(--k-text-light);
    }
}

.detail-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 0.5rem;
}

.status-pill {
    border-radius: 8px;
    background: color-mix(in srgb, var(--k-color-primary), transparent 86%);
    color: var(--k-color-primary);
    font-size: 0.78rem;
    font-weight: 650;
    padding: 0.34rem 0.62rem;
    white-space: nowrap;

    &[data-status='loaded'] {
        background: color-mix(in srgb, var(--el-color-success), transparent 86%);
        color: var(--el-color-success);
    }

    &[data-status='error'],
    &[data-status='missing-key'] {
        background: color-mix(in srgb, var(--el-color-danger), transparent 88%);
        color: var(--el-color-danger);
    }

    &[data-status='disabled'] {
        background: color-mix(in srgb, var(--k-text-light), transparent 86%);
        color: var(--k-text-light);
    }
}

.detail-scroll {
    display: grid;
    align-content: start;
    gap: 1rem;
    min-height: 0;
    overflow-y: auto;
    padding: 1rem;
}

.section {
    display: grid;
    gap: 0.85rem;
    border: 1px solid color-mix(in srgb, var(--k-card-border), transparent 20%);
    border-radius: 10px;
    background: color-mix(in srgb, var(--k-card-bg), var(--k-page-bg) 6%);
    padding: 1rem;
}

.mini-stats {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 0.5rem;

    span {
        border-radius: 8px;
        background: color-mix(in srgb, var(--k-color-divider), transparent 55%);
        padding: 0.28rem 0.48rem;
    }
}

.grid {
    display: grid;
    gap: 0.8rem;

    &.one {
        grid-template-columns: 1fr;
    }

    &.two {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    &.three {
        grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .wide {
        grid-column: 1 / -1;
    }
}

.grid,
.new-provider {
    label {
        display: grid;
        gap: 0.35rem;
        min-width: 0;
    }

    label > span {
        color: var(--k-text-light);
        font-size: 0.82rem;
        font-weight: 600;
    }
}

.slider-field {
    min-width: 0;
}

.switch-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;

    &.compact {
        grid-template-columns: 1fr;
    }

    label {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        min-width: 0;
        border: 1px solid color-mix(in srgb, var(--k-card-border), transparent 30%);
        border-radius: 8px;
        background: var(--k-card-bg);
        padding: 0.65rem 0.75rem;
    }

    span {
        color: var(--k-text-dark);
        font-weight: 600;
    }
}

.secret-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    border-radius: 8px;
    background: color-mix(in srgb, var(--k-color-divider), transparent 52%);
    color: var(--k-text-light);
    padding: 0.58rem 0.72rem;

    button {
        border: 0;
        background: transparent;
        color: var(--el-color-danger);
        cursor: pointer;
        font-weight: 600;
    }
}

.header-list,
.model-list {
    display: grid;
    gap: 0.75rem;
}

.header-row,
.model-row,
.filter-row {
    display: grid;
    gap: 0.65rem;
    align-items: center;
    border: 1px solid color-mix(in srgb, var(--k-card-border), transparent 25%);
    border-radius: 8px;
    background: var(--k-card-bg);
    padding: 0.75rem;
}

.header-row {
    grid-template-columns: minmax(9rem, 0.8fr) minmax(12rem, 1.2fr) auto auto;
}

.model-row {
    grid-template-columns:
        minmax(7rem, 0.8fr)
        minmax(10rem, 1.2fr)
        minmax(9rem, 0.9fr)
        minmax(8rem, 0.8fr)
        minmax(12rem, 1.4fr)
        auto;
}

.filter-row {
    grid-template-columns: minmax(8rem, 0.8fr) minmax(12rem, 1fr) auto;
}

.capabilities {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
}

.inline-switch {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    color: var(--k-text-dark);
    font-weight: 600;
}

.model-table {
    display: grid;
    overflow: hidden;
    border: 1px solid var(--k-card-border);
    border-radius: 8px;
    background: var(--k-card-bg);
}

.model-head,
.model-row-view {
    display: grid;
    grid-template-columns: minmax(12rem, 1.5fr) minmax(8rem, 1fr) 8rem minmax(10rem, 1fr);
    gap: 0.75rem;
    align-items: center;
    border-bottom: 1px solid var(--k-card-border);
    padding: 0.65rem 0.85rem;
}

.model-head {
    color: var(--k-text-light);
    font-size: 0.8rem;
    font-weight: 600;
}

.model-row-view {
    color: var(--k-text-dark);

    strong,
    span {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
}

.empty-text {
    margin: 0;
    color: var(--k-text-light);
    text-align: center;

    &.compact {
        font-size: 0.86rem;
    }
}

.empty-action,
.empty-detail {
    display: grid;
    place-items: center;
    gap: 0.75rem;
    min-height: 9rem;
    border: 1px dashed var(--k-card-border);
    border-radius: 8px;
    background: color-mix(in srgb, var(--k-card-bg), var(--k-page-bg) 10%);
    color: var(--k-text-light);
    cursor: pointer;
}

.error-box {
    overflow: hidden;
    margin: 0;
    border-radius: 8px;
    background: color-mix(in srgb, var(--el-color-danger), transparent 92%);
    color: var(--el-color-danger);
    font-size: 0.82rem;
    padding: 0.55rem 0.7rem;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.dialog-shell {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(18rem, 24rem);
    gap: 1rem;
    min-height: 28rem;
}

.catalog-panel {
    min-width: 0;
}

.dialog-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding-bottom: 1rem;
}

.kind-switch {
    --count: 3;

    position: relative;
    display: grid;
    grid-template-columns: repeat(var(--count), minmax(4rem, 1fr));
    isolation: isolate;
    border-radius: 8px;
    background: color-mix(in srgb, var(--k-color-divider), transparent 52%);
    padding: 0.25rem;

    button {
        border: 0;
        border-radius: 6px;
        background: transparent;
        color: var(--k-text-dark);
        cursor: pointer;
        font-weight: 600;
        line-height: 1;
        padding: 0.6rem 0.75rem;

        &.active {
            color: var(--k-color-primary);
        }
    }
}

.preset-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(8.6rem, 1fr));
    gap: 0.85rem;
    max-height: 52vh;
    overflow-y: auto;
    padding-right: 0.25rem;
}

.preset-card {
    display: grid;
    justify-items: center;
    align-content: center;
    gap: 0.6rem;
    min-height: 8.8rem;
    border: 1px solid color-mix(in srgb, var(--k-card-border), transparent 20%);
    border-radius: 12px;
    background: color-mix(in srgb, var(--k-card-bg), var(--k-page-bg) 4%);
    color: var(--k-text-dark);
    cursor: pointer;
    padding: 0.9rem;

    &.selected {
        border-color: var(--k-color-primary);
        box-shadow: 0 10px 24px color-mix(in srgb, var(--k-color-primary) 10%, transparent);
    }

    > strong,
    > small {
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    > small {
        color: var(--k-text-light);
    }
}

.new-provider {
    display: grid;
    align-content: start;
    gap: 0.75rem;
    border: 1px solid var(--k-card-border);
    border-radius: 10px;
    background: var(--k-card-bg);
    padding: 1rem;
}

@media (max-width: 1180px) {
    .workspace,
    .dialog-shell {
        grid-template-columns: 1fr;
        height: auto;
        min-height: 0;
    }

    .provider-list {
        max-height: 20rem;
    }

    .new-provider {
        order: -1;
    }
}

@media (max-width: 900px) {
    .header-bar,
    .section-head,
    .panel-head,
    .dialog-toolbar,
    .detail-head {
        align-items: stretch;
        flex-direction: column;
    }

    .grid.two,
    .grid.three,
    .switch-grid,
    .model-row,
    .filter-row,
    .header-row,
    .model-head,
    .model-row-view {
        grid-template-columns: 1fr;
    }

    .model-hub-main {
        height: calc(100vh - 6rem);
    }

}

/* ==========================================
   NEXT-Style UI Refinements & Animations
   ========================================== */

// --- 1. Global / All-Mode Smooth Transitions ---
.model-hub-page {
    // Basic transitions
    transition: background-color 0.3s ease, color 0.3s ease;

    button,
    .provider-row,
    .preset-card,
    .model-row-view,
    .section,
    .provider-panel,
    .detail-panel,
    .empty-detail,
    .search-box,
    .status-dot,
    .status-pill,
    .mode-tabs button,
    .el-button,
    .el-input__inner,
    .el-switch {
        transition: 
            color 0.22s cubic-bezier(0.16, 1, 0.3, 1),
            background 0.22s cubic-bezier(0.16, 1, 0.3, 1),
            border-color 0.22s cubic-bezier(0.16, 1, 0.3, 1),
            box-shadow 0.22s cubic-bezier(0.16, 1, 0.3, 1),
            transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1),
            opacity 0.22s cubic-bezier(0.16, 1, 0.3, 1);
    }

    // Interactive button hover scaling
    .el-button:hover:not(.is-disabled) {
        transform: translateY(-1px);
        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
    }
    .el-button:active:not(.is-disabled) {
        transform: translateY(0);
    }
}

// --- 2. Polished Mode (精致模式) Styling ---
.model-hub-page.market-mode-polished {
    --market-polished-ease: cubic-bezier(0.16, 1, 0.3, 1);
    --market-polished-ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
    --market-polished-shadow: 0 4px 12px rgba(0, 0, 0, 0.03), 0 1px 2px rgba(0, 0, 0, 0.02), inset 0 1px 0 rgba(255, 255, 255, 0.08);
    --market-polished-shadow-glow: 0 16px 32px rgba(0, 0, 0, 0.08), 0 4px 10px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.12);
    --market-polished-glass: color-mix(in srgb, var(--k-card-bg) 55%, transparent);
    --market-polished-glass-hover: color-mix(in srgb, var(--k-card-bg) 70%, transparent);
    --market-polished-line: color-mix(in srgb, var(--k-color-primary) 12%, var(--k-card-border));

    // Dynamic background glow
    .model-hub-main {
        position: relative;
        background-color: var(--k-page-bg, var(--k-bg-darker)) !important;
        background-image: radial-gradient(color-mix(in srgb, var(--fg1) 6%, transparent) 1px, transparent 1px) !important;
        background-size: 20px 20px !important;
        overflow-x: hidden;
        z-index: 1;

        &::before {
            content: '';
            position: absolute;
            inset: -15%;
            background:
                radial-gradient(circle at 15% 20%, color-mix(in srgb, var(--k-color-primary) 16%, transparent) 0%, transparent 40%),
                radial-gradient(circle at 85% 75%, color-mix(in srgb, var(--k-color-success) 12%, transparent) 0%, transparent 40%),
                radial-gradient(circle at 50% 30%, color-mix(in srgb, var(--k-color-warning) 8%, transparent) 0%, transparent 35%);
            pointer-events: none;
            z-index: 0;
            opacity: 0.65;
            animation: polished-bg-drift 32s infinite alternate ease-in-out;
            will-change: transform;
        }

        // Place all components above the background gradient
        .notice, .mode-tabs, .workspace, .models-workspace {
            position: relative;
            z-index: 2;
        }
    }

    // Glassmorphic layout panels
    .provider-panel,
    .detail-panel,
    .empty-detail,
    .new-provider,
    .section {
        border-color: var(--market-polished-line) !important;
        background: var(--market-polished-glass) !important;
        backdrop-filter: blur(14px) saturate(110%);
        box-shadow: var(--market-polished-shadow) !important;
    }

    // Nested sections should have a slightly lighter/glassy look
    .section {
        background: color-mix(in srgb, var(--k-card-bg) 30%, transparent) !important;
        border-color: color-mix(in srgb, var(--k-color-primary) 8%, var(--k-card-border)) !important;
    }

    // Provider List Staggered Entry Animation
    .provider-list .provider-row {
        animation: model-hub-polished-card-enter 0.5s var(--market-polished-ease) both;
        @for $i from 1 through 15 {
            &:nth-child(#{$i}) {
                animation-delay: #{($i - 1) * 0.03}s;
            }
        }
    }

    // Provider Row Active/Hover styling
    .provider-row {
        margin-bottom: 2px;
        border: 1px solid transparent;

        &:hover {
            background: var(--market-polished-glass-hover) !important;
            border-color: color-mix(in srgb, var(--k-color-primary) 20%, transparent) !important;
            transform: translateY(-1px) translateX(2px);
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.03);
        }

        &.active {
            background: color-mix(in srgb, var(--k-color-primary) 12%, transparent) !important;
            border-color: var(--k-color-primary) !important;
            box-shadow: inset 3px 0 0 var(--k-color-primary), 0 4px 12px rgba(0, 0, 0, 0.04) !important;
            transform: translateX(4px);
        }
    }

    // Models tab list items animation
    .model-row-view {
        animation: model-hub-polished-card-enter 0.4s var(--market-polished-ease) both;
        @for $i from 1 through 20 {
            &:nth-child(#{$i}) {
                animation-delay: #{($i - 1) * 0.02}s;
            }
        }
    }

    // Search Box Focus Refinement
    .search-box {
        border-color: var(--market-polished-line);
        background: var(--market-polished-glass);

        &:focus-within {
            border-color: color-mix(in srgb, var(--k-color-primary) 50%, var(--k-color-border));
            background: var(--market-polished-glass-hover);
            box-shadow: 
                0 8px 20px rgba(0, 0, 0, 0.06), 
                0 0 0 2px color-mix(in srgb, var(--k-color-primary) 12%, transparent);
            transform: translateY(-1px);
        }
    }

    // Mode switch tabs refinement
    .mode-tabs {
        border-color: var(--market-polished-line);
        background: var(--market-polished-glass);
        box-shadow: var(--market-polished-shadow);

        button {
            border-radius: 6px;
            transition: all 0.25s var(--market-polished-ease);

            &.active {
                background: var(--k-color-primary);
                box-shadow: 0 4px 10px color-mix(in srgb, var(--k-color-primary) 30%, transparent);
            }

            &:hover:not(.active) {
                background: color-mix(in srgb, var(--k-color-primary) 6%, transparent);
                color: var(--k-text-dark);
            }
        }
    }

    // Presets Dialog Styling
    .preset-card {
        border-color: var(--market-polished-line) !important;
        background: var(--market-polished-glass) !important;
        transition: 
            transform 0.35s var(--market-polished-ease-spring), 
            box-shadow 0.35s var(--market-polished-ease), 
            border-color 0.25s var(--market-polished-ease), 
            background 0.25s var(--market-polished-ease);

        &:hover {
            background: var(--market-polished-glass-hover) !important;
            border-color: var(--k-color-primary) !important;
            transform: translateY(-4px) scale(1.01);
            box-shadow: var(--market-polished-shadow-glow) !important;
        }

        &.selected {
            border-color: var(--k-color-primary) !important;
            background: color-mix(in srgb, var(--k-color-primary) 8%, transparent) !important;
            box-shadow: var(--market-polished-shadow-glow) !important;
            transform: translateY(-2px);
        }
    }

    // Status elements glow
    .status-dot {
        box-shadow: 0 0 0 0 transparent;
        &[data-status='loaded'] {
            box-shadow: 0 0 6px color-mix(in srgb, var(--el-color-success) 50%, transparent);
        }
        &[data-status='configured'] {
            box-shadow: 0 0 6px color-mix(in srgb, var(--k-color-primary) 50%, transparent);
        }
        &[data-status='error'] {
            box-shadow: 0 0 6px color-mix(in srgb, var(--el-color-danger) 50%, transparent);
        }
    }

    .status-pill {
        border-color: transparent !important;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
    }
}

// --- 3. Performance Mode (性能模式) Styling ---
.model-hub-page.market-mode-performance {
    // Solid background, clean borders, minimal shadows
    .model-hub-main {
        background-color: var(--k-page-bg) !important;
    }

    .provider-panel,
    .detail-panel,
    .empty-detail,
    .new-provider,
    .section {
        background-color: var(--k-card-bg) !important;
        border-color: var(--k-card-border) !important;
        box-shadow: none !important;
    }

    .provider-row {
        &:hover {
            background: color-mix(in srgb, var(--k-color-primary) 6%, var(--k-hover-bg, rgba(128, 128, 128, 0.05))) !important;
        }
        &.active {
            background: color-mix(in srgb, var(--k-color-primary) 10%, transparent) !important;
            border-color: var(--k-color-primary) !important;
        }
    }

    .preset-card {
        &:hover {
            border-color: var(--k-color-primary) !important;
            background: color-mix(in srgb, var(--k-color-primary) 4%, transparent) !important;
        }
        &.selected {
            border-color: var(--k-color-primary) !important;
            background: color-mix(in srgb, var(--k-color-primary) 8%, transparent) !important;
        }
    }
}

// --- 4. Animation Keyframes ---
@keyframes polished-bg-drift {
    0% {
        transform: translate(0, 0) scale(1) rotate(0deg);
    }
    50% {
        transform: translate(3%, 4%) scale(1.05) rotate(3deg);
    }
    100% {
        transform: translate(-2%, 2%) scale(0.98) rotate(-2deg);
    }
}

@keyframes model-hub-polished-enter {
    from {
        opacity: 0;
        transform: translateY(12px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

@keyframes model-hub-polished-card-enter {
    from {
        opacity: 0;
        transform: translateY(8px) scale(0.98);
    }
    to {
        opacity: 1;
        transform: translateY(0) scale(1);
    }
}

// --- 5. Panel Fade Transition ---
.panel-fade-enter-active,
.panel-fade-leave-active {
    transition: opacity 0.22s cubic-bezier(0.16, 1, 0.3, 1), transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}
.panel-fade-enter-from {
    opacity: 0;
    transform: translateY(6px);
}
.panel-fade-leave-to {
    opacity: 0;
    transform: translateY(-6px);
}

// --- 6. Form & Layout Aesthetics Refinements ---
.detail-head {
    border-bottom: 1px solid var(--market-polished-line) !important;
    padding: 1.25rem 1.5rem !important;
    background: color-mix(in srgb, var(--k-card-bg) 20%, transparent);
}

.detail-scroll {
    gap: 1.25rem !important;
    padding: 1.5rem !important;
}

.section {
    gap: 1.25rem !important;
    border-radius: 12px !important;
    padding: 1.5rem !important;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02) !important;
}

.section-head {
    border-bottom: 1px solid color-mix(in srgb, var(--k-color-divider) 35%, transparent) !important;
    padding-bottom: 0.75rem !important;
    margin-bottom: 0.25rem !important;
    
    h3 {
        font-size: 1.05rem !important;
        font-weight: 700 !important;
        color: var(--k-text-dark) !important;
        position: relative !important;
        padding-left: 0.75rem !important;
        
        &::before {
            content: '' !important;
            position: absolute !important;
            left: 0 !important;
            top: 15% !important;
            height: 70% !important;
            width: 3px !important;
            border-radius: 4px !important;
            background: var(--k-color-primary) !important;
        }
    }
}

.grid {
    gap: 1.25rem 1rem !important;
    
    label {
        gap: 0.45rem !important;
        
        span {
            color: var(--k-text-light) !important;
            font-size: 0.85rem !important;
            font-weight: 550 !important;
            margin-bottom: 0.15rem !important;
        }
    }
    
    .el-input, .el-select, .el-input-number {
        width: 100% !important;
    }
}

.switch-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    gap: 0.8rem !important;
    
    label {
        border: 1px solid color-mix(in srgb, var(--k-card-border), transparent 30%) !important;
        border-radius: 8px !important;
        background: color-mix(in srgb, var(--k-card-bg) 20%, transparent) !important;
        padding: 0.75rem 1rem !important;
        margin: 0 !important;
        
        &:hover {
            border-color: color-mix(in srgb, var(--k-color-primary) 30%, transparent) !important;
            background: color-mix(in srgb, var(--k-card-bg) 45%, transparent) !important;
        }
        
        span {
            font-size: 0.88rem !important;
            font-weight: 550 !important;
            color: var(--k-text-dark) !important;
        }
    }
}

.header-row {
    grid-template-columns: 1fr 1.2fr auto auto !important;
    gap: 0.75rem !important;
    padding: 0.75rem !important;
    background: color-mix(in srgb, var(--k-card-bg) 15%, transparent) !important;
    border: 1px solid var(--k-card-border) !important;
    
    .el-input {
        width: 100% !important;
    }
}

.slider-field {
    .el-slider {
        margin-top: 0.25rem !important;
        padding: 0 4px !important;
    }
}

// --- 7. NEXT-Style Scrollbars ---
.model-hub-page,
.model-hub-page * {
    scrollbar-width: thin !important;
    scrollbar-color: color-mix(in srgb, var(--k-color-primary, #7c3aed) 38%, var(--fg3, #7f8490)) transparent !important;
}

.model-hub-page::-webkit-scrollbar,
.model-hub-page *::-webkit-scrollbar {
    width: 8px !important;
    height: 8px !important;
}

.model-hub-page::-webkit-scrollbar-track,
.model-hub-page *::-webkit-scrollbar-track {
    background: transparent !important;
}

.model-hub-page::-webkit-scrollbar-thumb,
.model-hub-page *::-webkit-scrollbar-thumb {
    min-height: 32px !important;
    border: 2px solid transparent !important;
    border-radius: 999px !important;
    background: color-mix(in srgb, var(--k-color-primary, #7c3aed) 26%, var(--fg3, #7f8490)) !important;
    background-clip: content-box !important;
}

.model-hub-page::-webkit-scrollbar-thumb:hover,
.model-hub-page *::-webkit-scrollbar-thumb:hover {
    background-color: color-mix(in srgb, var(--k-color-primary, #7c3aed) 55%, var(--fg3, #7f8490)) !important;
}

// --- 8. Add Provider Dialog Aesthetics Redesign ---
:deep(.el-dialog.add-dialog) {
    border-radius: 16px !important;
    overflow: hidden !important;
    border: 1px solid var(--market-polished-line) !important;
    background: color-mix(in srgb, var(--k-card-bg) 85%, transparent) !important;
    backdrop-filter: blur(20px) saturate(120%) !important;
    box-shadow: 0 24px 64px rgba(0, 0, 0, 0.24) !important;
    
    .el-dialog__header {
        border-bottom: 1px solid var(--market-polished-line) !important;
        margin-right: 0 !important;
        padding: 1.25rem 1.5rem !important;
        
        .el-dialog__title {
            font-size: 1.15rem !important;
            font-weight: 700 !important;
            color: var(--k-text-dark) !important;
        }
    }
    
    .el-dialog__body {
        padding: 1.5rem !important;
    }
    
    .el-dialog__footer {
        border-top: 1px solid var(--market-polished-line) !important;
        padding: 1rem 1.5rem !important;
        background: color-mix(in srgb, var(--k-card-bg) 15%, transparent) !important;
    }
}

.dialog-shell {
    display: grid !important;
    grid-template-columns: minmax(0, 1fr) minmax(18rem, 22rem) !important;
    gap: 1.5rem !important;
    min-height: 32rem !important;
}

.dialog-toolbar {
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
    gap: 1.5rem !important;
    margin-bottom: 1.25rem !important;
    padding-bottom: 0 !important;
}

.kind-switch {
    border: 1px solid var(--market-polished-line) !important;
    background: color-mix(in srgb, var(--k-card-bg) 15%, transparent) !important;
    border-radius: 8px !important;
    padding: 0.18rem !important;
    
    button {
        font-size: 0.85rem !important;
        border-radius: 6px !important;
        
        &.active {
            background: var(--k-color-primary) !important;
            color: #fff !important;
            box-shadow: 0 4px 10px color-mix(in srgb, var(--k-color-primary) 30%, transparent) !important;
        }
        
        &:hover:not(.active) {
            background: color-mix(in srgb, var(--k-color-primary) 6%, transparent) !important;
            color: var(--k-text-dark) !important;
        }
    }
}

.preset-grid {
    display: grid !important;
    grid-template-columns: repeat(auto-fill, minmax(9.5rem, 1fr)) !important;
    gap: 1rem !important;
    max-height: 48vh !important;
    overflow-y: auto !important;
    padding-right: 0.25rem !important;
}

.preset-card {
    border: 1px solid var(--market-polished-line) !important;
    border-radius: 14px !important;
    background: color-mix(in srgb, var(--k-card-bg) 30%, transparent) !important;
    backdrop-filter: blur(8px) !important;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02), inset 0 1px 0 rgba(255, 255, 255, 0.05) !important;
    padding: 1.25rem 0.75rem !important;
    min-height: 9.5rem !important;
    
    &:hover {
        background: color-mix(in srgb, var(--k-card-bg) 65%, transparent) !important;
        border-color: var(--k-color-primary) !important;
        transform: translateY(-4px) scale(1.02) !important;
        box-shadow: 0 12px 24px rgba(0, 0, 0, 0.06), 0 0 0 2px color-mix(in srgb, var(--k-color-primary) 20%, transparent), inset 0 1px 0 rgba(255, 255, 255, 0.1) !important;
    }
    
    &.selected {
        border-color: var(--k-color-primary) !important;
        background: color-mix(in srgb, var(--k-color-primary) 8%, var(--k-card-bg)) !important;
        box-shadow: 0 12px 24px rgba(0, 0, 0, 0.08), 0 0 0 3px color-mix(in srgb, var(--k-color-primary) 30%, transparent), inset 0 1px 0 rgba(255, 255, 255, 0.12) !important;
        transform: translateY(-2px) !important;
    }
    
    .provider-icon {
        background: color-mix(in srgb, var(--k-card-bg), var(--k-color-divider) 15%) !important;
        border-radius: 12px !important;
        margin-bottom: 0.5rem !important;
        border: 1px solid var(--market-polished-line) !important;
    }
    
    strong {
        font-size: 0.92rem !important;
        font-weight: 700 !important;
        color: var(--k-text-dark) !important;
        margin-bottom: 0.1rem !important;
    }
    
    small {
        font-size: 0.76rem !important;
        color: var(--k-text-light) !important;
    }
}

.preset-grid .preset-card {
    animation: model-hub-polished-card-enter 0.45s cubic-bezier(0.16, 1, 0.3, 1) both !important;
    @for $i from 1 through 30 {
        &:nth-child(#{$i}) {
            animation-delay: #{($i - 1) * 0.015}s !important;
        }
    }
}

.new-provider {
    border: 1px solid var(--market-polished-line) !important;
    border-radius: 14px !important;
    background: color-mix(in srgb, var(--k-card-bg) 35%, transparent) !important;
    backdrop-filter: blur(14px) saturate(110%) !important;
    box-shadow: var(--market-polished-shadow) !important;
    padding: 1.25rem !important;
    display: flex !important;
    flex-direction: column !important;
    gap: 1.25rem !important;
    
    .detail-title {
        display: flex !important;
        align-items: center !important;
        gap: 0.8rem !important;
        border-bottom: 1px solid var(--market-polished-line) !important;
        padding-bottom: 0.75rem !important;
        margin-bottom: 0.25rem !important;
        
        .provider-icon {
            width: 2.75rem !important;
            height: 2.75rem !important;
            border-radius: 10px !important;
            background: color-mix(in srgb, var(--k-card-bg), var(--k-color-divider) 15%) !important;
            border: 1px solid var(--market-polished-line) !important;
        }
        
        strong {
            font-size: 1rem !important;
            font-weight: 700 !important;
            color: var(--k-text-dark) !important;
        }
        
        small {
            font-size: 0.8rem !important;
            color: var(--k-text-light) !important;
        }
    }
    
    .grid.one {
        gap: 1rem !important;
        
        label {
            display: flex !important;
            flex-direction: column !important;
            gap: 0.45rem !important;
            
            span {
                color: var(--k-text-light) !important;
                font-size: 0.82rem !important;
                font-weight: 550 !important;
                margin-bottom: 0 !important;
            }
        }
        
        .el-input {
            width: 100% !important;
        }
    }
    
    .switch-grid.compact {
        grid-template-columns: 1fr !important;
        gap: 0.65rem !important;
        
        label {
            border: 1px solid color-mix(in srgb, var(--k-card-border), transparent 30%) !important;
            border-radius: 8px !important;
            background: color-mix(in srgb, var(--k-card-bg) 15%, transparent) !important;
            padding: 0.6rem 0.85rem !important;
            margin: 0 !important;
            
            &:hover {
                border-color: color-mix(in srgb, var(--k-color-primary) 25%, transparent) !important;
                background: color-mix(in srgb, var(--k-card-bg) 35%, transparent) !important;
            }
            
            span {
                font-size: 0.84rem !important;
                font-weight: 550 !important;
                color: var(--k-text-dark) !important;
            }
        }
    }
}
</style>
