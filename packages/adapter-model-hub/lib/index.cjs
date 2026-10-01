var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/locales/zh-CN.schema.yml
var require_zh_CN_schema = __commonJS({
  "src/locales/zh-CN.schema.yml"(exports2, module2) {
    module2.exports = { $inner: { webui: "启用独立 WebUI。供应商、模型、请求参数和密钥都在 WebUI 中管理。", frontendMode: "前端显示模式。性能模式保持低动效；精致模式启用更细腻的动效和高级样式。", iconCdn: "LobeHub 图标静态资源地址。", settingsPath: "WebUI 配置文件路径。相对路径会基于 Koishi 实例目录解析。", metadataUrl: "models.dev 模型元数据缓存源。只用于补全上下文大小、模型能力和思考能力，不作为可用模型列表。", metadataCachePath: "模型元数据本地缓存文件路径。相对路径会基于 Koishi 实例目录解析。", metadataUpdateHours: "models.dev 本地缓存定时更新间隔，单位小时。" } };
  }
});

// src/locales/en-US.schema.yml
var require_en_US_schema = __commonJS({
  "src/locales/en-US.schema.yml"(exports2, module2) {
    module2.exports = { $inner: { webui: "Enable the independent Web UI. Providers, models, request parameters, and secrets are managed there.", frontendMode: "Frontend display mode. Performance mode keeps low motion; Polished mode enables finer animation and advanced styles.", iconCdn: "LobeHub icon static asset base URL.", settingsPath: "Web UI settings file path. Relative paths are resolved from the Koishi instance directory.", metadataUrl: "models.dev metadata cache source. It only enriches context size, model capabilities, and reasoning capability, not the available model list.", metadataCachePath: "Local model metadata cache file path. Relative paths are resolved from the Koishi instance directory.", metadataUpdateHours: "models.dev local cache refresh interval in hours." } };
  }
});

// src/index.ts
var index_exports = {};
__export(index_exports, {
  Config: () => Config,
  ModelHubConsoleService: () => ModelHubConsoleService,
  PROVIDER_PRESETS: () => PROVIDER_PRESETS,
  apply: () => apply,
  inject: () => inject,
  logger: () => logger,
  name: () => name,
  reusable: () => reusable,
  usage: () => usage
});
module.exports = __toCommonJS(index_exports);
var import_plugin_console = require("@koishijs/plugin-console");
var import_path4 = require("path");
var import_koishi = require("koishi");
var import_chat = require("koishi-plugin-chatluna/services/chat");
var import_types12 = require("koishi-plugin-chatluna/llm-core/platform/types");
var import_logger = require("koishi-plugin-chatluna/utils/logger");

// src/client.ts
var import_client = require("koishi-plugin-chatluna/llm-core/platform/client");
var import_model = require("koishi-plugin-chatluna/llm-core/platform/model");
var import_rerank = require("koishi-plugin-chatluna/llm-core/platform/rerank");
var import_types9 = require("koishi-plugin-chatluna/llm-core/platform/types");
var import_error6 = require("koishi-plugin-chatluna/utils/error");
var import_v1_shared_adapter11 = require("@chatluna/v1-shared-adapter");

// src/requester.ts
var import_messages7 = require("@langchain/core/messages");
var import_outputs8 = require("@langchain/core/outputs");
var import_api2 = require("koishi-plugin-chatluna/llm-core/platform/api");
var import_v1_shared_adapter9 = require("@chatluna/v1-shared-adapter");
var import_v1_shared_adapter10 = require("@chatluna/v1-shared-adapter");

// src/capabilities.ts
var import_v1_shared_adapter = require("@chatluna/v1-shared-adapter");
var import_types = require("koishi-plugin-chatluna/llm-core/platform/types");
function resolveCapabilities(adapter, model, responseApi = false) {
  responseApi ||= adapter === "openai" && /^gpt-6/i.test(model.name);
  const result = new Set(model.capabilities ?? []);
  if (adapter !== "dify") {
    result.add(import_types.ModelCapabilities.ToolCall);
    if ((0, import_v1_shared_adapter.supportImageInput)(model.name) || /^(gpt-6|kimi-k3)/i.test(model.name))
      result.add(import_types.ModelCapabilities.ImageInput);
    if (/^kimi-k3/i.test(model.name)) result.add(import_types.ModelCapabilities.VideoInput);
    if ((0, import_v1_shared_adapter.supportAudioInput)(model.name)) result.add(import_types.ModelCapabilities.AudioInput);
    if (isThinkingModelName(model.name)) result.add(import_types.ModelCapabilities.Thinking);
  }
  for (const [capability, supported] of Object.entries(
    model.capabilityOverrides ?? {}
  )) {
    if (supported) result.add(capability);
    else result.delete(capability);
  }
  return protocolCapabilities(adapter, [...result], responseApi);
}
__name(resolveCapabilities, "resolveCapabilities");
function protocolCapabilities(adapter, capabilities, responseApi = false) {
  return adapter === "openai" && responseApi ? capabilities.filter(
    (capability) => capability !== import_types.ModelCapabilities.AudioInput && capability !== import_types.ModelCapabilities.VideoInput
  ) : capabilities;
}
__name(protocolCapabilities, "protocolCapabilities");
function isThinkingModelName(model) {
  const lower = model.toLowerCase();
  return ["reasoner", "thinking", "reasoning", "r1"].some(
    (name2) => lower.includes(name2)
  ) || [
    "o1",
    "o3",
    "o4",
    "gpt-5",
    "gpt-6",
    "kimi-k3",
    "glm-5.3",
    "minimax-m3.1"
  ].some((name2) => lower.startsWith(name2));
}
__name(isThinkingModelName, "isThinkingModelName");
var IMAGE_MIMES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
var AUDIO_MIMES = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav"];
function capabilityFileHandling(adapter, capabilities) {
  const mimes = /* @__PURE__ */ new Set();
  if (capabilities.includes(import_types.ModelCapabilities.ImageInput))
    IMAGE_MIMES.forEach((mime) => mimes.add(mime));
  if (capabilities.includes(import_types.ModelCapabilities.AudioInput)) {
    AUDIO_MIMES.forEach((mime) => mimes.add(mime));
    if (adapter === "gemini") {
      ;
      [
        "audio/ogg",
        "audio/flac",
        "audio/aac",
        "audio/mp4",
        "audio/webm"
      ].forEach((mime) => mimes.add(mime));
    }
  }
  if (capabilities.includes(import_types.ModelCapabilities.VideoInput)) {
    ;
    ["video/mp4", "video/quicktime", "video/webm", "video/mpeg"].forEach(
      (mime) => mimes.add(mime)
    );
  }
  if (capabilities.includes(import_types.ModelCapabilities.FileInput)) mimes.add("application/pdf");
  if (!mimes.size) return void 0;
  const limit = (adapter === "gemini" ? 14 : 20) * 1024 * 1024;
  return {
    supportedMimeTypes: mimes,
    maxTotalSizeBytes: limit,
    maxFileSizeBytes: limit
  };
}
__name(capabilityFileHandling, "capabilityFileHandling");
async function prepareCapabilityParams(params, capabilities, adapter, plugin, responseApi = false) {
  if (!capabilities) return params;
  const native = adapter === "gemini" || adapter === "anthropic" || adapter === "dify";
  const input = await Promise.all(
    params.input.map(async (message) => {
      if (!Array.isArray(message.content)) return message;
      const content = [];
      for (const part of message.content) {
        const capability = {
          image_url: import_types.ModelCapabilities.ImageInput,
          input_image: import_types.ModelCapabilities.ImageInput,
          audio_url: import_types.ModelCapabilities.AudioInput,
          input_audio: import_types.ModelCapabilities.AudioInput,
          video_url: import_types.ModelCapabilities.VideoInput,
          file_url: import_types.ModelCapabilities.FileInput,
          file: import_types.ModelCapabilities.FileInput
        }[part.type];
        if (capability && !capabilities.includes(capability)) continue;
        if (!native && part.type === "audio_url") {
          const file2 = await (0, import_v1_shared_adapter.fetchFileLikeUrl)(plugin, part);
          const format = {
            "audio/mpeg": "mp3",
            "audio/mp3": "mp3",
            "audio/wav": "wav",
            "audio/x-wav": "wav"
          }[file2.mimeType.toLowerCase()];
          if (!format)
            throw new Error(
              `Unsupported OpenAI audio input MIME: ${file2.mimeType}`
            );
          content.push({
            type: "input_audio",
            input_audio: {
              data: file2.buffer.toString("base64"),
              format
            }
          });
        } else if (!native && !responseApi && part.type === "file_url") {
          const file2 = await (0, import_v1_shared_adapter.fetchFileLikeUrl)(plugin, part);
          content.push({
            type: "file",
            file: {
              filename: "attachment.pdf",
              file_data: `data:${file2.mimeType};base64,${file2.buffer.toString("base64")}`
            }
          });
        } else content.push(part);
      }
      return Object.assign(
        Object.create(Object.getPrototypeOf(message)),
        message,
        { content }
      );
    })
  );
  const overrides = { ...params.overrideRequestParams };
  if (!capabilities.includes(import_types.ModelCapabilities.ToolCall)) {
    delete overrides.tools;
    delete overrides.tool_choice;
    delete overrides.parallel_tool_calls;
  }
  return {
    ...params,
    input,
    tools: capabilities.includes(import_types.ModelCapabilities.ToolCall) ? params.tools : void 0,
    overrideRequestParams: overrides
  };
}
__name(prepareCapabilityParams, "prepareCapabilityParams");

// src/providers/helpers.ts
var import_types2 = require("koishi-plugin-chatluna/llm-core/platform/types");
var DEFAULT_ICON_CDN = "https://cdn.jsdelivr.net/npm/@lobehub/icons-static-svg@latest/icons";
var tool = import_types2.ModelCapabilities.ToolCall;
var image = import_types2.ModelCapabilities.ImageInput;
var audio = import_types2.ModelCapabilities.AudioInput;
var thinking = import_types2.ModelCapabilities.Thinking;
var video = import_types2.ModelCapabilities.VideoInput;
var file = import_types2.ModelCapabilities.FileInput;
function openAIChatProvider(preset) {
  return {
    ...preset,
    adapter: "openai-chat"
  };
}
__name(openAIChatProvider, "openAIChatProvider");
function openAIProvider(preset) {
  return {
    ...preset,
    adapter: "openai"
  };
}
__name(openAIProvider, "openAIProvider");
function geminiProvider(preset) {
  return {
    ...preset,
    adapter: "gemini"
  };
}
__name(geminiProvider, "geminiProvider");
function difyProvider(preset) {
  return {
    ...preset,
    adapter: "dify"
  };
}
__name(difyProvider, "difyProvider");
function anthropicProvider(preset) {
  return {
    ...preset,
    adapter: "anthropic"
  };
}
__name(anthropicProvider, "anthropicProvider");

// src/providers/openai-compatible.ts
var openai_compatible_default = openAIChatProvider({
  id: "openai-compatible",
  name: "自定义 OpenAI-compatible",
  icon: "openai",
  kind: "cloud",
  defaultPlatform: "hub-openai-compatible",
  defaultEndpoint: "https://api.example.com/v1",
  website: "",
  reasoningEffort: "passthrough",
  models: []
});

// src/providers/openai.ts
var openai_default = openAIProvider({
  id: "openai",
  name: "OpenAI",
  icon: "openai",
  kind: "cloud",
  defaultPlatform: "hub-openai",
  defaultEndpoint: "https://api.openai.com/v1",
  website: "https://platform.openai.com",
  reasoningEffort: "passthrough",
  models: []
});

// src/providers/gemini.ts
var gemini_default = geminiProvider({
  id: "gemini",
  name: "Google Gemini",
  icon: "gemini",
  kind: "cloud",
  defaultPlatform: "hub-gemini",
  defaultEndpoint: "https://generativelanguage.googleapis.com/v1beta",
  website: "https://ai.google.dev/gemini-api",
  reasoningEffort: "passthrough",
  models: []
});

// src/providers/anthropic.ts
var anthropic_default = anthropicProvider({
  id: "anthropic",
  name: "Anthropic",
  icon: "anthropic",
  kind: "cloud",
  defaultPlatform: "hub-anthropic",
  defaultEndpoint: "https://api.anthropic.com/v1",
  website: "https://www.anthropic.com",
  reasoningEffort: "passthrough",
  models: []
});

// src/providers/openrouter.ts
var openrouter_default = openAIChatProvider({
  id: "openrouter",
  name: "OpenRouter",
  icon: "openrouter",
  kind: "cloud",
  defaultPlatform: "hub-openrouter",
  defaultEndpoint: "https://openrouter.ai/api/v1",
  website: "https://openrouter.ai",
  reasoningEffort: "passthrough",
  models: []
});

// src/providers/deepseek.ts
var deepseek_default = openAIChatProvider({
  id: "deepseek",
  name: "DeepSeek",
  icon: "deepseek",
  kind: "cloud",
  defaultPlatform: "hub-deepseek",
  defaultEndpoint: "https://api.deepseek.com",
  website: "https://platform.deepseek.com",
  reasoningEffort: "deepseek",
  models: [],
  patchCompletionBody(body, model) {
    const lower = model.toLowerCase();
    if (lower.includes("reasoner") || lower.includes("r1")) {
      delete body.temperature;
      delete body.presence_penalty;
      delete body.frequency_penalty;
      delete body.top_p;
    }
  }
});

// src/providers/qwen.ts
var qwen_default = openAIChatProvider({
  id: "qwen",
  name: "Qwen",
  icon: "qwen",
  kind: "cloud",
  defaultPlatform: "hub-qwen",
  defaultEndpoint: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  website: "https://dashscope.aliyun.com",
  reasoningEffort: "qwen",
  models: []
});

// src/providers/zhipu.ts
var zhipu_default = openAIChatProvider({
  id: "zhipu",
  name: "Zhipu AI",
  icon: "zhipu",
  kind: "cloud",
  defaultPlatform: "hub-zhipu",
  defaultEndpoint: "https://open.bigmodel.cn/api/paas/v4",
  website: "https://open.bigmodel.cn",
  reasoningEffort: "passthrough",
  models: []
});

// src/providers/moonshot.ts
var moonshot_default = openAIChatProvider({
  id: "moonshot",
  name: "Moonshot AI",
  icon: "moonshot",
  kind: "cloud",
  defaultPlatform: "hub-moonshot",
  defaultEndpoint: "https://api.moonshot.cn/v1",
  website: "https://platform.moonshot.cn",
  reasoningEffort: "passthrough",
  models: []
});

// src/providers/siliconflow.ts
var siliconflow_default = openAIChatProvider({
  id: "siliconflow",
  name: "SiliconFlow",
  icon: "siliconcloud",
  kind: "cloud",
  defaultPlatform: "hub-siliconflow",
  defaultEndpoint: "https://api.siliconflow.cn/v1",
  website: "https://siliconflow.cn",
  reasoningEffort: "passthrough",
  models: []
});

// src/providers/groq.ts
var groq_default = openAIChatProvider({
  id: "groq",
  name: "Groq",
  icon: "groq",
  kind: "cloud",
  defaultPlatform: "hub-groq",
  defaultEndpoint: "https://api.groq.com/openai/v1",
  website: "https://console.groq.com",
  reasoningEffort: "passthrough",
  models: []
});

// src/providers/mistral.ts
var mistral_default = openAIChatProvider({
  id: "mistral",
  name: "Mistral AI",
  icon: "mistral",
  kind: "cloud",
  defaultPlatform: "hub-mistral",
  defaultEndpoint: "https://api.mistral.ai/v1",
  website: "https://console.mistral.ai",
  models: []
});

// src/providers/together.ts
var together_default = openAIChatProvider({
  id: "together",
  name: "Together AI",
  icon: "together",
  kind: "cloud",
  defaultPlatform: "hub-together",
  defaultEndpoint: "https://api.together.ai/v1",
  website: "https://docs.together.ai",
  reasoningEffort: "passthrough",
  models: []
});

// src/providers/xai.ts
var xai_default = openAIProvider({
  id: "xai",
  name: "xAI",
  icon: "xai",
  kind: "cloud",
  defaultPlatform: "hub-xai",
  defaultEndpoint: "https://api.x.ai/v1",
  website: "https://console.x.ai",
  reasoningEffort: "passthrough",
  models: []
});

// src/providers/minimax.ts
var minimax_default = openAIChatProvider({
  id: "minimax",
  name: "MiniMax",
  icon: "minimax",
  kind: "cloud",
  defaultPlatform: "hub-minimax",
  defaultEndpoint: "https://api.minimax.io/v1",
  website: "https://platform.minimax.io",
  reasoningEffort: "passthrough",
  models: []
});

// src/providers/stepfun.ts
var stepfun_default = openAIChatProvider({
  id: "stepfun",
  name: "StepFun",
  icon: "stepfun",
  kind: "cloud",
  defaultPlatform: "hub-stepfun",
  defaultEndpoint: "https://api.stepfun.com/v1",
  website: "https://platform.stepfun.com",
  reasoningEffort: "passthrough",
  models: []
});

// src/providers/yi.ts
var yi_default = openAIChatProvider({
  id: "yi",
  name: "01.AI",
  icon: "yi",
  kind: "cloud",
  defaultPlatform: "hub-yi",
  defaultEndpoint: "https://api.lingyiwanwu.com/v1",
  website: "https://platform.lingyiwanwu.com",
  models: []
});

// src/providers/baichuan.ts
var baichuan_default = openAIChatProvider({
  id: "baichuan",
  name: "Baichuan",
  icon: "baichuan",
  kind: "cloud",
  defaultPlatform: "hub-baichuan",
  defaultEndpoint: "https://api.baichuan-ai.com/v1",
  website: "https://platform.baichuan-ai.com",
  models: []
});

// src/providers/newapi.ts
var newapi_default = openAIChatProvider({
  id: "newapi",
  name: "New API",
  icon: "newapi",
  kind: "local",
  defaultPlatform: "hub-newapi",
  defaultEndpoint: "http://127.0.0.1:3000/v1",
  website: "https://github.com/QuantumNous/new-api",
  allowEmptyApiKey: true,
  reasoningEffort: "passthrough",
  models: []
});

// src/providers/ollama.ts
var ollama_default = openAIChatProvider({
  id: "ollama",
  name: "Ollama",
  icon: "ollama",
  kind: "local",
  defaultPlatform: "hub-ollama",
  defaultEndpoint: "http://127.0.0.1:11434/v1",
  website: "https://ollama.com",
  allowEmptyApiKey: true,
  models: []
});

// src/providers/lmstudio.ts
var lmstudio_default = openAIChatProvider({
  id: "lmstudio",
  name: "LM Studio",
  icon: "lmstudio",
  kind: "local",
  defaultPlatform: "hub-lmstudio",
  defaultEndpoint: "http://127.0.0.1:1234/v1",
  website: "https://lmstudio.ai",
  allowEmptyApiKey: true,
  models: []
});

// src/providers/vllm.ts
var vllm_default = openAIChatProvider({
  id: "vllm",
  name: "vLLM",
  icon: "vllm",
  kind: "local",
  defaultPlatform: "hub-vllm",
  defaultEndpoint: "http://127.0.0.1:8000/v1",
  website: "https://docs.vllm.ai",
  allowEmptyApiKey: true,
  models: []
});

// src/providers/llamacpp.ts
var llamacpp_default = openAIChatProvider({
  id: "llamacpp",
  name: "llama.cpp",
  icon: "openai",
  kind: "local",
  defaultPlatform: "hub-llamacpp",
  defaultEndpoint: "http://127.0.0.1:8080/v1",
  website: "https://github.com/ggml-org/llama.cpp",
  allowEmptyApiKey: true,
  models: []
});

// src/providers/xinference.ts
var xinference_default = openAIChatProvider({
  id: "xinference",
  name: "Xinference",
  icon: "xinference",
  kind: "local",
  defaultPlatform: "hub-xinference",
  defaultEndpoint: "http://127.0.0.1:9997/v1",
  website: "https://inference.readthedocs.io",
  allowEmptyApiKey: true,
  models: []
});

// src/providers/localai.ts
var localai_default = openAIChatProvider({
  id: "localai",
  name: "LocalAI",
  icon: "openai",
  kind: "local",
  defaultPlatform: "hub-localai",
  defaultEndpoint: "http://127.0.0.1:8080/v1",
  website: "https://localai.io",
  allowEmptyApiKey: true,
  models: []
});

// src/providers/dify.ts
var dify_default = difyProvider({
  id: "dify",
  name: "Dify",
  icon: "dify",
  kind: "cloud",
  defaultPlatform: "hub-dify",
  defaultEndpoint: "https://api.dify.ai/v1",
  website: "https://dify.ai",
  models: []
});

// src/providers/modelscope.ts
var modelscope_default = openAIChatProvider({
  id: "modelscope",
  name: "ModelScope 魔搭",
  icon: "modelscope",
  kind: "cloud",
  defaultPlatform: "hub-modelscope",
  defaultEndpoint: "https://api-inference.modelscope.cn/v1",
  website: "https://www.modelscope.cn",
  reasoningEffort: "passthrough",
  models: [],
  patchEmbeddingsBody(body) {
    body.encoding_format ??= "float";
  }
});

// src/providers/index.ts
var PROVIDER_PRESETS = [
  openai_compatible_default,
  openai_default,
  gemini_default,
  anthropic_default,
  openrouter_default,
  deepseek_default,
  qwen_default,
  zhipu_default,
  moonshot_default,
  siliconflow_default,
  modelscope_default,
  dify_default,
  groq_default,
  mistral_default,
  together_default,
  xai_default,
  minimax_default,
  stepfun_default,
  yi_default,
  baichuan_default,
  newapi_default,
  ollama_default,
  lmstudio_default,
  vllm_default,
  llamacpp_default,
  xinference_default,
  localai_default
];
var providerMap = new Map(PROVIDER_PRESETS.map((item) => [item.id, item]));
var DEFAULT_PROVIDER_CONFIGS = [
  "openai",
  "gemini",
  "anthropic",
  "openrouter",
  "deepseek",
  "qwen",
  "siliconflow",
  "groq"
].map((id) => {
  const preset = getProviderPreset(id);
  return {
    provider: preset.id,
    platform: preset.defaultPlatform,
    apiKey: "",
    apiEndpoint: preset.defaultEndpoint,
    enabled: true,
    pullModels: true,
    customHeaders: [],
    chatConcurrentMaxSize: 3,
    chatTimeLimit: 200,
    configMode: "default",
    maxRetries: 5,
    timeout: 3e5,
    proxyMode: "system",
    proxyAddress: "",
    maxContextRatio: 0.35,
    temperature: 1,
    presencePenalty: 0,
    frequencyPenalty: 0,
    nonStreaming: false,
    expandReasoningVariants: false,
    nonLlmInputTokenLimit: 8192,
    reasoningProtocol: preset.id === "openrouter" ? "openrouter" : "openai",
    anthropicPromptCache: false,
    anthropicPromptCacheTtl: "5m"
  };
});
function normalizeId(value, fallback = "custom") {
  const normalized = (value ?? fallback).trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized || fallback;
}
__name(normalizeId, "normalizeId");
function normalizePlatformName(value, fallback) {
  return normalizeId(value, fallback);
}
__name(normalizePlatformName, "normalizePlatformName");
function getProviderPreset(id) {
  const normalized = normalizeId(id);
  const preset = providerMap.get(normalized);
  if (preset) return preset;
  return {
    id: normalized,
    name: id?.trim() || "Custom Provider",
    icon: normalized,
    kind: "cloud",
    adapter: "openai-chat",
    defaultPlatform: `hub-${normalized}`,
    defaultEndpoint: "",
    website: "",
    models: []
  };
}
__name(getProviderPreset, "getProviderPreset");
function getEndpoint(entry, preset) {
  return (entry.apiEndpoint || preset.defaultEndpoint || "").trim();
}
__name(getEndpoint, "getEndpoint");
function targetMatches(target, platform, provider) {
  const normalized = normalizeId(target, "*");
  return normalized === "*" || normalized === normalizeId(platform) || normalized === normalizeId(provider);
}
__name(targetMatches, "targetMatches");
function resolveRuntimeProviders(entries) {
  const groups = /* @__PURE__ */ new Map();
  for (const [configIndex, entry] of (entries ?? []).entries()) {
    const preset = getProviderPreset(entry.provider);
    const requestedPlatform = normalizePlatformName(
      entry.platform,
      preset.defaultPlatform
    );
    const configSignature = runtimeConfigSignature(entry, preset);
    const platform = resolveRuntimePlatform(
      groups,
      requestedPlatform,
      preset,
      configSignature
    );
    const apiKey = entry.apiKey?.trim() ?? "";
    const apiEndpoint = getEndpoint(entry, preset);
    if (entry.enabled === false) continue;
    if (apiKey.length < 1 && !preset.allowEmptyApiKey) continue;
    if (apiEndpoint.length < 1) continue;
    let group = groups.get(platform);
    if (group == null) {
      group = {
        provider: preset,
        adapter: preset.adapter,
        platform,
        configSignature,
        entries: []
      };
      groups.set(platform, group);
    }
    group.entries.push({
      ...entry,
      apiKey,
      apiEndpoint,
      provider: preset.id,
      providerName: entry.name?.trim() || preset.name,
      icon: preset.icon,
      platform,
      configIndex,
      enabled: true,
      pullModels: entry.pullModels === true
    });
  }
  return [...groups.values()];
}
__name(resolveRuntimeProviders, "resolveRuntimeProviders");
function resolveRuntimePlatform(groups, requestedPlatform, preset, configSignature) {
  const existing = groups.get(requestedPlatform);
  if (existing == null || existing.provider.id === preset.id && canShareRuntimeProvider(existing, configSignature)) {
    return requestedPlatform;
  }
  const base = `${requestedPlatform}-${preset.id}`;
  let next = base;
  let index = 2;
  while (true) {
    const group = groups.get(next);
    if (group == null || group.provider.id === preset.id && canShareRuntimeProvider(group, configSignature)) {
      return next;
    }
    next = `${base}-${index++}`;
  }
}
__name(resolveRuntimePlatform, "resolveRuntimePlatform");
function canShareRuntimeProvider(group, configSignature) {
  if (group.provider.adapter === "dify") return true;
  return group.configSignature === configSignature;
}
__name(canShareRuntimeProvider, "canShareRuntimeProvider");
function runtimeConfigSignature(entry, preset) {
  if (preset.adapter === "dify") return "dify-apps";
  return stableStringify({
    provider: preset.id,
    adapter: preset.adapter,
    apiEndpoint: getEndpoint(entry, preset),
    pullModels: entry.pullModels === true,
    customHeaders: (entry.customHeaders ?? []).map((header) => ({
      target: normalizeId(header.target, "*"),
      name: header.name?.trim().toLowerCase() ?? "",
      value: header.value ?? ""
    })),
    chatConcurrentMaxSize: entry.chatConcurrentMaxSize,
    chatTimeLimit: entry.chatTimeLimit,
    configMode: entry.configMode,
    maxRetries: entry.maxRetries,
    timeout: entry.timeout,
    proxyMode: entry.proxyMode,
    proxyAddress: entry.proxyAddress,
    maxContextRatio: entry.maxContextRatio,
    temperature: entry.temperature,
    presencePenalty: entry.presencePenalty,
    frequencyPenalty: entry.frequencyPenalty,
    nonStreaming: entry.nonStreaming === true,
    expandReasoningVariants: entry.expandReasoningVariants === true,
    nonLlmInputTokenLimit: entry.nonLlmInputTokenLimit,
    reasoningProtocol: entry.reasoningProtocol ?? "openai",
    responseApi: entry.responseApi === true,
    responseBuiltinTools: entry.responseBuiltinTools ?? [],
    responseBuiltinToolSupportModel: entry.responseBuiltinToolSupportModel ?? [],
    responseFileSearchVectorStoreIds: entry.responseFileSearchVectorStoreIds ?? [],
    googleSearch: entry.googleSearch === true,
    agenticVideo: entry.agenticVideo === true,
    useCamelCaseMediaFields: entry.useCamelCaseMediaFields === true,
    codeExecution: entry.codeExecution === true,
    urlContext: entry.urlContext === true,
    imageGeneration: entry.imageGeneration === true,
    thinkingBudget: entry.thinkingBudget,
    includeThoughts: entry.includeThoughts === true,
    groundingContentDisplay: entry.groundingContentDisplay === true,
    anthropicPromptCache: entry.anthropicPromptCache === true,
    anthropicPromptCacheTtl: entry.anthropicPromptCacheTtl
  });
}
__name(runtimeConfigSignature, "runtimeConfigSignature");
function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value != null && typeof value === "object") {
    return `{${Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(
      ([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`
    ).join(",")}}`;
  }
  return JSON.stringify(value);
}
__name(stableStringify, "stableStringify");
function getTargetedAdditionalModels(models, platform, provider) {
  return (models ?? []).filter(
    (item) => item.model?.trim().length > 0 && targetMatches(item.target, platform, provider)
  );
}
__name(getTargetedAdditionalModels, "getTargetedAdditionalModels");
function getTargetedBlacklist(filters, platform, provider) {
  return (filters ?? []).filter((item) => targetMatches(item.target, platform, provider)).map((item) => item.keyword?.trim().toLowerCase()).filter(Boolean);
}
__name(getTargetedBlacklist, "getTargetedBlacklist");

// src/adapters/openai-chat.ts
var import_outputs2 = require("@langchain/core/outputs");
var import_messages2 = require("@langchain/core/messages");
var import_v1_shared_adapter3 = require("@chatluna/v1-shared-adapter");
var import_sse = require("koishi-plugin-chatluna/utils/sse");
var import_types4 = require("koishi-plugin-chatluna/llm-core/platform/types");

// src/adapters/model-list.ts
var import_v1_shared_adapter2 = require("@chatluna/v1-shared-adapter");
var import_types3 = require("koishi-plugin-chatluna/llm-core/platform/types");

// src/adapters/reasoning-protocols.ts
function applyReasoningProtocol(protocol, body, model) {
  if (protocol === "openai") {
    validateNativeReasoningEffort(body, model);
    return;
  }
  const effort = body.reasoning_effort;
  if (effort == null) return;
  delete body.reasoning_effort;
  if (protocol === "deepseek") {
    applyDeepSeekReasoning(body, effort);
    return;
  }
  if (protocol === "qwen") {
    applyQwenReasoning(body, effort);
    return;
  }
  if (protocol === "gemini") {
    applyGeminiReasoning(body, model, effort);
    return;
  }
  if (protocol === "anthropic") {
    applyAnthropicReasoning(body, model, effort);
    return;
  }
  if (protocol === "openrouter") {
    applyOpenRouterReasoning(body, effort);
  }
}
__name(applyReasoningProtocol, "applyReasoningProtocol");
function resolveReasoningProtocol(configured, model) {
  if (configured == null || configured === "openai") return "openai";
  if (configured !== "auto") return configured;
  const lower = model.toLowerCase();
  if (lower.includes("deepseek")) return "deepseek";
  if (lower.includes("qwen") || lower.includes("qwq")) return "qwen";
  if (lower.includes("gemini") || lower.includes("gemma")) return "gemini";
  if (lower.includes("claude")) return "anthropic";
  return "openai";
}
__name(resolveReasoningProtocol, "resolveReasoningProtocol");
function normalizeDeepSeekReasoningEffort(effort) {
  const normalized = normalizeReasoningEffort(effort);
  if (normalized === "none" || normalized === "max") return normalized;
  if (normalized === "minimal" || normalized === "low") return "low";
  if (normalized != null) return "high";
}
__name(normalizeDeepSeekReasoningEffort, "normalizeDeepSeekReasoningEffort");
function qwenThinkingBudgetForEffort(effort) {
  const normalized = normalizeReasoningEffort(effort);
  if (normalized === "none") return 0;
  if (normalized === "minimal") return 512;
  if (normalized === "low") return 1024;
  if (normalized === "medium") return 4096;
  if (normalized === "high") return 8192;
  if (normalized === "xhigh" || normalized === "max") return 16384;
}
__name(qwenThinkingBudgetForEffort, "qwenThinkingBudgetForEffort");
function geminiThinkingConfig(model, effort) {
  if (isGemini3CompatibleModel(model)) {
    return {
      thinking_level: geminiThinkingLevel(effort),
      ...normalizeReasoningEffort(effort) === "none" ? { include_thoughts: false } : {}
    };
  }
  return {
    thinking_budget: geminiThinkingBudget(effort)
  };
}
__name(geminiThinkingConfig, "geminiThinkingConfig");
function anthropicThinkingConfig(effort, model = "", maxTokens = 4096) {
  const normalized = normalizeReasoningEffort(effort);
  const alwaysThinking = /opus[-.]5[-.]5/.test(model.toLowerCase());
  if (normalized === "none") {
    if (alwaysThinking)
      throw new Error(`${model} does not support disabling thinking`);
    return { type: "disabled" };
  }
  if (normalized == null && !alwaysThinking) return void 0;
  if (!supportsAdaptiveThinking(model)) {
    return {
      type: "enabled",
      budget_tokens: Math.min(
        Math.max(1024, qwenThinkingBudgetForEffort(normalized) ?? 4096),
        Math.max(1024, maxTokens - 1024),
        maxTokens - 1
      )
    };
  }
  return {
    type: "adaptive",
    display: "summarized"
  };
}
__name(anthropicThinkingConfig, "anthropicThinkingConfig");
function applyDeepSeekReasoning(body, effort) {
  const reasoningEffort = normalizeDeepSeekReasoningEffort(effort);
  if (reasoningEffort == null)
    throw new Error(`Unsupported DeepSeek effort: ${effort}`);
  body.reasoning_effort = reasoningEffort;
  body.thinking = mergeObject(body.thinking, {
    type: reasoningEffort === "none" ? "disabled" : "enabled"
  });
}
__name(applyDeepSeekReasoning, "applyDeepSeekReasoning");
function applyQwenReasoning(body, effort) {
  const normalized = normalizeReasoningEffort(effort);
  body.enable_thinking = normalized !== "none";
  const thinkingBudget = qwenThinkingBudgetForEffort(normalized);
  if (thinkingBudget != null) body.thinking_budget = thinkingBudget;
}
__name(applyQwenReasoning, "applyQwenReasoning");
function applyGeminiReasoning(body, model, effort) {
  body.extra_body = mergeObject(body.extra_body, {
    google: {
      thinking_config: geminiThinkingConfig(model, effort)
    }
  });
}
__name(applyGeminiReasoning, "applyGeminiReasoning");
function applyAnthropicReasoning(body, model, effort) {
  const normalized = anthropicEffortForModel(model, effort);
  const thinking2 = anthropicThinkingConfig(
    effort,
    model,
    Number(body.max_tokens ?? 4096)
  );
  if (thinking2 == null) return;
  body.thinking = mergeObject(body.thinking, thinking2);
  if (normalized != null) {
    body.output_config = mergeObject(body.output_config, {
      effort: normalized
    });
  }
}
__name(applyAnthropicReasoning, "applyAnthropicReasoning");
function applyOpenRouterReasoning(body, effort) {
  const normalized = normalizeReasoningEffort(effort);
  if (normalized == null) return;
  body.reasoning = mergeObject(body.reasoning, { effort: normalized });
}
__name(applyOpenRouterReasoning, "applyOpenRouterReasoning");
function normalizeReasoningEffort(value) {
  if (typeof value !== "string") return void 0;
  const normalized = value.trim().toLowerCase().replace(/[-_\s]*thinking$/, "");
  if (normalized === "tiny") return "minimal";
  if (normalized === "ultra") return "max";
  if (normalized === "none" || normalized === "minimal" || normalized === "low" || normalized === "medium" || normalized === "high" || normalized === "xhigh" || normalized === "max") {
    return normalized;
  }
}
__name(normalizeReasoningEffort, "normalizeReasoningEffort");
function supportsAdaptiveThinking(model) {
  return /claude-(?:(?:opus|sonnet)[-.](?:4[-.][6-9]|[5-9])|(?:fable|mythos)[-.](?:[5-9]|preview))/.test(
    model.toLowerCase()
  );
}
__name(supportsAdaptiveThinking, "supportsAdaptiveThinking");
function anthropicSupportedEfforts(model) {
  const lower = model.toLowerCase();
  if (/claude-opus[-.]4[-.]5/.test(lower)) return ["low", "medium", "high"];
  if (!supportsAdaptiveThinking(lower)) return void 0;
  const levels = [
    "low",
    "medium",
    "high",
    "max"
  ];
  if (!/(?:opus|sonnet)[-.]4[-.]6|mythos[-.]preview/.test(lower))
    levels.splice(3, 0, "xhigh");
  return levels;
}
__name(anthropicSupportedEfforts, "anthropicSupportedEfforts");
function anthropicEffortForModel(model, effort) {
  const value = normalizeReasoningEffort(effort);
  if (value == null || value === "none") return void 0;
  const lower = model.toLowerCase();
  const supported = anthropicSupportedEfforts(lower);
  if (!supported) return void 0;
  if (value === "minimal") return "low";
  if (!supported.includes(value))
    throw new Error(`${model} does not support effort ${value}`);
  return value;
}
__name(anthropicEffortForModel, "anthropicEffortForModel");
function nativeReasoningEfforts(model) {
  const lower = model.toLowerCase();
  if (lower.startsWith("gpt-6"))
    return ["low", "medium", "high", "xhigh", "max"];
  if (lower.includes("kimi-k3") || /glm-5\.3/.test(lower))
    return ["low", "high", "max"];
  if (lower.includes("minimax-m3.1"))
    return ["low", "medium", "high", "xhigh", "max"];
  if (lower.includes("step-5")) return ["low", "medium", "high"];
  if (lower.includes("step-3.5-flash-2603")) return ["low", "high"];
}
__name(nativeReasoningEfforts, "nativeReasoningEfforts");
function validateNativeReasoningEffort(body, model) {
  const supported = nativeReasoningEfforts(model);
  if (supported && body.reasoning_effort != null && !supported.includes(body.reasoning_effort)) {
    throw new Error(
      `${model} supports reasoning_effort: ${supported.join(", ")}`
    );
  }
  if (model.toLowerCase().includes("kimi-k3")) delete body.thinking;
  if (supported && !supported.includes("none") && body.thinking?.type === "disabled") {
    throw new Error(`${model} does not support disabling thinking`);
  }
}
__name(validateNativeReasoningEffort, "validateNativeReasoningEffort");
function isGemini3CompatibleModel(model) {
  return model.toLowerCase().includes("gemini-3");
}
__name(isGemini3CompatibleModel, "isGemini3CompatibleModel");
function geminiThinkingBudget(effort) {
  const normalized = normalizeReasoningEffort(effort);
  if (normalized === "none") return 0;
  if (normalized === "minimal") return 128;
  if (normalized === "low") return 1024;
  if (normalized === "medium") return 8192;
  if (normalized === "high" || normalized === "xhigh" || normalized === "max") {
    return 24576;
  }
  return -1;
}
__name(geminiThinkingBudget, "geminiThinkingBudget");
function geminiThinkingLevel(effort) {
  const normalized = normalizeReasoningEffort(effort);
  if (normalized === "none" || normalized === "minimal" || normalized === "low") {
    return "low";
  }
  if (normalized === "medium") return "medium";
  return "high";
}
__name(geminiThinkingLevel, "geminiThinkingLevel");
function mergeObject(current, extra) {
  const object = current != null && typeof current === "object" && !Array.isArray(current) ? { ...current } : {};
  for (const [key, value] of Object.entries(extra)) {
    if (value != null && typeof value === "object" && !Array.isArray(value) && object[key] != null && typeof object[key] === "object" && !Array.isArray(object[key])) {
      object[key] = mergeObject(
        object[key],
        value
      );
      continue;
    }
    object[key] = value;
  }
  return object;
}
__name(mergeObject, "mergeObject");

// src/adapters/model-list.ts
function parseOpenAIModels(payload, provider) {
  const items = Array.isArray(payload.data) ? payload.data ?? [] : [];
  const result = [];
  const seen = /* @__PURE__ */ new Set();
  for (const item of items) {
    const id = item.id?.trim();
    if (!id) continue;
    const base = makeOpenAIEntry(id, item);
    pushUnique(result, seen, base);
    if (!shouldExpandReasoningVariants(provider, base)) continue;
    const suffixes = reasoningVariantSuffixes(provider, base);
    if ((suffixes?.length ?? 0) < 1) continue;
    for (const variant of (0, import_v1_shared_adapter2.expandReasoningEffortModelVariants)(
      id,
      suffixes
    )) {
      pushUnique(result, seen, {
        name: variant,
        type: import_types3.ModelType.llm,
        maxTokens: base.maxTokens,
        capabilityOverrides: base.capabilityOverrides,
        capabilities: mergeCapabilities(base.capabilities, [
          import_types3.ModelCapabilities.Thinking
        ]),
        reasoningVariantOf: id
      });
    }
  }
  return result;
}
__name(parseOpenAIModels, "parseOpenAIModels");
function shouldExpandReasoningVariants(provider, model) {
  if (model.capabilityOverrides?.[import_types3.ModelCapabilities.Thinking] === false)
    return false;
  if (!provider?.reasoningEffort || provider.reasoningEffort === "disabled") {
    return false;
  }
  if (model.reasoningEfforts != null) {
    return model.reasoningEfforts.length > 0 && isChatModel(model);
  }
  if (model.capabilities?.includes(import_types3.ModelCapabilities.Thinking)) {
    return isChatModel(model);
  }
  return modelSupportsReasoning(provider.id, model);
}
__name(shouldExpandReasoningVariants, "shouldExpandReasoningVariants");
function expandReasoningVariantsForProvider(provider, models, options = {}) {
  const result = [];
  const seen = /* @__PURE__ */ new Set();
  for (const model of models) {
    pushUnique(result, seen, model);
    if (model.reasoningVariantOf) continue;
    if (!shouldExpandReasoningVariants(provider, model)) continue;
    const suffixes = reasoningVariantSuffixes(
      provider,
      model,
      options.reasoningProtocol
    );
    if ((suffixes?.length ?? 0) < 1) continue;
    for (const variant of (0, import_v1_shared_adapter2.expandReasoningEffortModelVariants)(
      model.name,
      suffixes
    )) {
      pushUnique(result, seen, {
        name: variant,
        type: import_types3.ModelType.llm,
        maxTokens: model.maxTokens,
        capabilityOverrides: model.capabilityOverrides,
        capabilities: mergeCapabilities(model.capabilities, [
          import_types3.ModelCapabilities.Thinking
        ]),
        reasoningVariantOf: model.name
      });
    }
  }
  return result;
}
__name(expandReasoningVariantsForProvider, "expandReasoningVariantsForProvider");
function isChatModel(model) {
  if (model.type != null) return model.type === import_types3.ModelType.llm;
  const lower = model.name.toLowerCase();
  return !(0, import_v1_shared_adapter2.isEmbeddingModel)(lower) && !(0, import_v1_shared_adapter2.isRerankerModel)(lower) && !(0, import_v1_shared_adapter2.isImageGenerationModel)(lower);
}
__name(isChatModel, "isChatModel");
function modelSupportsReasoning(provider, model) {
  const id = model.name.toLowerCase();
  if (provider === "openai") {
    return id.startsWith("o1") || id.startsWith("o3") || id.startsWith("o4") || id.startsWith("gpt-5") || id.startsWith("gpt-6");
  }
  if (provider === "deepseek") {
    return id.includes("reasoner") || id.includes("r1") || id.includes("deepseek-v4");
  }
  if (provider === "qwen") {
    return id.includes("qwen3");
  }
  if (provider === "anthropic") return false;
  if (provider === "siliconflow") {
    return id.includes("deepseek-v4") || id.includes("deepseek") && id.includes("reason");
  }
  return nativeReasoningEfforts(id) != null;
}
__name(modelSupportsReasoning, "modelSupportsReasoning");
var DEEPSEEK_REASONING_SUFFIXES = [
  "non-thinking",
  "low-thinking",
  "high-thinking",
  "max-thinking"
];
var NO_REASONING_SUFFIXES = [];
var QWEN_REASONING_SUFFIXES = [
  "non-thinking",
  "minimal-thinking",
  "low-thinking",
  "medium-thinking",
  "high-thinking",
  "max-thinking"
];
var GEMINI_REASONING_SUFFIXES = [
  "minimal-thinking",
  "low-thinking",
  "medium-thinking",
  "high-thinking"
];
var GEMINI_FLASH_REASONING_SUFFIXES = [
  "non-thinking",
  ...GEMINI_REASONING_SUFFIXES
];
var GEMMA_REASONING_SUFFIXES = ["minimal-thinking", "high-thinking"];
var REASONING_EFFORT_SUFFIXES = {
  none: "non-thinking",
  minimal: "minimal-thinking",
  low: "low-thinking",
  medium: "medium-thinking",
  high: "high-thinking",
  xhigh: "xhigh-thinking",
  max: "max-thinking"
};
var REASONING_EFFORT_ORDER = [
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max"
];
function reasoningVariantSuffixes(provider, model, reasoningProtocol) {
  const id = model.name.toLowerCase();
  const protocol = resolveReasoningProtocol2(reasoningProtocol, id);
  if (protocol === "deepseek") {
    return DEEPSEEK_REASONING_SUFFIXES;
  }
  if (protocol === "qwen") {
    return QWEN_REASONING_SUFFIXES;
  }
  if (protocol === "gemini") {
    return geminiReasoningSuffixes(id);
  }
  if (protocol === "anthropic") {
    return reasoningEffortSuffixes(
      model.reasoningEfforts ?? ["low", "medium", "high"]
    );
  }
  if (provider?.id === "deepseek" || id.includes("deepseek-v4")) {
    return DEEPSEEK_REASONING_SUFFIXES;
  }
  if (provider?.id === "qwen" && id.includes("qwen3")) {
    return QWEN_REASONING_SUFFIXES;
  }
  if (model.reasoningEfforts != null) {
    return reasoningEffortSuffixes(model.reasoningEfforts);
  }
  const native = nativeReasoningEfforts(id);
  if (native) return reasoningEffortSuffixes(native);
  if (provider?.id === "minimax" || id.includes("minimax-m")) {
    return NO_REASONING_SUFFIXES;
  }
  if (provider?.id === "anthropic" || id.includes("claude-")) return void 0;
  if (id.includes("gemma-4")) return GEMMA_REASONING_SUFFIXES;
  if (id.includes("gemini-2.5-flash") || id.includes("gemini-flash-lite-latest")) {
    return geminiReasoningSuffixes(id);
  }
  if (id.includes("gemini-2.5") || id.includes("gemini-3") || id.includes("gemini-pro-latest")) {
    return geminiReasoningSuffixes(id);
  }
  return void 0;
}
__name(reasoningVariantSuffixes, "reasoningVariantSuffixes");
function resolveReasoningProtocol2(protocol, model) {
  if (!protocol || protocol === "openai") return "openai";
  if (protocol !== "auto") return protocol;
  if (model.includes("deepseek")) return "deepseek";
  if (model.includes("qwen")) return "qwen";
  if (model.includes("gemini") || model.includes("gemma")) return "gemini";
  if (model.includes("claude")) return "anthropic";
  return "openai";
}
__name(resolveReasoningProtocol2, "resolveReasoningProtocol");
function geminiReasoningSuffixes(model) {
  return model.includes("gemini-3") ? GEMINI_REASONING_SUFFIXES : GEMINI_FLASH_REASONING_SUFFIXES;
}
__name(geminiReasoningSuffixes, "geminiReasoningSuffixes");
function reasoningEffortSuffixes(efforts) {
  const set = new Set(efforts);
  return REASONING_EFFORT_ORDER.filter((effort) => set.has(effort)).map(
    (effort) => REASONING_EFFORT_SUFFIXES[effort]
  );
}
__name(reasoningEffortSuffixes, "reasoningEffortSuffixes");
function mergeCapabilities(preferred, extra) {
  return [.../* @__PURE__ */ new Set([...preferred ?? [], ...extra])];
}
__name(mergeCapabilities, "mergeCapabilities");
function parseGeminiModels(payload) {
  const items = Array.isArray(payload.models) ? payload.models ?? [] : [];
  return items.map((item) => {
    const name2 = item.name?.replace(/^models\//, "").trim();
    if (!name2) return void 0;
    const methods = new Set(item.supportedGenerationMethods ?? []);
    const isEmbedding = item.embedding === true || item.batchEmbedContents === true || methods.has("embedContent") || methods.has("batchEmbedContents");
    const isGenerative = methods.size < 1 || methods.has("generateContent") || methods.has("streamGenerateContent");
    if (!isGenerative && !isEmbedding) return void 0;
    return {
      name: name2,
      maxTokens: item.inputTokenLimit ?? item.metadata?.inputTokenLimit ?? item.outputTokenLimit ?? item.metadata?.outputTokenLimit,
      type: isEmbedding ? import_types3.ModelType.embeddings : void 0,
      capabilities: isEmbedding ? [] : geminiCapabilities(name2)
    };
  }).filter(Boolean);
}
__name(parseGeminiModels, "parseGeminiModels");
function parseAnthropicModels(payload) {
  const items = Array.isArray(payload.data) ? payload.data ?? [] : [];
  return items.map((item) => {
    const name2 = item.id?.trim();
    if (!name2) return void 0;
    return {
      name: name2,
      maxTokens: item.max_input_tokens ?? item.context_length ?? item.max_tokens,
      type: import_types3.ModelType.llm,
      reasoningEfforts: anthropicReasoningEfforts(item),
      capabilities: anthropicCapabilities(item),
      capabilityOverrides: anthropicCapabilityOverrides(item)
    };
  }).filter(Boolean);
}
__name(parseAnthropicModels, "parseAnthropicModels");
function geminiCapabilities(name2) {
  const lower = name2.toLowerCase();
  const result = /* @__PURE__ */ new Set([import_types3.ModelCapabilities.ToolCall]);
  if (supportsGeminiMultimodalInput(lower)) {
    result.add(import_types3.ModelCapabilities.ImageInput);
    result.add(import_types3.ModelCapabilities.AudioInput);
    result.add(import_types3.ModelCapabilities.VideoInput);
    result.add(import_types3.ModelCapabilities.FileInput);
  }
  if (lower.includes("thinking") || lower.includes("gemini-2.5") || lower.includes("gemini-3") || lower.includes("gemini-pro-latest") || lower.includes("gemini-flash-latest") || lower.includes("gemini-flash-lite-latest")) {
    result.add(import_types3.ModelCapabilities.Thinking);
  }
  if (lower.includes("image")) {
    result.add(import_types3.ModelCapabilities.ImageGeneration);
  }
  return [...result];
}
__name(geminiCapabilities, "geminiCapabilities");
function supportsGeminiMultimodalInput(lower) {
  if (lower.includes("embedding")) return false;
  if (lower.includes("image-generation")) return false;
  return lower.includes("vision") || lower.includes("gemini-1.5") || lower.includes("gemini-2") || lower.includes("gemini-3") || lower.includes("gemini-pro-latest") || lower.includes("gemini-flash-latest") || lower.includes("gemini-flash-lite-latest");
}
__name(supportsGeminiMultimodalInput, "supportsGeminiMultimodalInput");
function anthropicCapabilities(item) {
  const result = /* @__PURE__ */ new Set([import_types3.ModelCapabilities.ToolCall]);
  const capabilities = item.capabilities;
  const id = item.id?.toLowerCase() ?? "";
  const reasoningEfforts = anthropicReasoningEfforts(item);
  if (isCapabilitySupported(capabilities?.image_input) || id.includes("sonnet") || id.includes("opus") || id.includes("haiku") || id.includes("fable") || id.includes("mythos")) {
    result.add(import_types3.ModelCapabilities.ImageInput);
  }
  if (isCapabilitySupported(capabilities?.pdf_input) || id.includes("sonnet") || id.includes("opus") || id.includes("fable") || id.includes("mythos")) {
    result.add(import_types3.ModelCapabilities.FileInput);
  }
  if (isCapabilitySupported(capabilities?.thinking) || isCapabilitySupported(capabilities?.effort) || reasoningEfforts != null) {
    result.add(import_types3.ModelCapabilities.Thinking);
  }
  if (capabilities != null && (isCapabilitySupported(capabilities.tool_use) || isCapabilitySupported(capabilities.tools))) {
    result.add(import_types3.ModelCapabilities.ToolCall);
  }
  return [...result];
}
__name(anthropicCapabilities, "anthropicCapabilities");
function anthropicReasoningEfforts(item) {
  const capabilities = item.capabilities;
  const values = [
    ...capabilityEffortValues(capabilities?.thinking),
    ...capabilityEffortValues(capabilities?.effort),
    ...arrayOf(item.reasoning_effort),
    ...item.reasoning_efforts ?? [],
    ...item.supported_reasoning_efforts ?? []
  ].map(normalizeReasoningEffort2).filter((value) => value != null);
  if (values.length > 0) return [...new Set(values)];
  const fallback = anthropicFallbackReasoningEfforts(item.id ?? "");
  if (fallback) return fallback;
  if (isCapabilitySupported(capabilities?.thinking) || isCapabilitySupported(capabilities?.effort) || item.reasoning_effort === true) {
    return ["low", "medium", "high"];
  }
}
__name(anthropicReasoningEfforts, "anthropicReasoningEfforts");
function anthropicFallbackReasoningEfforts(model) {
  return anthropicSupportedEfforts(model);
}
__name(anthropicFallbackReasoningEfforts, "anthropicFallbackReasoningEfforts");
function capabilityEffortValues(value) {
  if (Array.isArray(value)) return value;
  if (value == null || typeof value !== "object") return [];
  const object = value;
  return [
    ...arrayOf(object.effort),
    ...arrayOf(object.values),
    ...arrayOf(object.levels),
    ...arrayOf(object.supported_values)
  ];
}
__name(capabilityEffortValues, "capabilityEffortValues");
function arrayOf(value) {
  return Array.isArray(value) ? value : [];
}
__name(arrayOf, "arrayOf");
function normalizeReasoningEffort2(value) {
  if (typeof value !== "string") return void 0;
  const normalized = value.trim().toLowerCase().replace(/[-_\s]*thinking$/, "");
  if (normalized === "tiny") return "minimal";
  if (normalized === "none" || normalized === "minimal" || normalized === "low" || normalized === "medium" || normalized === "high" || normalized === "xhigh" || normalized === "max") {
    return normalized;
  }
}
__name(normalizeReasoningEffort2, "normalizeReasoningEffort");
function isCapabilitySupported(value) {
  if (typeof value === "boolean") return value;
  if (value != null && typeof value === "object") {
    return value.supported === true;
  }
  return false;
}
__name(isCapabilitySupported, "isCapabilitySupported");
function makeOpenAIEntry(id, item) {
  return {
    name: id,
    type: inferOpenAIModelType(id, item),
    maxTokens: item.context_length ?? item.max_context_length ?? item.input_token_limit ?? item.limit?.context ?? item.limit?.input ?? item.token_limit ?? item.top_provider?.context_length ?? item.meta?.n_ctx_train ?? item.meta?.n_ctx,
    capabilities: openAICapabilities(item),
    capabilityOverrides: openAICapabilityOverrides(item)
  };
}
__name(makeOpenAIEntry, "makeOpenAIEntry");
function inferOpenAIModelType(id, item) {
  const type = item.type?.toLowerCase();
  if (type === "embedding" || type === "embeddings") {
    return import_types3.ModelType.embeddings;
  }
  if (type === "rerank" || type === "reranker") {
    return import_types3.ModelType.reranker;
  }
  const lower = id.toLowerCase();
  if (isRerankerModelName(lower)) return import_types3.ModelType.reranker;
  if (isEmbeddingModelName(lower)) return import_types3.ModelType.embeddings;
  return void 0;
}
__name(inferOpenAIModelType, "inferOpenAIModelType");
function isEmbeddingModelName(lower) {
  return (0, import_v1_shared_adapter2.isEmbeddingModel)(lower) || lower.includes("gte") || lower.includes("text2vec") || lower.includes("e5-") || lower.includes("e5_") || lower.includes("/e5");
}
__name(isEmbeddingModelName, "isEmbeddingModelName");
function isRerankerModelName(lower) {
  return (0, import_v1_shared_adapter2.isRerankerModel)(lower) || lower.includes("ranker");
}
__name(isRerankerModelName, "isRerankerModelName");
function openAICapabilityOverrides(item) {
  const result = {};
  const input = item.architecture?.input_modalities ?? item.modalities;
  if (Array.isArray(input)) {
    const modalities = new Set(input.map((value) => value.toLowerCase()));
    result[import_types3.ModelCapabilities.ImageInput] = modalities.has("image");
    result[import_types3.ModelCapabilities.AudioInput] = modalities.has("audio");
    result[import_types3.ModelCapabilities.VideoInput] = modalities.has("video");
    result[import_types3.ModelCapabilities.FileInput] = modalities.has("file") || modalities.has("pdf");
  }
  const output = item.architecture?.output_modalities;
  if (Array.isArray(output))
    result[import_types3.ModelCapabilities.ImageGeneration] = output.some(
      (modality) => modality.toLowerCase() === "image"
    );
  if (Array.isArray(item.supported_parameters)) {
    result[import_types3.ModelCapabilities.ToolCall] = item.supported_parameters.some(
      (p) => p === "tools" || p === "tool_choice"
    );
    if (item.supported_parameters.some(
      (p) => p === "reasoning" || p === "reasoning_effort"
    )) {
      result[import_types3.ModelCapabilities.Thinking] = true;
    }
  }
  for (const [cap, value] of [
    [import_types3.ModelCapabilities.ToolCall, item.tool_call],
    [import_types3.ModelCapabilities.Thinking, item.supports_reasoning ?? item.reasoning],
    [import_types3.ModelCapabilities.ImageInput, item.supports_image_in],
    [import_types3.ModelCapabilities.AudioInput, item.supports_audio_in],
    [import_types3.ModelCapabilities.VideoInput, item.supports_video_in],
    [import_types3.ModelCapabilities.FileInput, item.supports_file_in]
  ]) {
    if (typeof value === "boolean") result[cap] = value;
  }
  return result;
}
__name(openAICapabilityOverrides, "openAICapabilityOverrides");
function anthropicCapabilityOverrides(item) {
  const result = {};
  for (const [cap, value] of [
    [import_types3.ModelCapabilities.ImageInput, item.capabilities?.image_input],
    [import_types3.ModelCapabilities.FileInput, item.capabilities?.pdf_input],
    [
      import_types3.ModelCapabilities.ToolCall,
      item.capabilities?.tool_use ?? item.capabilities?.tools
    ],
    [import_types3.ModelCapabilities.Thinking, item.capabilities?.thinking]
  ]) {
    const supported = typeof value === "boolean" ? value : value?.supported;
    if (typeof supported === "boolean") result[cap] = supported;
  }
  return result;
}
__name(anthropicCapabilityOverrides, "anthropicCapabilityOverrides");
function openAICapabilities(item) {
  const result = /* @__PURE__ */ new Set();
  const input = new Set(
    [
      ...item.architecture?.input_modalities ?? [],
      ...item.modalities ?? []
    ].map((value) => value.toLowerCase())
  );
  const output = new Set(
    (item.architecture?.output_modalities ?? []).map(
      (value) => value.toLowerCase()
    )
  );
  const parameters = new Set(
    (item.supported_parameters ?? []).map((value) => value.toLowerCase())
  );
  if (item.tool_call === true || parameters.has("tools") || parameters.has("tool_choice")) {
    result.add(import_types3.ModelCapabilities.ToolCall);
  }
  if (item.reasoning === true || item.supports_reasoning === true || parameters.has("reasoning") || parameters.has("reasoning_effort")) {
    result.add(import_types3.ModelCapabilities.Thinking);
  }
  if (input.has("image") || item.supports_image_in === true) {
    result.add(import_types3.ModelCapabilities.ImageInput);
  }
  if (input.has("audio")) result.add(import_types3.ModelCapabilities.AudioInput);
  if (input.has("video") || item.supports_video_in === true) {
    result.add(import_types3.ModelCapabilities.VideoInput);
  }
  if (input.has("file") || input.has("pdf")) {
    result.add(import_types3.ModelCapabilities.FileInput);
  }
  if (output.has("image")) result.add(import_types3.ModelCapabilities.ImageGeneration);
  return result.size > 0 ? [...result] : void 0;
}
__name(openAICapabilities, "openAICapabilities");
function pushUnique(result, seen, entry) {
  const key = entry.name.toLowerCase();
  if (seen.has(key)) return;
  seen.add(key);
  result.push(entry);
}
__name(pushUnique, "pushUnique");

// src/adapters/openai-bridge.ts
var import_messages = require("@langchain/core/messages");
var import_outputs = require("@langchain/core/outputs");
var import_api = require("koishi-plugin-chatluna/llm-core/platform/api");
function usesResponses(requester, params) {
  const model = String(
    params.overrideRequestParams?.model ?? params.model ?? ""
  ).toLowerCase();
  return requester.currentConfig().responseApi === true || requester.currentProviderPreset().id === "openai" && model.startsWith("gpt-6");
}
__name(usesResponses, "usesResponses");
function createOpenAIBridge(requester, params) {
  const context = requester.requestContext();
  const provider = requester.currentConfig().provider;
  const state = {};
  const proxy = Object.create(context.modelRequester);
  proxy.post = async (url, body, options) => {
    state.model = body.model;
    if (url === "responses") {
      if (!Object.hasOwn(params.overrideRequestParams ?? {}, "input")) {
        body.input = restoreResponseInput(
          body.input,
          params.input,
          provider,
          body.model
        );
      }
      const configured = requester.currentConfig();
      if (configured.promptCacheMode === "explicit" && !Object.hasOwn(params.overrideRequestParams ?? {}, "input")) {
        markCacheBoundary(
          body.input.filter((item) => item.type === "message"),
          true
        );
      }
      if (body.store === false && provider === "openai") {
        body.include = [
          .../* @__PURE__ */ new Set([
            ...body.include ?? [],
            "reasoning.encrypted_content"
          ])
        ];
      }
      const effort = params.overrideRequestParams?.reasoning_effort;
      if (effort != null && !Object.hasOwn(params.overrideRequestParams ?? {}, "reasoning")) {
        body.reasoning = { ...body.reasoning, effort };
      }
      delete body.reasoning_effort;
    } else if (url === "chat/completions" && !Object.hasOwn(params.overrideRequestParams ?? {}, "messages")) {
      body.messages?.forEach((message, index) => {
        message.content = restoreContent(
          message.content,
          params.input[index]?.content,
          false
        );
      });
      if (requester.currentConfig().promptCacheMode === "explicit")
        markCacheBoundary(body.messages, false);
    }
    const response = await requester.post(url, body, options);
    if (!response.ok) return response;
    const observe = /* @__PURE__ */ __name((data) => {
      const raw = data.response ?? data;
      if (raw.usage) {
        state.usage = raw.usage;
        const details = raw.usage.prompt_tokens_details;
        const cached = raw.usage.cached_tokens ?? raw.usage.prompt_cache_hit_tokens;
        if (cached != null && details?.cached_tokens == null) {
          raw.usage.prompt_tokens_details = {
            ...details,
            cached_tokens: cached
          };
        }
      }
      if (Array.isArray(raw.output)) state.output = raw.output;
      if (raw.id) state.id = raw.id;
      if (data.type === "response.output_item.done" && data.item) {
        state.output ??= [];
        state.output[data.output_index ?? state.output.length] = data.item;
      }
      for (const choice of data.choices ?? []) {
        for (const message of [choice.message, choice.delta]) {
          if (message?.reasoning_content == null && typeof message?.reasoning === "string") {
            message.reasoning_content = message.reasoning;
          }
          if (message === choice.delta && typeof message?.reasoning_content === "string") {
            state.reasoning = (state.reasoning ?? "") + message.reasoning_content;
          }
        }
      }
      return data;
    }, "observe");
    if (body.stream !== true) {
      const data = observe(JSON.parse(await response.text()));
      return new Response(JSON.stringify(data), {
        status: response.status,
        headers: response.headers
      });
    }
    if (!response.body) return response;
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    let buffer = "";
    const rewrite = /* @__PURE__ */ __name((frame) => frame.replace(/^data: ?(.*)$/gm, (line, payload) => {
      if (!payload.trim() || payload.trim() === "[DONE]") return line;
      let parsed;
      try {
        parsed = JSON.parse(payload);
      } catch {
        return line;
      }
      return `data: ${JSON.stringify(observe(parsed))}`;
    }), "rewrite");
    const stream = response.body.pipeThrough(
      new TransformStream({
        transform(bytes, controller) {
          buffer += decoder.decode(bytes, { stream: true });
          let match;
          while (match = /\r?\n\r?\n/.exec(buffer)) {
            controller.enqueue(
              encoder.encode(
                rewrite(buffer.slice(0, match.index)) + "\n\n"
              )
            );
            buffer = buffer.slice(match.index + match[0].length);
          }
        },
        flush(controller) {
          buffer += decoder.decode();
          if (buffer)
            controller.enqueue(
              encoder.encode(rewrite(buffer) + "\n\n")
            );
        }
      })
    );
    const headers = new Headers(response.headers);
    headers.delete("content-length");
    return new Response(stream, { status: response.status, headers });
  };
  function enrich(generation) {
    const message = generation.message;
    if (Object.hasOwn(message.additional_kwargs, "reasoning_content") && state.reasoning != null) {
      message.additional_kwargs.reasoning_content = state.reasoning;
    }
    const usage2 = message.usage_metadata;
    if (usage2 && state.usage) {
      const raw = state.usage;
      const detail = raw.input_tokens_details ?? raw.prompt_tokens_details ?? {};
      const write = detail.cache_write_tokens ?? detail.cache_creation_input_tokens ?? raw.cache_creation_input_tokens;
      const read = detail.cached_tokens ?? raw.cached_tokens ?? raw.prompt_cache_hit_tokens;
      usage2.input_token_details = {
        ...usage2.input_token_details,
        ...write == null ? {} : { cache_creation: write },
        ...read == null ? {} : { cache_read: read }
      };
      const metrics = (0, import_api.readInvocationMetrics)(generation);
      (0, import_api.attachInvocationMetrics)(generation, {
        ...metrics,
        usageMetadata: usage2
      });
    }
    return generation;
  }
  __name(enrich, "enrich");
  function history() {
    const output = state.output?.filter(Boolean);
    return output?.length ? {
      hub_response: {
        provider,
        model: state.model,
        id: state.id,
        output
      }
    } : {};
  }
  __name(history, "history");
  return {
    context: { ...context, modelRequester: proxy },
    enrich,
    finish(generation) {
      enrich(generation);
      Object.assign(generation.message.additional_kwargs, history());
      return generation;
    },
    historyChunk() {
      return new import_outputs.ChatGenerationChunk({
        text: "",
        message: new import_messages.AIMessageChunk({
          content: "",
          additional_kwargs: history()
        })
      });
    }
  };
}
__name(createOpenAIBridge, "createOpenAIBridge");
function restoreResponseInput(input, messages, provider, model) {
  const result = [];
  let offset = 0;
  for (const message of messages) {
    const type = message.getType();
    const count = type === "tool" || type === "function" ? 1 : (message.content !== "" ? 1 : 0) + (type === "ai" ? message.tool_calls?.length ?? 0 : 0);
    const group = input.slice(offset, offset + count);
    offset += count;
    const raw = message.additional_kwargs?.hub_response;
    if (type === "ai" && raw?.provider === provider && raw.model === model && Array.isArray(raw.output)) {
      result.push(...structuredClone(raw.output));
      continue;
    }
    for (const item of group) {
      if (item.content)
        item.content = restoreContent(
          item.content,
          message.content,
          true
        );
      if (item.output)
        item.output = restoreContent(item.output, message.content, true);
      result.push(item);
    }
  }
  result.push(...input.slice(offset));
  return result;
}
__name(restoreResponseInput, "restoreResponseInput");
function markCacheBoundary(messages, responses) {
  const stable = messages.slice(0, -1).at(-1) ?? messages[0];
  if (!stable) return;
  const type = responses ? "input_text" : "text";
  if (typeof stable.content === "string")
    stable.content = [{ type, text: stable.content }];
  const lastText = stable.content?.filter((part) => part.type === type).at(-1);
  if (lastText) lastText.prompt_cache_breakpoint ??= { mode: "explicit" };
}
__name(markCacheBoundary, "markCacheBoundary");
function restoreContent(content, original, responses) {
  if (!Array.isArray(content) || !Array.isArray(original)) return content;
  const images = original.filter((part) => part.type === "image_url");
  const texts = original.filter(
    (part) => part.type === "text" && part.text?.length > 0
  );
  const files = original.filter((part) => part.type === "file_url");
  let imageIndex = 0;
  let textIndex = 0;
  let fileIndex = 0;
  return content.map((part) => {
    if (part.type === "image_url" || part.type === "input_image") {
      const source = images[imageIndex++];
      if (!source) return part;
      const { type: _type, image_url: _image, ...blockOptions } = source;
      const options = typeof source.image_url === "object" ? source.image_url : {};
      const { url: _url, ...extensions } = options;
      if (responses)
        return {
          ...part,
          ...blockOptions,
          ...extensions,
          detail: options.detail ?? "auto"
        };
      return {
        ...source,
        image_url: {
          ...extensions,
          url: part.image_url.url,
          detail: options.detail ?? "auto"
        }
      };
    }
    if (part.type === "text" || part.type === "input_text") {
      const source = texts[textIndex++];
      if (!source) return part;
      const { type: _type, ...extensions } = source;
      return { ...part, ...extensions };
    }
    if (part.type === "input_file") {
      const source = files[fileIndex++];
      if (!source) return part;
      const options = typeof source.file_url === "object" ? source.file_url : {};
      const { url: _url, ...extensions } = options;
      const { type: _type, file_url: _file, ...blockOptions } = source;
      return { ...part, ...blockOptions, ...extensions };
    }
    return part;
  });
}
__name(restoreContent, "restoreContent");

// src/adapters/openai-chat.ts
var openAIChatAdapter = {
  id: "openai-chat",
  async completion(requester, params) {
    if (!requester.currentConfig().nonStreaming) {
      return requester.defaultCompletion(params);
    }
    const bridge = createOpenAIBridge(requester, params);
    return bridge.finish(
      await (0, import_v1_shared_adapter3.completion)(
        bridge.context,
        preserveRealModelName(params),
        "chat/completions",
        void 0,
        requester.supportsCapability(
          params.model,
          import_types4.ModelCapabilities.ImageInput
        )
      )
    );
  },
  async *completionStream(requester, params) {
    if (!requester.currentConfig().nonStreaming) {
      yield* requester.defaultCompletionStream(params);
      return;
    }
    const generation = await this.completion(requester, params);
    yield new import_outputs2.ChatGenerationChunk({
      generationInfo: generation.generationInfo,
      message: generation.message,
      text: generation.text
    });
  },
  async *completionStreamInternal(requester, params) {
    const normalizeToolCallChunk = requester.currentProviderPreset().id === "deepseek" ? createToolCallChunkNormalizer() : void 0;
    const bridge = createOpenAIBridge(requester, params);
    for await (const chunk of (0, import_v1_shared_adapter3.completionStream)(
      bridge.context,
      preserveRealModelName(params),
      "chat/completions",
      void 0,
      requester.supportsCapability(
        params.model,
        import_types4.ModelCapabilities.ImageInput
      )
    )) {
      yield bridge.enrich(normalizeToolCallChunk?.(chunk) ?? chunk);
    }
  },
  async embeddings(requester, params) {
    return await (0, import_v1_shared_adapter3.createEmbeddings)(requester.requestContext(), params);
  },
  async rerank(requester, params) {
    return await (0, import_v1_shared_adapter3.createRerank)(requester.requestContext(), params);
  },
  async getModels(requester, config) {
    const response = await requester.get(
      "models",
      {},
      { signal: config?.signal }
    );
    await (0, import_sse.checkResponse)(response);
    return parseOpenAIModels(
      JSON.parse(await response.text()),
      requester.currentProviderPreset()
    );
  }
};
function createToolCallChunkNormalizer() {
  const ids = /* @__PURE__ */ new Map();
  const indexes = /* @__PURE__ */ new Map();
  let nextIndex = 0;
  let nextId = 0;
  return (chunk) => {
    const message = chunk.message;
    if (!(message instanceof import_messages2.AIMessageChunk)) return chunk;
    const toolCallChunks = message.tool_call_chunks;
    if ((toolCallChunks?.length ?? 0) < 1) return chunk;
    let changed = false;
    const repairedToolCallChunks = toolCallChunks.map(
      (toolCall, offset) => {
        const id = normalizeToolCallId(toolCall.id);
        const index = resolveToolCallIndex(toolCall.index, id, offset);
        if (id) {
          ids.set(index, id);
          indexes.set(id, index);
        } else if (!ids.has(index)) {
          ids.set(index, `call_deepseek_${nextId++}`);
        }
        changed ||= index !== toolCall.index || ids.get(index) !== toolCall.id;
        return {
          ...toolCall,
          index,
          id: ids.get(index)
        };
      }
    );
    if (!changed) return chunk;
    return new import_outputs2.ChatGenerationChunk({
      generationInfo: chunk.generationInfo,
      text: chunk.text,
      message: new import_messages2.AIMessageChunk({
        content: message.content,
        additional_kwargs: message.additional_kwargs,
        response_metadata: message.response_metadata,
        tool_call_chunks: repairedToolCallChunks,
        usage_metadata: message.usage_metadata,
        id: message.id,
        name: message.name
      })
    });
  };
  function resolveToolCallIndex(index, id, offset) {
    if (Number.isInteger(index)) return index;
    if (id && indexes.has(id)) return indexes.get(id);
    if (id) return nextIndex++;
    return offset;
  }
  __name(resolveToolCallIndex, "resolveToolCallIndex");
}
__name(createToolCallChunkNormalizer, "createToolCallChunkNormalizer");
function normalizeToolCallId(value) {
  return typeof value === "string" && value.trim().length > 0 ? value : void 0;
}
__name(normalizeToolCallId, "normalizeToolCallId");
function preserveRealModelName(params) {
  if (!params.model) return params;
  const { model, reasoningEffort } = (0, import_v1_shared_adapter3.parseOpenAIModelNameWithReasoningEffort)(
    params.model
  );
  if (model === params.model && Object.prototype.hasOwnProperty.call(
    params.overrideRequestParams ?? {},
    "model"
  )) {
    return params;
  }
  return {
    ...params,
    overrideRequestParams: {
      model,
      ...reasoningEffort == null ? {} : { reasoning_effort: reasoningEffort },
      ...params.overrideRequestParams
    }
  };
}
__name(preserveRealModelName, "preserveRealModelName");

// src/adapters/openai.ts
var import_outputs3 = require("@langchain/core/outputs");
var import_v1_shared_adapter4 = require("@chatluna/v1-shared-adapter");
var import_sse2 = require("koishi-plugin-chatluna/utils/sse");
var import_types5 = require("koishi-plugin-chatluna/llm-core/platform/types");
var import_error = require("koishi-plugin-chatluna/utils/error");
var openAIAdapter = {
  id: "openai",
  async completion(requester, params) {
    const current = requester.currentConfig();
    if (!current.nonStreaming) {
      return requester.defaultCompletion(params);
    }
    const bridge = createOpenAIBridge(requester, params);
    const requestContext = bridge.context;
    if (usesResponses(requester, params)) {
      return bridge.finish(
        await (0, import_v1_shared_adapter4.responseApiCompletion)(
          requestContext,
          params,
          {
            builtinTools: requester.responseBuiltinTools(params)
          },
          requester.supportsCapability(
            params.model,
            import_types5.ModelCapabilities.ImageInput
          ),
          requester.responseImageProvider()
        )
      );
    }
    return bridge.finish(
      await (0, import_v1_shared_adapter4.completion)(
        requestContext,
        params,
        "chat/completions",
        void 0,
        requester.supportsCapability(
          params.model,
          import_types5.ModelCapabilities.ImageInput
        )
      )
    );
  },
  async *completionStream(requester, params) {
    const current = requester.currentConfig();
    if (!current.nonStreaming) {
      yield* requester.defaultCompletionStream(params);
      return;
    }
    const generation = await this.completion(requester, params);
    yield new import_outputs3.ChatGenerationChunk({
      generationInfo: generation.generationInfo,
      message: generation.message,
      text: generation.text
    });
  },
  async *completionStreamInternal(requester, params) {
    const bridge = createOpenAIBridge(requester, params);
    const requestContext = bridge.context;
    if (usesResponses(requester, params)) {
      for await (const chunk of (0, import_v1_shared_adapter4.responseApiCompletionStream)(
        requestContext,
        params,
        {
          builtinTools: requester.responseBuiltinTools(params)
        },
        requester.supportsCapability(
          params.model,
          import_types5.ModelCapabilities.ImageInput
        ),
        requester.responseImageProvider()
      ))
        yield bridge.enrich(chunk);
      yield bridge.historyChunk();
      return;
    }
    for await (const chunk of (0, import_v1_shared_adapter4.completionStream)(
      requestContext,
      params,
      "chat/completions",
      void 0,
      requester.supportsCapability(
        params.model,
        import_types5.ModelCapabilities.ImageInput
      )
    ))
      yield bridge.enrich(chunk);
  },
  async embeddings(requester, params) {
    const requestContext = requester.requestContext();
    return await (0, import_v1_shared_adapter4.createEmbeddings)(requestContext, params);
  },
  async rerank(requester, params) {
    throw new import_error.ChatLunaError(
      import_error.ChatLunaErrorCode.API_REQUEST_FAILED,
      new Error(
        `OpenAI official API does not provide a rerank endpoint for ${params.model ?? "this model"}.`
      )
    );
  },
  async getModels(requester, config) {
    const response = await requester.get(
      "models",
      {},
      { signal: config?.signal }
    );
    await (0, import_sse2.checkResponse)(response);
    return parseOpenAIModels(
      JSON.parse(await response.text()),
      requester.currentProviderPreset()
    );
  }
};

// src/adapters/gemini.ts
var import_messages4 = require("@langchain/core/messages");
var import_outputs5 = require("@langchain/core/outputs");
var import_types6 = require("@langchain/core/utils/types");
var import_zod_to_json_schema = require("zod-to-json-schema");
var import_v1_shared_adapter6 = require("@chatluna/v1-shared-adapter");
var import_sse4 = require("koishi-plugin-chatluna/utils/sse");
var import_string = require("koishi-plugin-chatluna/utils/string");
var import_error3 = require("koishi-plugin-chatluna/utils/error");

// src/adapters/gemini-interactions.ts
var import_messages3 = require("@langchain/core/messages");
var import_outputs4 = require("@langchain/core/outputs");
var import_v1_shared_adapter5 = require("@chatluna/v1-shared-adapter");
var import_sse3 = require("koishi-plugin-chatluna/utils/sse");
var import_error2 = require("koishi-plugin-chatluna/utils/error");
async function buildInteraction(requester, params, mapper, stream) {
  const config = requester.currentConfig();
  if (config.geminiCachedContent)
    throw new Error(
      "cachedContents references require generateContent, not Interactions"
    );
  const customInput = Object.hasOwn(
    params.overrideRequestParams ?? {},
    "input"
  );
  const generated = await createGeminiRequest(
    requester,
    {
      ...params,
      input: customInput ? [] : params.input,
      overrideRequestParams: void 0
    },
    mapper
  );
  const model = (0, import_v1_shared_adapter5.parseOpenAIModelNameWithReasoningEffort)(
    String(params.overrideRequestParams?.model ?? params.model)
  ).model.replace(/^models\//, "");
  const input = [];
  let index = 0;
  let previousTool = false;
  let toolContent;
  for (const message of customInput ? [] : params.input) {
    if (message.getType() === "system") continue;
    if (message.getType() === "tool") {
      if (!previousTool) toolContent = generated.contents[index++];
      previousTool = true;
      const tool2 = message;
      const response = toolContent?.parts?.find(
        (part) => part.functionResponse?.id === tool2.tool_call_id
      )?.functionResponse;
      const text = typeof tool2.content === "string" ? tool2.content : tool2.content.filter((part) => part.type === "text").map((part) => part.text).join("");
      input.push({
        type: "function_result",
        name: response?.name ?? mapper.sanitize(tool2.name),
        call_id: tool2.tool_call_id,
        result: [
          { type: "text", text },
          ...(response?.parts ?? []).map(partToContent)
        ]
      });
      continue;
    }
    previousTool = false;
    const content = generated.contents[index++];
    const saved = message.additional_kwargs.hub_gemini_interaction;
    if (message.getType() === "ai" && saved?.model === model && Array.isArray(saved.steps)) {
      input.push(...structuredClone(saved.steps));
      continue;
    }
    if (!content) continue;
    let ordinary = [];
    for (const part of content.parts) {
      if (part.functionCall) {
        if (ordinary.length) {
          input.push({ type: "model_output", content: ordinary });
          ordinary = [];
        }
        const call = part.functionCall;
        input.push({
          type: "function_call",
          id: call.id,
          name: call.name,
          arguments: call.args
        });
      } else ordinary.push(partToContent(part));
    }
    if (ordinary.length)
      input.push({
        type: message.getType() === "ai" ? "model_output" : "user_input",
        content: ordinary
      });
  }
  const tools = [];
  for (const tool2 of generated.tools ?? []) {
    for (const fn of tool2.functionDeclarations ?? [])
      tools.push({ type: "function", ...fn });
    if (tool2.googleSearch) tools.push({ type: "google_search" });
    if (tool2.codeExecution) tools.push({ type: "code_execution" });
    if (tool2.urlContext) tools.push({ type: "url_context" });
  }
  const g = generated.generationConfig ?? {};
  const schema = config.geminiResponseJsonSchema;
  const base = {
    model,
    input,
    stream,
    store: false,
    system_instruction: generated.systemInstruction?.parts?.map((p) => p.text ?? "").join("\n"),
    tools: tools.length ? tools : void 0,
    generation_config: {
      temperature: g.temperature,
      top_p: g.topP,
      max_output_tokens: g.maxOutputTokens,
      thinking_level: g.thinkingConfig?.thinkingLevel,
      thinking_summaries: config.includeThoughts ? "auto" : void 0
    },
    response_format: schema ? [{ type: "text", mime_type: "application/json", schema }] : config.geminiResponseMimeType ? [{ type: "text", mime_type: config.geminiResponseMimeType }] : void 0
  };
  const { reasoning_effort: _effort, ...override } = params.overrideRequestParams ?? {};
  return mergeGeminiRequest(base, override);
}
__name(buildInteraction, "buildInteraction");
function partToContent(part) {
  if (part.text != null) return { type: "text", text: part.text };
  const media = part.inlineData ?? part.inline_data ?? part.fileData ?? part.file_data;
  if (media) {
    const mime = media.mimeType ?? media.mime_type;
    const type = mime?.startsWith("image/") ? "image" : mime?.startsWith("audio/") ? "audio" : mime?.startsWith("video/") ? "video" : "document";
    return {
      type,
      mime_type: mime,
      ...media.data ? { data: media.data } : { uri: media.fileUri ?? media.file_uri }
    };
  }
  throw new Error(
    "Cannot convert generateContent-specific context to Interactions; start a new conversation or supply overrideRequestParams.input"
  );
}
__name(partToContent, "partToContent");
function ensureSuccess(data) {
  if (data.error || ["failed", "cancelled"].includes(data.status)) {
    throw new import_error2.ChatLunaError(
      import_error2.ChatLunaErrorCode.API_REQUEST_FAILED,
      new Error(
        `Gemini interaction failed: ${data.error?.message ?? data.status}`
      )
    );
  }
}
__name(ensureSuccess, "ensureSuccess");
function parseGeminiInteraction(data, mapper, metadataOnly = false) {
  ensureSuccess(data);
  const steps = data.steps ?? [];
  const content = [];
  const calls = [];
  let reasoning = "";
  for (const step of steps) {
    if (step.type === "model_output")
      for (const part of step.content ?? []) {
        if (part.type === "text")
          content.push({ type: "text", text: part.text });
        else if (["image", "audio", "video", "document"].includes(part.type)) {
          const url = part.uri ?? `data:${part.mime_type};base64,${part.data}`;
          const type = part.type === "image" ? "image_url" : part.type === "audio" ? "audio_url" : part.type === "video" ? "video_url" : "file_url";
          content.push({
            type,
            [type]: type === "image_url" ? url : { url, mimeType: part.mime_type }
          });
        }
      }
    if (step.type === "function_call")
      calls.push({
        name: mapper.restore(step.name),
        id: step.id,
        args: typeof step.arguments === "string" ? step.arguments : JSON.stringify(step.arguments ?? {}),
        index: calls.length
      });
    if (step.type === "thought")
      reasoning += (step.summary ?? []).map((p) => p.text ?? "").join("");
  }
  const usage2 = data.usage;
  const metadata = usage2 ? (0, import_v1_shared_adapter5.createUsageMetadata)({
    inputTokens: usage2.total_input_tokens ?? 0,
    outputTokens: usage2.total_output_tokens ?? 0,
    totalTokens: usage2.total_tokens ?? 0,
    cacheReadTokens: usage2.total_cached_tokens,
    reasoningTokens: usage2.total_thought_tokens
  }) : void 0;
  const text = metadataOnly ? "" : content.filter((p) => p.type === "text").map((p) => p.text).join("");
  return new import_outputs4.ChatGenerationChunk({
    text,
    generationInfo: { status: data.status, usage_metadata: metadata },
    message: new import_messages3.AIMessageChunk({
      content: metadataOnly ? "" : content,
      tool_call_chunks: metadataOnly ? [] : calls,
      usage_metadata: metadata,
      additional_kwargs: {
        hub_gemini_interaction: {
          model: data.model,
          id: data.id,
          steps
        },
        ...reasoning ? { reasoning_content: reasoning } : {}
      }
    })
  });
}
__name(parseGeminiInteraction, "parseGeminiInteraction");
async function geminiInteractionCompletion(requester, params) {
  const mapper = createGeminiToolNameMapper(params.tools ?? []);
  const signal = (0, import_v1_shared_adapter5.createRequestSignal)(params);
  try {
    const request = await buildInteraction(
      requester,
      { ...params, signal: signal.signal },
      mapper,
      false
    );
    const response = await requester.post("interactions", request, {
      signal: signal.signal
    });
    await (0, import_sse3.checkResponse)(response);
    const data = JSON.parse(await response.text());
    data.model ??= request.model;
    return parseGeminiInteraction(data, mapper);
  } finally {
    signal.dispose();
  }
}
__name(geminiInteractionCompletion, "geminiInteractionCompletion");
async function* geminiInteractionStream(requester, params) {
  const mapper = createGeminiToolNameMapper(params.tools ?? []);
  const signal = (0, import_v1_shared_adapter5.createRequestSignal)(params);
  const steps = [];
  const args = /* @__PURE__ */ new Map();
  let interaction = {};
  let completed = false;
  try {
    const request = await buildInteraction(
      requester,
      { ...params, signal: signal.signal },
      mapper,
      true
    );
    const response = await requester.post("interactions", request, {
      signal: signal.signal
    });
    signal.clearTimeout();
    await (0, import_sse3.checkResponse)(response);
    for await (const event of (0, import_sse3.sseIterable)(response, {
      signal: signal.signal,
      timeout: params.timeout
    })) {
      if (!event.data || event.data.trim() === "[DONE]") continue;
      const data = JSON.parse(event.data);
      const type = data.event_type ?? event.event;
      if (type === "error" || data.error)
        ensureSuccess({ error: data.error ?? data, status: "failed" });
      if (data.interaction)
        interaction = { ...interaction, ...data.interaction };
      if (type === "interaction.status_update")
        ensureSuccess({ ...data, status: data.status });
      if (type === "step.start")
        steps[data.index] = structuredClone(data.step);
      if (type === "step.delta") {
        const step = steps[data.index];
        const delta = data.delta;
        if (!step)
          throw new Error(
            "Gemini interaction delta has no step.start"
          );
        if (delta.type === "arguments_delta")
          args.set(
            data.index,
            (args.get(data.index) ?? "") + delta.arguments
          );
        else if (delta.type === "thought_signature")
          step.signature = delta.signature;
        else if (delta.type === "thought_summary")
          (step.summary ??= []).push(delta.content);
        else if (step.type === "model_output") {
          ;
          (step.content ??= []).push(delta);
          if (delta.type === "text")
            yield new import_outputs4.ChatGenerationChunk({
              text: delta.text,
              message: new import_messages3.AIMessageChunk({ content: delta.text })
            });
          else {
            const chunk = parseGeminiInteraction(
              { steps: [{ ...step, content: [delta] }] },
              mapper
            );
            delete chunk.message.additional_kwargs.hub_gemini_interaction;
            yield chunk;
          }
        } else
          Object.assign(
            step,
            Object.fromEntries(
              Object.entries(delta).filter(
                ([key]) => key !== "type"
              )
            )
          );
      }
      if (type === "step.stop") {
        if (data.step) steps[data.index] = data.step;
        if (args.has(data.index))
          steps[data.index].arguments = JSON.parse(
            args.get(data.index)
          );
        if (steps[data.index]?.type === "function_call") {
          const chunk = parseGeminiInteraction(
            { steps: [steps[data.index]] },
            mapper
          );
          delete chunk.message.additional_kwargs.hub_gemini_interaction;
          const calls = chunk.message.tool_call_chunks;
          calls.forEach((call) => {
            call.index = data.index;
          });
          yield chunk;
        }
      }
      if (type === "interaction.completed") {
        ensureSuccess(interaction);
        completed = true;
      }
    }
    if (!completed)
      throw new Error(
        "Gemini interaction stream ended without completion"
      );
    interaction.steps ??= steps.filter(Boolean);
    interaction.model ??= request.model;
    yield parseGeminiInteraction(interaction, mapper, true);
  } finally {
    signal.dispose();
  }
}
__name(geminiInteractionStream, "geminiInteractionStream");

// src/adapters/gemini.ts
var geminiAdapter = {
  id: "gemini",
  async completion(requester, params) {
    if (!requester.currentConfig().nonStreaming) {
      return requester.defaultCompletion(params);
    }
    const generation = requester.currentConfig().geminiApi === "interactions" ? await geminiInteractionCompletion(requester, params) : await geminiCompletion(requester, params);
    return generation;
  },
  async *completionStream(requester, params) {
    if (!requester.currentConfig().nonStreaming) {
      yield* requester.defaultCompletionStream(params);
      return;
    }
    const generation = await this.completion(requester, params);
    yield new import_outputs5.ChatGenerationChunk({
      generationInfo: generation.generationInfo,
      message: generation.message,
      text: generation.text
    });
  },
  async *completionStreamInternal(requester, params) {
    if (requester.currentConfig().geminiApi === "interactions") {
      yield* geminiInteractionStream(requester, params);
      return;
    }
    yield* geminiCompletionStream(requester, params);
  },
  async embeddings(requester, params) {
    const input = typeof params.input === "string" ? [params.input] : params.input;
    const response = await requester.post(
      `models/${params.model}:batchEmbedContents`,
      {
        requests: input.map((text) => ({
          model: `models/${params.model}`,
          content: {
            parts: [{ text }]
          }
        }))
      },
      { signal: params.signal }
    );
    await (0, import_sse4.checkResponse)(response);
    const data = JSON.parse(await response.text());
    return data.embeddings?.map((item) => item.values) ?? [];
  },
  async rerank() {
    return [];
  },
  async getModels(requester, config) {
    const response = await requester.get(
      "models",
      {},
      { signal: config?.signal }
    );
    await (0, import_sse4.checkResponse)(response);
    return parseGeminiModels(JSON.parse(await response.text()));
  }
};
async function geminiCompletion(requester, params) {
  const toolNameMapper = createGeminiToolNameMapper(params.tools ?? []);
  const requestSignal = (0, import_v1_shared_adapter6.createRequestSignal)(params);
  try {
    const request = await createGeminiRequest(
      requester,
      { ...params, signal: requestSignal.signal },
      toolNameMapper
    );
    const response = await requester.post(
      `models/${prepareGeminiModel(params.overrideRequestParams?.model ?? params.model, requester)}:generateContent`,
      request,
      { signal: requestSignal.signal }
    );
    requestSignal.clearTimeout();
    await (0, import_sse4.checkResponse)(response);
    return await parseGeminiResponse(
      await response.text(),
      requester,
      toolNameMapper
    );
  } finally {
    requestSignal.dispose();
  }
}
__name(geminiCompletion, "geminiCompletion");
async function* geminiCompletionStream(requester, params) {
  const toolNameMapper = createGeminiToolNameMapper(params.tools ?? []);
  const requestSignal = (0, import_v1_shared_adapter6.createRequestSignal)(params);
  const streamState = { nextToolIndex: 0, partIndex: 0 };
  try {
    const request = await createGeminiRequest(
      requester,
      { ...params, signal: requestSignal.signal },
      toolNameMapper
    );
    const response = await requester.post(
      `models/${prepareGeminiModel(params.overrideRequestParams?.model ?? params.model, requester)}:streamGenerateContent?alt=sse`,
      request,
      { signal: requestSignal.signal }
    );
    requestSignal.clearTimeout();
    await (0, import_sse4.checkResponse)(response);
    for await (const event of (0, import_sse4.sseIterable)(response, {
      timeout: params.timeout,
      signal: requestSignal.signal
    })) {
      if (!event.data || event.data === "[DONE]") continue;
      yield await parseGeminiResponse(
        event.data,
        requester,
        toolNameMapper,
        streamState
      );
    }
  } finally {
    requestSignal.dispose();
  }
}
__name(geminiCompletionStream, "geminiCompletionStream");
async function createGeminiRequest(requester, params, toolNameMapper) {
  const messageContents = await messagesToGeminiContents(
    requester,
    params.input,
    toolNameMapper,
    params.overrideRequestParams?.model ?? params.model,
    params.signal
  );
  const current = requester.currentConfig();
  const parsedModel = (0, import_v1_shared_adapter6.parseOpenAIModelNameWithReasoningEffort)(
    params.model ?? ""
  );
  const thinkingConfig = createGeminiThinkingConfig(
    parsedModel.model,
    params.overrideRequestParams?.reasoning_effort ?? parsedModel.reasoningEffort,
    current
  );
  const tools = geminiTools(
    requester,
    params.tools ?? [],
    parsedModel.model,
    toolNameMapper
  );
  const generationConfig = filterEmpty({
    temperature: params.temperature,
    topP: params.topP,
    maxOutputTokens: params.maxTokens,
    stopSequences: params.stop,
    responseMimeType: current.geminiResponseMimeType || (current.geminiResponseJsonSchema ? "application/json" : void 0),
    responseJsonSchema: current.geminiResponseJsonSchema,
    responseModalities: current.imageGeneration && supportsGeminiImageGeneration(parsedModel.model) ? ["TEXT", "IMAGE"] : void 0,
    thinkingConfig
  });
  const base = filterEmpty({
    ...messageContents,
    cachedContent: current.geminiCachedContent || void 0,
    generationConfig,
    safetySettings: createSafetySettings(),
    tools,
    toolConfig: tools?.some(
      (tool2) => tool2.googleSearch != null || tool2.codeExecution != null || tool2.urlContext != null
    ) && isGemini3Model(params.model) ? { includeServerSideToolInvocations: true } : void 0
  });
  if (base.cachedContent || params.overrideRequestParams?.cachedContent) {
    delete base.systemInstruction;
    delete base.tools;
    delete base.toolConfig;
  }
  const {
    model: _model,
    reasoning_effort: _effort,
    ...override
  } = params.overrideRequestParams ?? {};
  return mergeGeminiRequest(base, override);
}
__name(createGeminiRequest, "createGeminiRequest");
function mergeGeminiRequest(base, override) {
  const result = Object.assign(/* @__PURE__ */ Object.create(null), base);
  for (const [key, value] of Object.entries(override)) {
    result[key] = value && typeof value === "object" && !Array.isArray(value) ? mergeGeminiRequest(
      result[key] && typeof result[key] === "object" ? result[key] : {},
      value
    ) : value;
  }
  return result;
}
__name(mergeGeminiRequest, "mergeGeminiRequest");
async function messagesToGeminiContents(requester, messages, toolNameMapper, model, signal) {
  const result = [];
  const systemParts = [];
  const toolNames = /* @__PURE__ */ new Map();
  let previousWasTool = false;
  for (const message of messages) {
    const type = message.getType();
    if (type === "system") {
      systemParts.push(
        ...await contentToParts(
          requester,
          message.content,
          model,
          signal
        )
      );
      previousWasTool = false;
      continue;
    }
    if (type === "tool") {
      const tool2 = message;
      const text = typeof tool2.content === "string" ? tool2.content : tool2.content.filter(import_string.isMessageContentText).map((part) => part.text).join("");
      const response = {
        name: toolNameMapper.sanitize(
          tool2.name ?? toolNames.get(tool2.tool_call_id)
        ),
        response: parseToolResponse(text),
        id: tool2.tool_call_id
      };
      const parts = [{ functionResponse: response }];
      if (Array.isArray(tool2.content)) {
        const media = await contentToParts(
          requester,
          tool2.content.filter(
            (part) => (0, import_string.isMessageContentImageUrl)(part) || isFileLikePart(part)
          ),
          model,
          signal
        );
        for (const part of media) {
          if (part.mediaProcessing || part.media_processing)
            parts.push(part);
          else (response.parts ??= []).push(part);
        }
      }
      if (previousWasTool) result[result.length - 1].parts.push(...parts);
      else result.push({ role: "user", parts });
      previousWasTool = true;
      continue;
    }
    previousWasTool = false;
    const ai = message;
    if (ai.tool_calls?.length) {
      const thoughtData2 = message.additional_kwargs?.thought_data ?? {};
      const shared = { ...thoughtData2 };
      for (const call of ai.tool_calls)
        if (call.id) delete shared[call.id];
      const parts = await contentToParts(
        requester,
        message.content,
        model,
        signal
      );
      parts.push(...getContextParts(shared));
      for (const toolCall of ai.tool_calls) {
        if (toolCall.id) toolNames.set(toolCall.id, toolCall.name);
        const saved = thoughtData2[toolCall.id] ?? thoughtData2;
        if (toolCall.id && thoughtData2[toolCall.id])
          parts.push(...getContextParts(saved));
        const signature = findThoughtSignature(saved);
        parts.push({
          functionCall: {
            name: toolNameMapper.sanitize(toolCall.name),
            args: toolCall.args,
            id: toolCall.id
          },
          ...signature ? { thoughtSignature: signature } : {}
        });
      }
      result.push({
        role: "model",
        parts
      });
      continue;
    }
    const thoughtData = message.additional_kwargs?.thought_data ?? {};
    result.push({
      role: type === "ai" ? "model" : "user",
      parts: [
        ...getContextParts(thoughtData),
        ...await contentToParts(
          requester,
          message.content,
          model,
          signal
        )
      ]
    });
  }
  return filterEmpty({
    contents: result,
    systemInstruction: systemParts.length > 0 ? { parts: systemParts } : void 0
  });
}
__name(messagesToGeminiContents, "messagesToGeminiContents");
async function contentToParts(requester, content, model, signal) {
  if (typeof content === "string") return content ? [{ text: content }] : [];
  const config = requester.currentConfig();
  const agentic = config.agenticVideo && AGENTIC_VIDEO_MODELS.some(
    (id) => prepareGeminiModelId(model).includes(id)
  );
  const mediaPart = /* @__PURE__ */ __name((mimeType, data) => {
    const mode = agentic && mimeType.startsWith("video/") ? "AGENTIC" : void 0;
    return config.useCamelCaseMediaFields ? filterEmpty({
      inlineData: { mimeType, data },
      mediaProcessing: mode
    }) : filterEmpty({
      inline_data: { mime_type: mimeType, data },
      media_processing: mode
    });
  }, "mediaPart");
  const prepareMedia = /* @__PURE__ */ __name(async (mimeType, buffer) => {
    if (!config.geminiFileUpload)
      return mediaPart(mimeType, buffer.toString("base64"));
    const file2 = await requester.geminiResources().upload(buffer, mimeType, signal);
    const mode = agentic && mimeType.startsWith("video/") ? "AGENTIC" : void 0;
    return config.useCamelCaseMediaFields ? filterEmpty({
      fileData: { mimeType, fileUri: file2.uri },
      mediaProcessing: mode
    }) : filterEmpty({
      file_data: { mime_type: mimeType, file_uri: file2.uri },
      media_processing: mode
    });
  }, "prepareMedia");
  const parts = await Promise.all(
    content.map(async (part) => {
      if ((0, import_string.isMessageContentText)(part)) {
        return part.text.length > 0 ? { text: part.text } : null;
      }
      if ((0, import_string.isMessageContentImageUrl)(part)) {
        const url = await (0, import_v1_shared_adapter6.fetchImageUrl)(
          requester.requestContext().plugin,
          part
        );
        const mimeType = url.match(/^data:([^;]+);base64,/)?.[1] ?? "image/jpeg";
        return prepareMedia(
          mimeType,
          Buffer.from(
            url.replace(/^data:[^;]+;base64,/, ""),
            "base64"
          )
        );
      }
      if (isFileLikePart(part)) {
        const value = part[part.type];
        if (value?.fileUri || value?.file_uri)
          return config.useCamelCaseMediaFields ? {
            fileData: {
              fileUri: value.fileUri ?? value.file_uri,
              mimeType: value.mimeType ?? value.mime_type
            }
          } : {
            file_data: {
              file_uri: value.fileUri ?? value.file_uri,
              mime_type: value.mimeType ?? value.mime_type
            }
          };
        const file2 = await (0, import_v1_shared_adapter6.fetchFileLikeUrl)(
          requester.requestContext().plugin,
          part
        );
        return prepareMedia(file2.mimeType, file2.buffer);
      }
      return part;
    })
  );
  return parts.filter(Boolean);
}
__name(contentToParts, "contentToParts");
var AGENTIC_VIDEO_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.6-flash",
  "gemini-3.7-flash",
  "gemini-3.8-flash"
];
function isMediaProcessingPart(part) {
  const tool2 = part.toolCall ?? part.toolResponse;
  return tool2 != null && (tool2.toolType == null || tool2.toolType === "MEDIA_PROCESSING");
}
__name(isMediaProcessingPart, "isMediaProcessingPart");
function getContextParts(value) {
  const result = [];
  const seen = /* @__PURE__ */ new Set();
  const visit = /* @__PURE__ */ __name((part) => {
    if (!part || typeof part !== "object" || seen.has(part)) return;
    seen.add(part);
    if (part.toolCall || part.toolResponse || part.executableCode || part.codeExecutionResult) {
      if (!isMediaProcessingPart(part)) result.push(part);
    } else Object.values(part).forEach(visit);
  }, "visit");
  visit(value);
  return result;
}
__name(getContextParts, "getContextParts");
function findThoughtSignature(value) {
  if (typeof value?.thoughtSignature === "string")
    return value.thoughtSignature;
  if (value && typeof value === "object") {
    for (const part of Object.values(value)) {
      const signature = findThoughtSignature(part);
      if (signature) return signature;
    }
  }
}
__name(findThoughtSignature, "findThoughtSignature");
function geminiTools(requester, tools, model, toolNameMapper) {
  const result = [];
  const functionDeclarations = tools.map((tool2) => ({
    name: toolNameMapper.sanitize(tool2.name),
    description: tool2.description,
    parameters: sanitizeGeminiSchema(
      (0, import_v1_shared_adapter6.removeAdditionalProperties)(
        (0, import_types6.isZodSchemaV3)(tool2.schema) ? (0, import_zod_to_json_schema.zodToJsonSchema)(tool2.schema) : tool2.schema
      )
    )
  }));
  const builtinTools = functionDeclarations.length > 0 && !isGemini3Model(model) ? [] : geminiBuiltinTools(requester, model);
  if (functionDeclarations.length > 0) {
    result.push({ functionDeclarations });
  }
  result.push(...builtinTools);
  return result.length > 0 ? result : void 0;
}
__name(geminiTools, "geminiTools");
var GEMINI_SCHEMA_KEYS = /* @__PURE__ */ new Set([
  "type",
  "format",
  "title",
  "description",
  "nullable",
  "default",
  "example",
  "enum",
  "items",
  "minItems",
  "maxItems",
  "minLength",
  "maxLength",
  "minProperties",
  "maxProperties",
  "minimum",
  "maximum",
  "pattern",
  "properties",
  "required",
  "propertyOrdering",
  "anyOf"
]);
function sanitizeGeminiSchema(schema) {
  if (!schema || typeof schema !== "object" || Array.isArray(schema))
    return schema;
  const result = {};
  for (const [key, value] of Object.entries(schema)) {
    if ((key === "oneOf" || key === "anyOf") && Array.isArray(value))
      result.anyOf = value.map(sanitizeGeminiSchema);
    else if (key === "properties" && value && typeof value === "object") {
      result.properties = Object.fromEntries(
        Object.entries(value).map(([name2, sub]) => [
          name2,
          sanitizeGeminiSchema(sub)
        ])
      );
    } else if (key === "items") result.items = sanitizeGeminiSchema(value);
    else if (GEMINI_SCHEMA_KEYS.has(key)) result[key] = value;
  }
  return result;
}
__name(sanitizeGeminiSchema, "sanitizeGeminiSchema");
function geminiBuiltinTools(requester, model) {
  const config = requester.currentConfig();
  const lower = prepareGeminiModelId(model);
  const unsupported = lower.includes("gemini-2.0-flash-lite") || lower.includes("gemini-2.0-flash-exp");
  if (unsupported) return [];
  const result = [];
  if (config.googleSearch) result.push({ googleSearch: {} });
  if (config.codeExecution) result.push({ codeExecution: {} });
  if (config.urlContext) result.push({ urlContext: {} });
  return result;
}
__name(geminiBuiltinTools, "geminiBuiltinTools");
function isGemini3Model(model) {
  return prepareGeminiModelId(model).includes("gemini-3");
}
__name(isGemini3Model, "isGemini3Model");
function supportsGeminiThinkingConfig(model) {
  const id = prepareGeminiModelId(model);
  if (!id) return false;
  return id.includes("gemini-2.5") || id.includes("gemini-3") || id.includes("gemini-flash-latest") || id.includes("gemini-pro-latest") || id.includes("gemini-flash-lite-latest");
}
__name(supportsGeminiThinkingConfig, "supportsGeminiThinkingConfig");
function createGeminiThinkingConfig(model, effort, current) {
  if (!supportsGeminiThinkingConfig(model)) return void 0;
  const suffixBudget = effort == null ? void 0 : geminiThinkingBudgetForEffort(effort);
  const hasProviderConfig = current.includeThoughts === true || current.thinkingBudget != null;
  const hasSuffixConfig = suffixBudget != null;
  if (!hasProviderConfig && !hasSuffixConfig) return void 0;
  const shared = {
    includeThoughts: current.includeThoughts === true
  };
  if (isGemini3Model(model)) {
    const thinkingLevel = effort == null ? geminiThinkingLevelForBudget(current.thinkingBudget) : geminiThinkingLevelForEffort(effort);
    return filterEmpty({
      ...shared,
      thinkingLevel,
      ...effort === "none" ? { includeThoughts: false } : {}
    });
  }
  return filterEmpty({
    ...shared,
    thinkingBudget: suffixBudget ?? current.thinkingBudget ?? -1
  });
}
__name(createGeminiThinkingConfig, "createGeminiThinkingConfig");
function geminiThinkingBudgetForEffort(effort) {
  if (effort === "none") return 0;
  if (effort === "minimal") return 128;
  if (effort === "low") return 1024;
  if (effort === "medium") return 8192;
  if (effort === "high") return 24576;
  if (effort === "xhigh" || effort === "max") return 24576;
}
__name(geminiThinkingBudgetForEffort, "geminiThinkingBudgetForEffort");
function geminiThinkingLevelForEffort(effort) {
  if (effort === "none" || effort === "minimal" || effort === "low") {
    return "low";
  }
  if (effort === "medium") return "medium";
  return "high";
}
__name(geminiThinkingLevelForEffort, "geminiThinkingLevelForEffort");
function geminiThinkingLevelForBudget(budget) {
  if (budget == null || budget < 0) return "medium";
  if (budget <= 1024) return "low";
  if (budget <= 24576) return "medium";
  return "high";
}
__name(geminiThinkingLevelForBudget, "geminiThinkingLevelForBudget");
function supportsGeminiImageGeneration(model) {
  const id = prepareGeminiModelId(model);
  return id.startsWith("gemini-") && id.includes("image");
}
__name(supportsGeminiImageGeneration, "supportsGeminiImageGeneration");
function prepareGeminiModelId(model) {
  const normalized = (model ?? "").replace(/^models\//, "");
  return (0, import_v1_shared_adapter6.parseOpenAIModelNameWithReasoningEffort)(
    normalized
  ).model.toLowerCase();
}
__name(prepareGeminiModelId, "prepareGeminiModelId");
function createGeminiToolNameMapper(tools) {
  const sanitizeMap = /* @__PURE__ */ new Map();
  const restoreMap = /* @__PURE__ */ new Map();
  const used = /* @__PURE__ */ new Set();
  for (const tool2 of tools) {
    const original = tool2.name || "";
    const sanitized = sanitizeGeminiToolName(original, used);
    sanitizeMap.set(original, sanitized);
    restoreMap.set(sanitized, original);
  }
  return {
    sanitize(name2) {
      const original = name2 || "";
      if (sanitizeMap.has(original))
        return sanitizeMap.get(original) ?? original;
      const sanitized = sanitizeGeminiToolName(original, used);
      sanitizeMap.set(original, sanitized);
      restoreMap.set(sanitized, original);
      return sanitized;
    },
    restore(name2) {
      const value = name2 || "";
      return restoreMap.get(value) ?? value;
    }
  };
}
__name(createGeminiToolNameMapper, "createGeminiToolNameMapper");
function sanitizeGeminiToolName(name2, used) {
  const fallback = "tool";
  const normalized = (name2 || fallback).normalize("NFKC").replace(/[^a-zA-Z0-9_.:-]+/g, "_").replace(/^[^a-zA-Z_]+/, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "").slice(0, 128);
  let result = normalized || fallback;
  if (!/^[A-Za-z_]/.test(result)) {
    result = `_${result}`;
  }
  result = result.slice(0, 128);
  let unique2 = result;
  let index = 2;
  while (used.has(unique2)) {
    const suffix = `_${index++}`;
    unique2 = `${result.slice(0, Math.max(1, 128 - suffix.length))}${suffix}`;
  }
  used.add(unique2);
  return unique2;
}
__name(sanitizeGeminiToolName, "sanitizeGeminiToolName");
async function parseGeminiResponse(text, requester, toolNameMapper, streamState = { nextToolIndex: 0, partIndex: 0 }) {
  const data = JSON.parse(text);
  const candidate = data.candidates?.[0];
  const finishReason = candidate?.finishReason;
  const failure = data.error?.message ?? data.promptFeedback?.blockReason ?? (finishReason && !["STOP", "MAX_TOKENS", "FINISH_REASON_UNSPECIFIED"].includes(
    finishReason
  ) ? finishReason : void 0);
  if (failure) {
    throw new import_error3.ChatLunaError(
      import_error3.ChatLunaErrorCode.API_REQUEST_FAILED,
      new Error(`Gemini generation failed: ${failure}`)
    );
  }
  if (!candidate && !data.usageMetadata) {
    throw new import_error3.ChatLunaError(
      import_error3.ChatLunaErrorCode.API_REQUEST_FAILED,
      new Error("Gemini returned no candidate")
    );
  }
  const usage2 = data.usageMetadata ? (0, import_v1_shared_adapter6.createUsageMetadata)({
    inputTokens: data.usageMetadata.promptTokenCount,
    outputTokens: data.usageMetadata.candidatesTokenCount ?? data.candidates?.[0]?.tokenCount,
    totalTokens: data.usageMetadata.totalTokenCount,
    cacheReadTokens: data.usageMetadata.cachedContentTokenCount,
    reasoningTokens: data.usageMetadata.thoughtsTokenCount
  }) : void 0;
  let content = "";
  let reasoning = "";
  const toolCalls = [];
  const thoughtData = {};
  const images = [];
  const mediaContent = [];
  for (const candidate2 of (data.candidates ?? []).slice(0, 1)) {
    for (const part of candidate2.content?.parts ?? []) {
      const key = `part_${streamState.partIndex++}`;
      if (part.toolCall || part.toolResponse || part.executableCode || part.codeExecutionResult) {
        if (!isMediaProcessingPart(part))
          thoughtData[key] = { parts: [part] };
      } else if (typeof part.thoughtSignature === "string" && !part.functionCall) {
        thoughtData[key] = {
          parts: [{ thoughtSignature: part.thoughtSignature }]
        };
      }
      if (part.text && part.thought) {
        reasoning += part.text;
      } else if (part.text) {
        content += part.text;
      } else if (part.functionCall) {
        const fresh = part.functionCall.name != null || streamState.currentToolIndex == null;
        if (fresh) {
          streamState.currentToolIndex = streamState.nextToolIndex++;
          streamState.currentToolId = part.functionCall.id ?? `function_call_${streamState.currentToolIndex}`;
        }
        const id = streamState.currentToolId;
        toolCalls.push({
          name: fresh ? toolNameMapper.restore(part.functionCall.name) : void 0,
          args: part.functionCall.args,
          id: fresh ? id : void 0,
          index: streamState.currentToolIndex
        });
        if (typeof part.thoughtSignature === "string") {
          thoughtData[id] = {
            thoughtSignature: part.thoughtSignature
          };
        }
      } else if (part.inlineData?.data || part.inline_data?.data) {
        const inline = part.inlineData ?? part.inline_data;
        const mime = inline.mimeType ?? inline.mime_type ?? "image/png";
        const url = `data:${mime};base64,${inline.data}`;
        if (mime.startsWith("image/")) {
          images.push(url);
          mediaContent.push({ type: "image_url", image_url: url });
        } else if (mime.startsWith("audio/")) {
          mediaContent.push({
            type: "audio_url",
            audio_url: { url, mimeType: mime }
          });
        } else {
          mediaContent.push({
            type: "file_url",
            file_url: { url, mimeType: mime }
          });
        }
      }
    }
    if (requester.currentConfig().groundingContentDisplay) {
      const grounding = formatGrounding(candidate2.groundingMetadata);
      if (grounding) content += `
${grounding}`;
    }
  }
  const message = new import_messages4.AIMessageChunk({
    content: mediaContent.length > 0 ? [{ type: "text", text: content }, ...mediaContent] : content,
    tool_call_chunks: toolCalls.map((toolCall) => ({
      name: toolCall.name,
      args: typeof toolCall.args === "string" ? toolCall.args : JSON.stringify(toolCall.args ?? {}),
      id: toolCall.id,
      index: toolCall.index
    })),
    usage_metadata: usage2,
    response_metadata: filterEmpty({
      finishReason,
      finishMessage: candidate?.finishMessage,
      promptFeedback: data.promptFeedback
    }),
    additional_kwargs: {
      images: images.length > 0 ? images : void 0,
      reasoning_content: reasoning || void 0,
      thought_data: Object.keys(thoughtData).length > 0 ? thoughtData : void 0
    }
  });
  return new import_outputs5.ChatGenerationChunk({
    generationInfo: filterEmpty({ usage_metadata: usage2, finishReason }),
    message,
    text: (0, import_string.getMessageContent)(message.content) ?? content
  });
}
__name(parseGeminiResponse, "parseGeminiResponse");
function prepareGeminiModel(model, requester) {
  let result = (0, import_v1_shared_adapter6.parseOpenAIModelNameWithReasoningEffort)(model).model;
  if (requester.currentConfig().googleSearch && result.endsWith("-search")) {
    result = result.slice(0, -"-search".length);
  }
  return result.replace(/^models\//, "");
}
__name(prepareGeminiModel, "prepareGeminiModel");
function parseToolResponse(value) {
  try {
    const parsed = JSON.parse(value);
    return parsed != null && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : { response: parsed };
  } catch {
    return { response: value };
  }
}
__name(parseToolResponse, "parseToolResponse");
function formatGrounding(metadata) {
  const chunks = metadata?.groundingChunks ?? [];
  if (!chunks.length) return "";
  return chunks.map(
    (item, index) => item.web?.uri ? `[^${index}]: [${item.web.title ?? item.web.uri}](${item.web.uri})` : ""
  ).filter(Boolean).join("\n");
}
__name(formatGrounding, "formatGrounding");
function createSafetySettings() {
  return [
    { category: "HARM_CATEGORY_HARASSMENT", threshold: "OFF" },
    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "OFF" },
    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "OFF" },
    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "OFF" },
    { category: "HARM_CATEGORY_CIVIC_INTEGRITY", threshold: "OFF" }
  ];
}
__name(createSafetySettings, "createSafetySettings");
function filterEmpty(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== void 0)
  );
}
__name(filterEmpty, "filterEmpty");
function isFileLikePart(part) {
  return part != null && typeof part === "object" && ["file_url", "audio_url", "video_url"].includes(part.type);
}
__name(isFileLikePart, "isFileLikePart");

// src/adapters/dify.ts
var import_messages5 = require("@langchain/core/messages");
var import_outputs6 = require("@langchain/core/outputs");
var import_fs = __toESM(require("fs"), 1);
var import_path = __toESM(require("path"), 1);
var import_promises = require("fs/promises");
var import_url = require("url");
var import_sse5 = require("koishi-plugin-chatluna/utils/sse");
var import_string2 = require("koishi-plugin-chatluna/utils/string");
var import_error4 = require("koishi-plugin-chatluna/utils/error");
var import_v1_shared_adapter7 = require("@chatluna/v1-shared-adapter");
var import_types7 = require("koishi-plugin-chatluna/llm-core/platform/types");
var difyAdapter = {
  id: "dify",
  async completion(requester, params) {
    let generation = new import_outputs6.ChatGenerationChunk({
      message: new import_messages5.AIMessageChunk({ content: "" }),
      text: ""
    });
    for await (const chunk of difyCompletionStream(requester, params)) {
      generation = generation.concat(chunk);
    }
    return generation;
  },
  async *completionStream(requester, params) {
    yield* difyCompletionStream(requester, params);
  },
  async *completionStreamInternal(requester, params) {
    yield* difyCompletionStream(requester, params);
  },
  async embeddings(requester, params) {
    throw new import_error4.ChatLunaError(
      import_error4.ChatLunaErrorCode.API_REQUEST_FAILED,
      new Error(`Dify does not provide embeddings for ${params.model}.`)
    );
  },
  async rerank(requester, params) {
    throw new import_error4.ChatLunaError(
      import_error4.ChatLunaErrorCode.API_REQUEST_FAILED,
      new Error(`Dify does not provide rerank for ${params.model}.`)
    );
  },
  async getModels(requester, config) {
    return await difyModels(requester, config?.signal);
  },
  async dispose(requester, model, id) {
    await disposeDifyConversation(requester, model, id);
  }
};
async function* difyCompletionStream(requester, params) {
  const config = resolveDifyApp(requester, params.model);
  const conversationId = resolveChatLunaConversationId(params);
  const difyUser = resolveDifyUser(requester, params);
  const difyConversationId = config.appType === "workflow" || config.appType === "completion" || !conversationId ? void 0 : await getDifyConversationId(requester, conversationId, config);
  const response = await callDify(requester, params, config, {
    chatLunaConversationId: conversationId,
    difyConversationId,
    difyUser
  });
  await (0, import_sse5.checkResponse)(response);
  let updatedDifyConversationId;
  let usage2;
  for await (const event of (0, import_sse5.sseIterable)(response)) {
    if (!event.data || event.data === "[DONE]") continue;
    const data = parseDifyEvent(event.data);
    if (isDifyErrorEvent(data)) {
      throw new import_error4.ChatLunaError(
        import_error4.ChatLunaErrorCode.API_REQUEST_FAILED,
        new Error(formatDifyError(data, event.data))
      );
    }
    updatedDifyConversationId = data.conversation_id ?? updatedDifyConversationId;
    usage2 = usageFromDify(data.metadata?.usage ?? data.data?.usage) ?? usageFromWorkflowData(data.data) ?? usage2;
    const content = textFromDifyEvent(data, config);
    if (content) {
      yield createDifyChunk(content, usage2);
    }
    if (isDifyTerminalEvent(data.event, config.appType)) {
      break;
    }
  }
  if (conversationId && updatedDifyConversationId && config.appType !== "workflow" && config.appType !== "completion") {
    await updateDifyConversationId(
      requester,
      conversationId,
      config,
      updatedDifyConversationId,
      difyUser
    );
  }
  if (usage2) {
    yield createDifyChunk("", usage2);
  }
}
__name(difyCompletionStream, "difyCompletionStream");
async function callDify(requester, params, config, context) {
  const lastMessage = params.input?.[params.input.length - 1];
  const { files, chatlunaMultimodal } = await prepareDifyFiles(
    requester,
    params,
    lastMessage,
    config,
    context.difyUser
  );
  const inputs = buildDifyInputs(
    params,
    context.chatLunaConversationId,
    lastMessage,
    config,
    chatlunaMultimodal
  );
  if (config.appType === "workflow") {
    const workflowInputs = withWorkflowFileInputs(inputs, files, config);
    const body2 = filterEmpty2({
      inputs: workflowInputs,
      response_mode: "streaming",
      user: context.difyUser,
      files: files.length > 0 ? files : void 0
    });
    const path2 = config.workflowId ? `/workflows/${encodeURIComponent(config.workflowId)}/run` : "/workflows/run";
    return postDify(requester, config, path2, body2, params.signal);
  }
  if (config.appType === "completion") {
    const query2 = buildDifyQuery(params, lastMessage, config, inputs);
    const body2 = filterEmpty2({
      inputs,
      query: query2,
      response_mode: "streaming",
      user: context.difyUser,
      files: files.length > 0 ? files : void 0
    });
    return postDify(
      requester,
      config,
      "/completion-messages",
      body2,
      params.signal
    );
  }
  const query = buildDifyQuery(params, lastMessage, config, inputs);
  const body = filterEmpty2({
    query,
    inputs,
    response_mode: "streaming",
    user: context.difyUser,
    conversation_id: context.difyConversationId ?? "",
    files: files.length > 0 ? files : void 0
  });
  return postDify(requester, config, "/chat-messages", body, params.signal);
}
__name(callDify, "callDify");
async function difyModels(requester, signal) {
  const apps = await resolveDifyAppsWithParameters(requester, signal);
  const result = apps.map((app) => ({
    name: app.modelName,
    type: void 0,
    maxTokens: app.contextSize,
    capabilities: difyCapabilities(app)
  }));
  if (result.length > 0) return result;
  const current = await enrichDifyAppParameters(
    requester,
    resolveDifyApp(requester, void 0),
    signal
  );
  const modelName = resolveDifyModelName(current);
  return [
    {
      name: modelName,
      maxTokens: current.contextSize,
      capabilities: difyCapabilities(current)
    }
  ];
}
__name(difyModels, "difyModels");
function resolveDifyApp(requester, model) {
  const apps = requester.currentConfig().difyApps ?? {};
  const key = model?.trim() ?? "";
  const app = key ? apps[key] : Object.values(apps)[0];
  if (app) return app;
  if (key && Object.keys(apps).length > 0) {
    throw new import_error4.ChatLunaError(
      import_error4.ChatLunaErrorCode.MODEL_NOT_FOUND,
      new Error(`Dify app not found for model: ${key}`)
    );
  }
  const current = requester.currentConfig();
  return {
    apiKey: current.apiKey,
    apiEndpoint: current.apiEndpoint ?? "",
    platform: current.platform ?? "hub-dify",
    providerName: current.providerName,
    modelName: resolveDifyModelName(current),
    appType: current.difyAppType ?? "chat",
    workflowId: current.difyWorkflowId,
    outputVariable: current.difyOutputVariable,
    enableFileUpload: current.difyEnableFileUpload !== false,
    contextSize: current.difyContextSize ?? 128e3
  };
}
__name(resolveDifyApp, "resolveDifyApp");
async function resolveDifyAppsWithParameters(requester, signal) {
  const config = requester.currentConfig();
  const apps = Object.values(config.difyApps ?? {});
  const normalized = apps.length > 0 ? apps : [resolveDifyApp(requester, void 0)];
  const seen = /* @__PURE__ */ new Map();
  const result = [];
  for (const app of normalized) {
    const next = await enrichDifyAppParameters(requester, app, signal);
    const baseName = next.modelName;
    const index = seen.get(baseName) ?? 0;
    seen.set(baseName, index + 1);
    const unique2 = {
      ...next,
      modelName: index === 0 ? baseName : `${baseName}-${index + 1}`
    };
    result.push(unique2);
    if (config.difyApps != null) {
      delete config.difyApps[app.modelName];
      config.difyApps[unique2.modelName] = unique2;
    }
  }
  return result;
}
__name(resolveDifyAppsWithParameters, "resolveDifyAppsWithParameters");
async function enrichDifyAppParameters(requester, config, signal) {
  const parameters = await getDifyAppParameters(requester, config, signal);
  if (!parameters) return config;
  return {
    ...config,
    parameters: {
      inputControls: parseDifyInputControls(parameters),
      fileHandling: parseDifyFileHandling(parameters)
    }
  };
}
__name(enrichDifyAppParameters, "enrichDifyAppParameters");
async function getDifyAppParameters(requester, config, signal) {
  try {
    const response = await requester.requestContext().plugin.fetch(
      concatDifyUrl(config.apiEndpoint, "/parameters"),
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${config.apiKey}`
        },
        signal
      }
    );
    if (!response.ok) {
      requester.logger.warn(
        `Dify parameters fetch failed for ${config.modelName}: ${response.status} ${response.statusText}`
      );
      return void 0;
    }
    return await response.json();
  } catch (error) {
    requester.logger.warn(error);
    return void 0;
  }
}
__name(getDifyAppParameters, "getDifyAppParameters");
function parseDifyInputControls(parameters) {
  const result = [];
  for (const item of parameters.user_input_form ?? []) {
    const [type, control] = Object.entries(item)[0] ?? [];
    if (!type || !control?.variable) continue;
    result.push({
      variable: control.variable,
      type,
      required: control.required,
      defaultValue: control.default
    });
  }
  return result;
}
__name(parseDifyInputControls, "parseDifyInputControls");
function isDifyFileControlType(type) {
  return type != null && /file/i.test(type);
}
__name(isDifyFileControlType, "isDifyFileControlType");
function parseDifyFileHandling(parameters) {
  const system = parameters.system_parameters;
  const imageUpload = parameters.file_upload?.image;
  const imageEnabled = imageUpload?.enabled === true && (imageUpload.transfer_methods == null || imageUpload.transfer_methods.some(
    (method) => method === "local_file" || method === "remote_url"
  ));
  const supportedMimeTypes = /* @__PURE__ */ new Set();
  const allowedFileTypes = [];
  const allowedTransferMethods = /* @__PURE__ */ new Set();
  const declaredFileControls = parameters.user_input_form?.map((item) => Object.entries(item)[0]).filter(([type]) => isDifyFileControlType(type)).map(([, control]) => control) ?? [];
  const controlFileTypes = /* @__PURE__ */ new Set();
  for (const control of declaredFileControls) {
    for (const type of control?.allowed_file_types ?? []) {
      controlFileTypes.add(type);
    }
    for (const method of control?.allowed_file_upload_methods ?? []) {
      addDifyTransferMethod(allowedTransferMethods, method);
    }
  }
  const workflowFileEnabled = declaredFileControls.length > 0 || configHasWorkflowFileLimit(parameters) && controlFileTypes.size > 0;
  if (workflowFileEnabled) {
    const types = controlFileTypes.size > 0 ? [...controlFileTypes] : ["document", "image", "audio", "video"];
    for (const type of types) {
      addDifyFileType(supportedMimeTypes, allowedFileTypes, type);
    }
  }
  if (imageEnabled) {
    addDifyFileType(supportedMimeTypes, allowedFileTypes, "image");
    for (const method of imageUpload?.transfer_methods ?? []) {
      addDifyTransferMethod(allowedTransferMethods, method);
    }
  }
  if (supportedMimeTypes.size > 0 && allowedTransferMethods.size < 1) {
    allowedTransferMethods.add("local_file");
  }
  if (supportedMimeTypes.size < 1) return void 0;
  const fallbackLimit = mbToBytes(system?.file_size_limit, 15);
  const imageLimit = mbToBytes(
    system?.image_file_size_limit,
    fallbackLimit / 1024 / 1024
  );
  const audioLimit = mbToBytes(
    system?.audio_file_size_limit,
    fallbackLimit / 1024 / 1024
  );
  const videoLimit = mbToBytes(
    system?.video_file_size_limit,
    fallbackLimit / 1024 / 1024
  );
  const maxFileSizeBytes = Math.max(
    fallbackLimit,
    imageLimit,
    audioLimit,
    videoLimit
  );
  const maxFileCount = system?.workflow_file_upload_limit ?? imageUpload?.number_limits ?? 10;
  return {
    supportedMimeTypes: [...supportedMimeTypes],
    maxFileSizeBytes,
    maxTotalSizeBytes: maxFileSizeBytes * Math.max(1, maxFileCount),
    maxFileSizeBytesOverrides: {
      "image/png": imageLimit,
      "image/jpeg": imageLimit,
      "image/gif": imageLimit,
      "image/webp": imageLimit,
      "image/svg+xml": imageLimit,
      "audio/mpeg": audioLimit,
      "audio/mp4": audioLimit,
      "audio/wav": audioLimit,
      "audio/ogg": audioLimit,
      "video/mp4": videoLimit,
      "video/quicktime": videoLimit,
      "video/webm": videoLimit
    },
    maxFileCount,
    allowedFileTypes,
    allowedTransferMethods: [...allowedTransferMethods]
  };
}
__name(parseDifyFileHandling, "parseDifyFileHandling");
function addDifyTransferMethod(target, value) {
  if (value === "remote_url" || value === "local_file") target.add(value);
}
__name(addDifyTransferMethod, "addDifyTransferMethod");
function addDifyFileType(supportedMimeTypes, allowedFileTypes, type) {
  if (type === "custom") return;
  addMimeGroup(supportedMimeTypes, type);
  if (!allowedFileTypes.includes(type)) allowedFileTypes.push(type);
}
__name(addDifyFileType, "addDifyFileType");
function configHasWorkflowFileLimit(parameters) {
  const value = parameters.system_parameters?.workflow_file_upload_limit;
  return typeof value === "number" && value > 0;
}
__name(configHasWorkflowFileLimit, "configHasWorkflowFileLimit");
function addMimeGroup(target, type) {
  const groups = {
    image: [
      "image/png",
      "image/jpeg",
      "image/gif",
      "image/webp",
      "image/svg+xml"
    ],
    document: [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "text/plain",
      "text/markdown",
      "text/csv"
    ],
    audio: ["audio/mpeg", "audio/mp4", "audio/wav", "audio/ogg", "audio/webm"],
    video: ["video/mp4", "video/quicktime", "video/webm"],
    custom: []
  };
  for (const mime of groups[type]) target.add(mime);
}
__name(addMimeGroup, "addMimeGroup");
function mbToBytes(value, fallback) {
  const number = Number(value);
  const mb = Number.isFinite(number) ? number : fallback;
  return Math.max(1, mb) * 1024 * 1024;
}
__name(mbToBytes, "mbToBytes");
function difyCapabilities(config) {
  if (!config.enableFileUpload) return [];
  const allowed = config.parameters?.fileHandling?.allowedFileTypes;
  if (allowed == null || allowed.length < 1) return [];
  const result = /* @__PURE__ */ new Set();
  if (allowed.includes("image")) result.add(import_types7.ModelCapabilities.ImageInput);
  if (allowed.some((item) => item !== "image")) {
    result.add(import_types7.ModelCapabilities.FileInput);
  }
  if (allowed.includes("audio")) result.add(import_types7.ModelCapabilities.AudioInput);
  if (allowed.includes("video")) result.add(import_types7.ModelCapabilities.VideoInput);
  return [...result];
}
__name(difyCapabilities, "difyCapabilities");
function resolveDifyModelName(config) {
  return config.difyModelName?.trim() || config.providerName?.trim() || config.platform?.trim() || "dify-app";
}
__name(resolveDifyModelName, "resolveDifyModelName");
function parseDifyEvent(data) {
  try {
    return JSON.parse(data);
  } catch (error) {
    throw new import_error4.ChatLunaError(
      import_error4.ChatLunaErrorCode.API_REQUEST_FAILED,
      new Error(`Failed to parse Dify stream event: ${data}`)
    );
  }
}
__name(parseDifyEvent, "parseDifyEvent");
function textFromDifyEvent(data, config) {
  if (typeof data.answer === "string") return data.answer;
  if (typeof data.data?.text === "string") return data.data.text;
  if (config.appType === "workflow" && data.event != null && data.event !== "workflow_finished") {
    return "";
  }
  const outputs = data.data?.outputs;
  if (!outputs || typeof outputs !== "object") return "";
  const key = config.outputVariable?.trim();
  if (key && outputs[key] != null) return outputToText(outputs[key]);
  for (const candidate of ["answer", "text", "output", "result"]) {
    if (outputs[candidate] != null) return outputToText(outputs[candidate]);
  }
  return outputToText(outputs);
}
__name(textFromDifyEvent, "textFromDifyEvent");
function outputToText(value) {
  if (typeof value === "string") return value;
  if (value == null) return "";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
__name(outputToText, "outputToText");
function isDifyTerminalEvent(event, type) {
  if (event === "message_end") return true;
  if (event === "workflow_finished") return true;
  if (event === "tts_message_end") return false;
  return type === "completion" && event === "message_end";
}
__name(isDifyTerminalEvent, "isDifyTerminalEvent");
function isDifyErrorEvent(data) {
  return data.event === "error" || data.status === 400 || data.status === 500 || data.data?.status === "failed" || data.data?.status === "stopped";
}
__name(isDifyErrorEvent, "isDifyErrorEvent");
function formatDifyError(data, raw) {
  return data.message || data.error || data.data?.error || (data.code ? `${data.code}: ${raw}` : `Dify request failed: ${raw}`);
}
__name(formatDifyError, "formatDifyError");
function createDifyChunk(content, usage2) {
  const message = new import_messages5.AIMessageChunk({
    content,
    usage_metadata: usage2
  });
  return new import_outputs6.ChatGenerationChunk({
    generationInfo: usage2 ? { usage_metadata: usage2 } : void 0,
    message,
    text: content
  });
}
__name(createDifyChunk, "createDifyChunk");
function usageFromDify(usage2) {
  if (!usage2) return void 0;
  const inputTokens = numberOrUndefined(usage2.prompt_tokens) ?? 0;
  const outputTokens = numberOrUndefined(usage2.completion_tokens) ?? 0;
  const totalTokens = numberOrUndefined(usage2.total_tokens) ?? inputTokens + outputTokens;
  if (totalTokens < 1 && inputTokens < 1 && outputTokens < 1) return void 0;
  return (0, import_v1_shared_adapter7.createUsageMetadata)({
    inputTokens,
    outputTokens,
    totalTokens
  });
}
__name(usageFromDify, "usageFromDify");
function usageFromWorkflowData(data) {
  const totalTokens = numberOrUndefined(data?.total_tokens) ?? numberOrUndefined(data?.execution_metadata?.total_tokens);
  if (totalTokens == null) return void 0;
  return (0, import_v1_shared_adapter7.createUsageMetadata)({
    inputTokens: 0,
    outputTokens: 0,
    totalTokens
  });
}
__name(usageFromWorkflowData, "usageFromWorkflowData");
function numberOrUndefined(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : void 0;
}
__name(numberOrUndefined, "numberOrUndefined");
function resolveChatLunaConversationId(params) {
  return params.id ?? params.variables?.built?.conversationId ?? params.variables?.chatluna_conversation_id ?? resolveConversationIdFromMessages(params.input);
}
__name(resolveChatLunaConversationId, "resolveChatLunaConversationId");
function resolveConversationIdFromMessages(messages = []) {
  for (const message of messages) {
    const id = message.additional_kwargs?.chatluna_conversation_id ?? message.additional_kwargs?.conversationId ?? message.additional_kwargs?.conversation_id;
    if (typeof id === "string" && id.length > 0) return id;
  }
}
__name(resolveConversationIdFromMessages, "resolveConversationIdFromMessages");
function resolveDifyUser(requester, params) {
  if (requester.koishiContext().chatluna.config.defaultGroupRouteMode === "personal") {
    return params.variables?.user_id || params.variables?.user || params.user || "chatluna";
  }
  return "chatluna";
}
__name(resolveDifyUser, "resolveDifyUser");
function buildDifyInputs(params, conversationId, lastMessage, config, chatlunaMultimodal) {
  const variables = params.variables ?? {};
  const promptParts = promptPartsFromMessages(params.input ?? []);
  const query = (0, import_string2.getMessageContent)(lastMessage?.content ?? "");
  const character = resolveChatLunaCharacter(variables);
  const inputs = {
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
  };
  for (const key of Object.keys(variables)) {
    const alias = `chatluna_${key}`;
    if (inputs[alias] === void 0) inputs[alias] = variables[key];
  }
  for (const control of config?.parameters?.inputControls ?? []) {
    if (inputs[control.variable] !== void 0) continue;
    const resolved = resolveDifyControlValue(control, variables, query, inputs);
    if (resolved !== void 0) inputs[control.variable] = resolved;
  }
  return stripUndefined(inputs);
}
__name(buildDifyInputs, "buildDifyInputs");
function buildDifyQuery(params, lastMessage, config, inputs) {
  const query = (0, import_string2.getMessageContent)(lastMessage?.content ?? "") ?? "";
  const prefix = buildDifyCharacterQueryPrefix(params, config, inputs);
  if (!prefix) return query;
  if (!query.trim()) return prefix;
  return `${prefix}

${query}`;
}
__name(buildDifyQuery, "buildDifyQuery");
function buildDifyCharacterQueryPrefix(params, config, inputs) {
  if (config.appType === "workflow") return "";
  if (hasDeclaredCharacterInputs(config)) return "";
  const variables = params.variables ?? {};
  const source = firstDefined(variables.source, variables.built?.source);
  const character = stringifyForPrompt(inputs.chatluna_character);
  const persona = stringifyForPrompt(inputs.chatluna_persona);
  const characterName = stringifyForPrompt(inputs.chatluna_character_name);
  const system = stringifyForPrompt(inputs.chatluna_system_prompt);
  const preset = stringifyForPrompt(inputs.chatluna_preset);
  if (!character && !persona && !characterName && !system && !preset && source !== "character") {
    return "";
  }
  const parts = [];
  if (system) parts.push(system);
  if (preset) parts.push(`Preset: ${preset}`);
  if (characterName) parts.push(`Character name: ${characterName}`);
  if (persona) parts.push(`Persona: ${persona}`);
  if (character) parts.push(`Character data: ${character}`);
  return parts.length > 0 ? parts.join("\n") : "";
}
__name(buildDifyCharacterQueryPrefix, "buildDifyCharacterQueryPrefix");
function hasDeclaredCharacterInputs(config) {
  return (config.parameters?.inputControls ?? []).some(
    (control) => /(^|_)character($|_)|persona|preset|system/i.test(control.variable)
  );
}
__name(hasDeclaredCharacterInputs, "hasDeclaredCharacterInputs");
function firstDefined(...values) {
  return values.find((value) => value !== void 0 && value !== null);
}
__name(firstDefined, "firstDefined");
function resolveChatLunaCharacter(variables) {
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
  );
}
__name(resolveChatLunaCharacter, "resolveChatLunaCharacter");
function promptPartsFromMessages(messages = []) {
  const system = [];
  for (const message of messages) {
    if (message.getType() !== "system") continue;
    const content = extractTextFromMessageContent(message.content);
    if (content) system.push(content);
  }
  return {
    system: system.join("\n\n")
  };
}
__name(promptPartsFromMessages, "promptPartsFromMessages");
function resolveDifyControlValue(control, variables, query, inputs) {
  if (variables[control.variable] !== void 0) {
    return variables[control.variable];
  }
  if (inputs[`chatluna_${control.variable}`] !== void 0) {
    return inputs[`chatluna_${control.variable}`];
  }
  if (control.variable === "query" || control.variable === "input") {
    return query;
  }
  if (control.defaultValue !== void 0) return control.defaultValue;
  if (!control.required) return void 0;
  if (control.type === "number") return 0;
  if (control.type === "checkbox") return false;
  return "";
}
__name(resolveDifyControlValue, "resolveDifyControlValue");
function serializeDifyInputValue(value) {
  if (value == null || typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
__name(serializeDifyInputValue, "serializeDifyInputValue");
function stringifyForPrompt(value) {
  if (value == null) return "";
  const text = typeof value === "string" ? value : serializeDifyInputValue(value);
  return String(text ?? "").trim();
}
__name(stringifyForPrompt, "stringifyForPrompt");
function withWorkflowFileInputs(inputs, files, config) {
  if (files.length < 1) return inputs;
  const result = { ...inputs };
  const fileControls = config.parameters?.inputControls.filter(
    (control) => isDifyFileControlType(control.type)
  ) ?? [];
  const target = fileControls[0]?.variable;
  if (target && result[target] == null) {
    result[target] = files;
  }
  return result;
}
__name(withWorkflowFileInputs, "withWorkflowFileInputs");
function buildChatlunaHistory(messages = []) {
  const historyLimit = 13e4;
  const history = [];
  let totalLength = 0;
  for (const message of messages) {
    const content = extractTextFromMessageContent(message.content);
    if (!content) continue;
    const entry = {
      role: message.getType(),
      content
    };
    history.push(entry);
    totalLength += entry.content.length;
    while (totalLength > historyLimit) {
      if (history.length === 1) {
        entry.content = entry.content.slice(-historyLimit);
        totalLength = entry.content.length;
        break;
      }
      const removed = history.shift();
      if (!removed) break;
      totalLength -= removed.content.length;
    }
  }
  return JSON.stringify(history);
}
__name(buildChatlunaHistory, "buildChatlunaHistory");
function extractTextFromMessageContent(content) {
  if (typeof content === "string") return content;
  if (!content) return void 0;
  const parts = [];
  for (const part of content) {
    if ((0, import_string2.isMessageContentText)(part)) parts.push(part.text);
  }
  return parts.length > 0 ? parts.join("") : void 0;
}
__name(extractTextFromMessageContent, "extractTextFromMessageContent");
async function prepareDifyFiles(requester, params, lastMessage, config, difyUser) {
  const candidates = extractUploadCandidates(lastMessage);
  const chatlunaMultimodal = safeSerializeMultimodal(lastMessage, candidates);
  if (!config.enableFileUpload || candidates.length === 0) {
    return { files: [], chatlunaMultimodal };
  }
  const files = [];
  const maxCount = config.parameters?.fileHandling?.maxFileCount;
  const selected = maxCount != null && maxCount > 0 ? candidates.slice(0, maxCount) : candidates;
  if (selected.length < candidates.length) {
    requester.logger.warn(
      `Dify upload truncated to ${selected.length} files for ${config.modelName}.`
    );
  }
  for (const candidate of selected) {
    const file2 = await multimodalToDifyFile(
      requester,
      candidate,
      difyUser,
      config,
      params.signal
    );
    if (file2) files.push(file2);
  }
  return { files, chatlunaMultimodal };
}
__name(prepareDifyFiles, "prepareDifyFiles");
function extractUploadCandidates(lastMessage) {
  if (!lastMessage) return [];
  const candidates = [];
  const seen = /* @__PURE__ */ new Set();
  const add = /* @__PURE__ */ __name((source, type) => {
    const key = typeof source === "string" ? `${type}:${source}` : void 0;
    if (key && seen.has(key)) return;
    if (key) seen.add(key);
    candidates.push({ source, type });
  }, "add");
  const content = lastMessage.content;
  if (Array.isArray(content)) {
    for (const part of content) {
      if ((0, import_string2.isMessageContentImageUrl)(part)) {
        const imageUrl = part.image_url;
        const url = typeof imageUrl === "string" ? imageUrl : imageUrl?.url;
        if (url) add(url, "image");
      } else if (isFileLikePart2(part)) {
        const filePart = part;
        const url = filePart.file_url?.url ?? filePart.audio_url?.url ?? filePart.video_url?.url;
        const type = fileTypeFromPart(part.type);
        if (url) add(url, type);
      }
    }
  }
  return candidates;
}
__name(extractUploadCandidates, "extractUploadCandidates");
function isFileLikePart2(part) {
  return part != null && typeof part === "object" && ["file_url", "audio_url", "video_url"].includes(part.type);
}
__name(isFileLikePart2, "isFileLikePart");
function fileTypeFromPart(type) {
  if (type === "audio_url") return "audio";
  if (type === "video_url") return "video";
  return "document";
}
__name(fileTypeFromPart, "fileTypeFromPart");
async function multimodalToDifyFile(requester, candidate, difyUser, config, signal) {
  const remote = candidateToRemoteDifyFile(candidate, config);
  if (remote) return remote;
  if (!isDifyLocalFileTransferAllowed(config)) {
    requester.logger.warn(
      `Dify upload skipped local_file because ${config.modelName} does not allow local_file transfer.`
    );
    return null;
  }
  const payload = await resolveFilePayload(requester, candidate, signal);
  if (!payload) return null;
  if (!isDifyPayloadAllowed(requester, payload, candidate, config)) return null;
  const uploadFileId = await uploadFileToDify(
    requester,
    payload,
    difyUser,
    config,
    signal
  );
  if (!uploadFileId) return null;
  return {
    type: resolveDifyPayloadType(payload.mimeType, candidate.type),
    transfer_method: "local_file",
    upload_file_id: uploadFileId
  };
}
__name(multimodalToDifyFile, "multimodalToDifyFile");
function candidateToRemoteDifyFile(candidate, config) {
  if (typeof candidate.source !== "string") return null;
  if (!candidate.source.startsWith("http://") && !candidate.source.startsWith("https://")) {
    return null;
  }
  const methods = config.parameters?.fileHandling?.allowedTransferMethods;
  if (methods != null && !methods.includes("remote_url")) return null;
  return {
    type: candidate.type,
    transfer_method: "remote_url",
    url: candidate.source
  };
}
__name(candidateToRemoteDifyFile, "candidateToRemoteDifyFile");
function isDifyLocalFileTransferAllowed(config) {
  const methods = config.parameters?.fileHandling?.allowedTransferMethods;
  return methods == null || methods.includes("local_file");
}
__name(isDifyLocalFileTransferAllowed, "isDifyLocalFileTransferAllowed");
function isDifyPayloadAllowed(requester, payload, candidate, config) {
  const limits = config.parameters?.fileHandling;
  if (!limits) return true;
  const type = resolveDifyPayloadType(payload.mimeType, candidate.type);
  if (limits.allowedFileTypes != null && limits.allowedFileTypes.length > 0 && !limits.allowedFileTypes.includes(type)) {
    requester.logger.warn(
      `Dify upload skipped unsupported ${type} file for ${config.modelName}.`
    );
    return false;
  }
  const mimeType = payload.mimeType;
  if (mimeType && limits.supportedMimeTypes.length > 0 && !limits.supportedMimeTypes.includes(mimeType)) {
    requester.logger.warn(
      `Dify upload skipped unsupported mime type ${mimeType} for ${config.modelName}.`
    );
    return false;
  }
  const maxFileSize = (mimeType ? limits.maxFileSizeBytesOverrides?.[mimeType] : void 0) ?? limits.maxFileSizeBytes;
  if (payload.buffer.byteLength > maxFileSize) {
    requester.logger.warn(
      `Dify upload skipped oversized file ${payload.fileName} for ${config.modelName}.`
    );
    return false;
  }
  return true;
}
__name(isDifyPayloadAllowed, "isDifyPayloadAllowed");
function resolveDifyPayloadType(mimeType, fallback) {
  return mapMimeToFileType(mimeType) ?? fallback;
}
__name(resolveDifyPayloadType, "resolveDifyPayloadType");
async function resolveFilePayload(requester, candidate, signal) {
  const { source, fileName, mimeType } = candidate;
  if (typeof source === "string") {
    const dataUrlPayload = tryParseDataUrl(source, fileName, mimeType);
    if (dataUrlPayload) return dataUrlPayload;
    if (source.startsWith("http://") || source.startsWith("https://")) {
      return fetchRemoteFile(requester, source, fileName, mimeType, signal);
    }
    return readLocalFile(requester, source, fileName, mimeType);
  }
  const buffer = convertToBuffer(source);
  if (!buffer) return null;
  return {
    buffer,
    fileName: fileName ?? buildFallbackFileName(mimeType),
    mimeType
  };
}
__name(resolveFilePayload, "resolveFilePayload");
function tryParseDataUrl(source, preferredName, preferredMime) {
  const match = source.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  const mimeType = preferredMime ?? match[1];
  return {
    buffer: Buffer.from(match[2], "base64"),
    fileName: preferredName ?? buildFallbackFileName(mimeType),
    mimeType
  };
}
__name(tryParseDataUrl, "tryParseDataUrl");
async function readLocalFile(requester, source, preferredName, preferredMime) {
  try {
    const filePath = source.startsWith("file://") ? (0, import_url.fileURLToPath)(source) : source;
    if (!import_fs.default.existsSync(filePath)) return null;
    const buffer = await (0, import_promises.readFile)(filePath);
    const mimeType = preferredMime ?? guessMimeTypeFromPath(filePath);
    const rawName = import_path.default.basename(filePath);
    return {
      buffer,
      fileName: preferredName || (rawName.length > 0 ? rawName : buildFallbackFileName(mimeType)),
      mimeType
    };
  } catch (error) {
    requester.logger.warn(error);
    return null;
  }
}
__name(readLocalFile, "readLocalFile");
async function fetchRemoteFile(requester, source, preferredName, preferredMime, signal) {
  try {
    const response = await requester.requestContext().plugin.fetch(source, {
      method: "GET",
      signal
    });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type")?.split(";")?.[0];
    const fileName = preferredName ?? fileNameFromUrl(source, contentType);
    return {
      buffer: Buffer.from(await response.arrayBuffer()),
      fileName,
      mimeType: preferredMime ?? contentType
    };
  } catch (error) {
    requester.logger.warn(error);
    return null;
  }
}
__name(fetchRemoteFile, "fetchRemoteFile");
async function uploadFileToDify(requester, file2, difyUser, config, signal) {
  const formData = new FormData();
  const mimeType = file2.mimeType ?? "application/octet-stream";
  formData.set(
    "file",
    new Blob([new Uint8Array(file2.buffer)], { type: mimeType }),
    file2.fileName
  );
  formData.set("user", difyUser);
  const response = await requester.requestContext().plugin.fetch(
    concatDifyUrl(config.apiEndpoint, "/files/upload"),
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`
      },
      body: formData,
      signal
    }
  );
  if (!response.ok) {
    requester.logger.warn(
      `Failed to upload file to Dify: ${response.status} ${response.statusText}`
    );
    return null;
  }
  const result = await response.json().catch(async () => response.text());
  return typeof result === "object" && result != null ? result.data?.id ?? result.id : void 0;
}
__name(uploadFileToDify, "uploadFileToDify");
function postDify(requester, config, path2, body, signal) {
  return requester.requestContext().plugin.fetch(
    concatDifyUrl(config.apiEndpoint, path2),
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(stripUndefined(body)),
      signal
    }
  );
}
__name(postDify, "postDify");
function concatDifyUrl(endpoint, path2) {
  const base = endpoint.replace(/\/+$/, "");
  const next = path2.startsWith("/") ? path2 : `/${path2}`;
  return `${base}${next}`;
}
__name(concatDifyUrl, "concatDifyUrl");
async function getDifyConversationId(requester, conversationId, config) {
  const cached = await requester.koishiContext().chatluna.cache.get(
    "chatluna/keys",
    difyCacheKey(conversationId, config)
  );
  if (cached == null) return void 0;
  try {
    return JSON.parse(cached).id;
  } catch {
    return cached;
  }
}
__name(getDifyConversationId, "getDifyConversationId");
async function updateDifyConversationId(requester, conversationId, config, difyConversationId, user) {
  await requester.koishiContext().chatluna.cache.set(
    "chatluna/keys",
    difyCacheKey(conversationId, config),
    JSON.stringify({
      id: difyConversationId,
      user
    })
  );
}
__name(updateDifyConversationId, "updateDifyConversationId");
async function disposeDifyConversation(requester, model, id) {
  if (!model || !id) return;
  const config = resolveDifyApp(requester, model);
  if (config.appType === "workflow" || config.appType === "completion") {
    return;
  }
  const key = difyCacheKey(id, config);
  const cached = await requester.koishiContext().chatluna.cache.get("chatluna/keys", key);
  const difyConversationId = await getDifyConversationId(requester, id, config);
  if (!difyConversationId) return;
  let user = "chatluna";
  if (cached != null) {
    try {
      user = JSON.parse(cached).user ?? user;
    } catch {
    }
  }
  const response = await requester.requestContext().plugin.fetch(
    concatDifyUrl(config.apiEndpoint, `/conversations/${difyConversationId}`),
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ user })
    }
  );
  if (response.ok) {
    await requester.koishiContext().chatluna.cache.delete("chatluna/keys", key);
  } else {
    requester.logger.warn(`Dify clear failed: ${await response.text()}`);
  }
}
__name(disposeDifyConversation, "disposeDifyConversation");
function difyCacheKey(conversationId, config) {
  return `dify/${conversationId}/${config.platform}/${config.modelName}`;
}
__name(difyCacheKey, "difyCacheKey");
function safeSerializeMultimodal(lastMessage, candidates = []) {
  if (!lastMessage) return void 0;
  try {
    return JSON.stringify({
      has_files: candidates.length > 0,
      file_count: candidates.length,
      files: candidates.slice(0, 5).map((item, index) => ({
        idx: index,
        type: item.type,
        source: typeof item.source === "string" ? item.source.slice(0, 64) : void 0
      }))
    }).slice(0, 256);
  } catch {
    return void 0;
  }
}
__name(safeSerializeMultimodal, "safeSerializeMultimodal");
function stripUndefined(value) {
  for (const key of Object.keys(value)) {
    if (value[key] === void 0) delete value[key];
    if (value[key] != null && typeof value[key] === "object" && !Array.isArray(value[key])) {
      stripUndefined(value[key]);
    }
  }
  return value;
}
__name(stripUndefined, "stripUndefined");
function filterEmpty2(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== void 0)
  );
}
__name(filterEmpty2, "filterEmpty");
function convertToBuffer(source) {
  if (source instanceof Buffer) return source;
  if (source instanceof ArrayBuffer) return Buffer.from(source);
  if (ArrayBuffer.isView(source)) {
    return Buffer.from(source.buffer, source.byteOffset, source.byteLength);
  }
  return null;
}
__name(convertToBuffer, "convertToBuffer");
function mapMimeToFileType(mimeType) {
  if (!mimeType) return void 0;
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("text/") || mimeType === "application/pdf" || mimeType === "application/msword" || mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    return "document";
  }
  return "custom";
}
__name(mapMimeToFileType, "mapMimeToFileType");
function buildFallbackFileName(mimeType) {
  return `chatluna_file.${guessExtensionFromMime(mimeType)}`;
}
__name(buildFallbackFileName, "buildFallbackFileName");
function guessMimeTypeFromPath(filePath) {
  const extension = import_path.default.extname(filePath).replace(/^\./, "").toLowerCase();
  const mapping = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    bmp: "image/bmp",
    svg: "image/svg+xml",
    pdf: "application/pdf",
    txt: "text/plain",
    md: "text/markdown",
    csv: "text/csv",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    mp3: "audio/mpeg",
    m4a: "audio/mp4",
    wav: "audio/wav",
    ogg: "audio/ogg",
    webm: "video/webm",
    mp4: "video/mp4",
    mov: "video/quicktime"
  };
  return mapping[extension] ?? "application/octet-stream";
}
__name(guessMimeTypeFromPath, "guessMimeTypeFromPath");
function guessExtensionFromMime(mimeType) {
  if (!mimeType) return "bin";
  if (mimeType === "image/jpeg") return "jpg";
  const [, subtype] = mimeType.split("/");
  return subtype?.replace(/[^a-z0-9]+/gi, "") || "bin";
}
__name(guessExtensionFromMime, "guessExtensionFromMime");
function fileNameFromUrl(source, mimeType) {
  try {
    const parsed = new URL(source);
    const name2 = parsed.pathname.split("/").filter(Boolean).pop();
    return name2 || buildFallbackFileName(mimeType);
  } catch {
    return buildFallbackFileName(mimeType);
  }
}
__name(fileNameFromUrl, "fileNameFromUrl");

// src/adapters/anthropic.ts
var import_messages6 = require("@langchain/core/messages");
var import_outputs7 = require("@langchain/core/outputs");
var import_types8 = require("@langchain/core/utils/types");
var import_v1_shared_adapter8 = require("@chatluna/v1-shared-adapter");
var import_zod_to_json_schema2 = require("zod-to-json-schema");
var import_sse6 = require("koishi-plugin-chatluna/utils/sse");
var import_string3 = require("koishi-plugin-chatluna/utils/string");
var import_error5 = require("koishi-plugin-chatluna/utils/error");
var anthropicAdapter = {
  id: "anthropic",
  async completion(requester, params) {
    if (!requester.currentConfig().nonStreaming) {
      return requester.defaultCompletion(params);
    }
    return await anthropicCompletion(requester, params);
  },
  async *completionStream(requester, params) {
    if (!requester.currentConfig().nonStreaming) {
      yield* requester.defaultCompletionStream(params);
      return;
    }
    const generation = await this.completion(requester, params);
    yield new import_outputs7.ChatGenerationChunk({
      generationInfo: generation.generationInfo,
      message: generation.message,
      text: generation.text
    });
  },
  async *completionStreamInternal(requester, params) {
    yield* anthropicCompletionStream(requester, params);
  },
  async embeddings(_requester, params) {
    throw new import_error5.ChatLunaError(
      import_error5.ChatLunaErrorCode.API_REQUEST_FAILED,
      new Error(
        `Anthropic does not provide embeddings for ${params.model}.`
      )
    );
  },
  async rerank(_requester, params) {
    throw new import_error5.ChatLunaError(
      import_error5.ChatLunaErrorCode.API_REQUEST_FAILED,
      new Error(`Anthropic does not provide rerank for ${params.model}.`)
    );
  },
  async getModels(requester, config) {
    return await getAnthropicModels(requester, config?.signal);
  }
};
async function anthropicCompletion(requester, params) {
  const toolNameMapper = createAnthropicToolNameMapper(params.tools ?? []);
  const request = await createAnthropicRequest(
    requester,
    params,
    toolNameMapper,
    false
  );
  const requestSignal = (0, import_v1_shared_adapter8.createRequestSignal)(params);
  try {
    const response = await requester.post("messages", request, {
      signal: requestSignal.signal
    });
    requestSignal.clearTimeout();
    await (0, import_sse6.checkResponse)(response);
    return parseAnthropicResponse(
      await response.json(),
      toolNameMapper
    );
  } finally {
    requestSignal.dispose();
  }
}
__name(anthropicCompletion, "anthropicCompletion");
async function* anthropicCompletionStream(requester, params) {
  const toolNameMapper = createAnthropicToolNameMapper(params.tools ?? []);
  const request = await createAnthropicRequest(
    requester,
    params,
    toolNameMapper,
    true
  );
  const requestSignal = (0, import_v1_shared_adapter8.createRequestSignal)(params);
  try {
    const response = await requester.post("messages", request, {
      signal: requestSignal.signal
    });
    requestSignal.clearTimeout();
    await (0, import_sse6.checkResponse)(response);
    const reasoningState = createReasoningState();
    const rawBlocks = [];
    const rawArguments = /* @__PURE__ */ new Map();
    let usage2;
    for await (const event of (0, import_sse6.sseIterable)(response, {
      timeout: params.timeout,
      signal: requestSignal.signal
    })) {
      if (!event.data || event.data === "[DONE]" || event.event === "ping") {
        continue;
      }
      if (event.event === "error") {
        throw new import_error5.ChatLunaError(
          import_error5.ChatLunaErrorCode.API_REQUEST_FAILED,
          new Error(event.data)
        );
      }
      const data = JSON.parse(event.data);
      if (data.type === "content_block_start") {
        rawBlocks[data.index] = structuredClone(data.content_block);
      } else if (data.type === "content_block_delta") {
        const block = rawBlocks[data.index];
        const delta = data.delta;
        if (block && delta.type === "text_delta")
          block.text = (block.text ?? "") + delta.text;
        if (block && delta.type === "thinking_delta")
          block.thinking = (block.thinking ?? "") + delta.thinking;
        if (block && delta.type === "signature_delta")
          block.signature = delta.signature;
        if (block && delta.type === "citations_delta")
          (block.citations ??= []).push(delta.citation);
        if (delta.type === "input_json_delta")
          rawArguments.set(
            data.index,
            (rawArguments.get(data.index) ?? "") + delta.partial_json
          );
      } else if (data.type === "content_block_stop" && rawArguments.has(data.index)) {
        rawBlocks[data.index].input = JSON.parse(
          rawArguments.get(data.index)
        );
      }
      const usageDelta = data.type === "message_start" ? data.message.usage : data.type === "message_delta" ? data.usage : void 0;
      if (usageDelta != null) {
        usage2 = mergeAnthropicUsage(usage2, usageDelta);
        yield createAnthropicChunk("", {
          usage: usage2,
          generationInfo: {
            id: data.type === "message_start" ? data.message.id : void 0,
            model: data.type === "message_start" ? data.message.model : void 0,
            stop_reason: data.type === "message_delta" ? data.delta?.stop_reason : void 0,
            stop_sequence: data.type === "message_delta" ? data.delta?.stop_sequence : void 0
          }
        });
        continue;
      }
      const chunk = convertAnthropicStreamEvent(
        data,
        reasoningState,
        toolNameMapper
      );
      if (data.type === "content_block_delta" && data.delta.type === "input_json_delta" && rawBlocks[data.index]?.type !== "tool_use")
        continue;
      if (chunk == null) continue;
      if (reasoningState.endedAt == null && hasAnthropicResponseChunk(chunk)) {
        reasoningState.endedAt = Date.now();
      }
      yield chunk;
    }
    const reasoningChunk = createReasoningChunk(reasoningState);
    if (reasoningChunk) yield reasoningChunk;
    if (rawBlocks.length)
      yield new import_outputs7.ChatGenerationChunk({
        text: "",
        message: new import_messages6.AIMessageChunk({
          content: "",
          additional_kwargs: {
            hub_anthropic_content: rawBlocks.filter(Boolean)
          }
        })
      });
  } finally {
    requestSignal.dispose();
  }
}
__name(anthropicCompletionStream, "anthropicCompletionStream");
async function createAnthropicRequest(requester, params, toolNameMapper, stream) {
  const parsedModel = (0, import_v1_shared_adapter8.parseOpenAIModelNameWithReasoningEffort)(
    params.model ?? ""
  );
  const override = {
    ...params.overrideRequestParams ?? {}
  };
  const overrideEffort = override.reasoning_effort;
  delete override.reasoning_effort;
  const model = String(override.model ?? parsedModel.model);
  const maxTokens = normalizeMaxTokens(params.maxTokens);
  const requestedEffort = overrideEffort ?? parsedModel.reasoningEffort;
  const effort = anthropicEffortForModel(model, requestedEffort);
  const contents = await messagesToAnthropicContents(
    requester,
    params.input,
    toolNameMapper
  );
  const hasAssistantPrefill = contents.messages[contents.messages.length - 1]?.role === "assistant";
  const generatedThinking = hasAssistantPrefill || override.thinking !== void 0 ? void 0 : anthropicThinkingConfig(requestedEffort, model, maxTokens);
  if (generatedThinking?.type === "enabled" && generatedThinking.budget_tokens < 1024) {
    throw new Error(
      "Claude manual thinking requires max_tokens greater than 1024"
    );
  }
  const tools = formatToolsToAnthropicTools(
    params.tools ?? [],
    toolNameMapper
  );
  const outputConfig = effort == null ? void 0 : {
    ...objectOf(override.output_config),
    effort
  };
  const request = stripUndefined2({
    model,
    max_tokens: maxTokens,
    stream,
    system: contents.system,
    messages: contents.messages,
    stop_sequences: typeof params.stop === "string" ? [params.stop] : params.stop,
    temperature: generatedThinking == null ? params.temperature : void 0,
    top_p: generatedThinking == null ? params.topP : void 0,
    tools,
    cache_control: createAnthropicCacheControl(requester),
    thinking: generatedThinking,
    output_config: outputConfig,
    ...override
  });
  if (outputConfig != null) {
    request.output_config = {
      ...outputConfig,
      ...objectOf(override.output_config)
    };
  }
  if (override.thinking !== void 0) {
    request.thinking = override.thinking;
  }
  return request;
}
__name(createAnthropicRequest, "createAnthropicRequest");
async function messagesToAnthropicContents(requester, messages, toolNameMapper) {
  const result = [];
  const system = [];
  for (const message of messages) {
    const type = message.getType();
    if (type === "system") {
      const text = systemTextFromContent(message.content);
      if (text) system.push(text);
      continue;
    }
    if (message instanceof import_messages6.ToolMessage || type === "tool") {
      result.push(
        await toolMessageToAnthropic(message, requester)
      );
      continue;
    }
    if (message instanceof import_messages6.AIMessage || type === "ai") {
      result.push(
        await aiMessageToAnthropic(
          message,
          requester,
          toolNameMapper
        )
      );
      continue;
    }
    result.push({
      role: "user",
      content: await userContentToAnthropic(requester, message.content)
    });
  }
  return {
    system: system.length > 0 ? system.join("\n\n") : void 0,
    messages: result.length > 0 ? result : [{ role: "user", content: "" }]
  };
}
__name(messagesToAnthropicContents, "messagesToAnthropicContents");
async function aiMessageToAnthropic(message, requester, toolNameMapper) {
  const raw = message.additional_kwargs.hub_anthropic_content;
  if (Array.isArray(raw)) {
    return {
      role: "assistant",
      content: structuredClone(raw)
    };
  }
  const blocks = [];
  const reasoningBlocks = message.additional_kwargs.reasoning_blocks;
  if (Array.isArray(reasoningBlocks) && reasoningBlocks.length > 0) {
    blocks.push(...reasoningBlocks.filter(isReasoningBlock));
  } else {
    const reasoningContent = message.additional_kwargs.reasoning_content;
    const reasoningSignature = message.additional_kwargs.reasoning_signature;
    if (reasoningContent && reasoningSignature) {
      blocks.push({
        type: "thinking",
        thinking: reasoningContent,
        signature: reasoningSignature
      });
    }
  }
  const content = await contentToAnthropicBlocks(requester, message.content);
  blocks.push(...content);
  for (const toolCall of message.tool_calls ?? []) {
    blocks.push({
      type: "tool_use",
      id: toolCall.id ?? createToolUseId(toolCall.name),
      name: toolNameMapper.sanitize(toolCall.name),
      input: objectOf(toolCall.args)
    });
  }
  return {
    role: "assistant",
    content: blocks.length === 0 ? "" : blocks.length === 1 && blocks[0].type === "text" ? blocks[0].text : blocks
  };
}
__name(aiMessageToAnthropic, "aiMessageToAnthropic");
async function toolMessageToAnthropic(message, requester) {
  const content = typeof message.content === "string" ? message.content : await contentToAnthropicBlocks(requester, message.content);
  const normalizedContent = Array.isArray(content) && content.length < 1 ? "" : content;
  return {
    role: "user",
    content: [
      stripUndefined2({
        type: "tool_result",
        tool_use_id: message.tool_call_id,
        content: normalizedContent,
        is_error: message.status === "error" ? true : void 0
      })
    ]
  };
}
__name(toolMessageToAnthropic, "toolMessageToAnthropic");
async function userContentToAnthropic(requester, content) {
  if (typeof content === "string") return content;
  const blocks = await contentToAnthropicBlocks(requester, content);
  return blocks.length > 0 ? blocks : "";
}
__name(userContentToAnthropic, "userContentToAnthropic");
async function contentToAnthropicBlocks(requester, content) {
  if (typeof content === "string")
    return content ? [{ type: "text", text: content }] : [];
  const blocks = [];
  for (const part of content) {
    const block = await contentPartToAnthropicBlock(requester, part);
    if (block != null) blocks.push(block);
  }
  return blocks;
}
__name(contentToAnthropicBlocks, "contentToAnthropicBlocks");
async function contentPartToAnthropicBlock(requester, part) {
  if ((0, import_string3.isMessageContentText)(part)) {
    return { type: "text", text: part.text };
  }
  if ((0, import_string3.isMessageContentImageUrl)(part)) {
    return await imageContentToAnthropic(requester, part);
  }
  if (isFileLikePart3(part)) {
    return await fileContentToAnthropic(requester, part);
  }
  if (isAnthropicInputBlock(part)) return part;
  if (isInlineDataPart(part)) return inlineDataToAnthropic(requester, part);
  return {
    type: "text",
    text: stringifyUnknownContent(part)
  };
}
__name(contentPartToAnthropicBlock, "contentPartToAnthropicBlock");
async function imageContentToAnthropic(requester, part) {
  try {
    const url = await (0, import_v1_shared_adapter8.fetchImageUrl)(
      requester.requestContext().plugin,
      part
    );
    if (/^https?:\/\//i.test(url)) {
      return {
        type: "image",
        source: {
          type: "url",
          url
        }
      };
    }
    const match = url.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return null;
    return {
      type: "image",
      source: {
        type: "base64",
        media_type: normalizeAnthropicImageMime(match[1]),
        data: match[2]
      }
    };
  } catch (error) {
    requester.logger.warn(error);
    return null;
  }
}
__name(imageContentToAnthropic, "imageContentToAnthropic");
async function fileContentToAnthropic(requester, part) {
  try {
    const { buffer, mimeType } = await (0, import_v1_shared_adapter8.fetchFileLikeUrl)(
      requester.requestContext().plugin,
      part
    );
    if (mimeType.startsWith("image/")) {
      return {
        type: "image",
        source: {
          type: "base64",
          media_type: normalizeAnthropicImageMime(mimeType),
          data: buffer.toString("base64")
        }
      };
    }
    if (mimeType === "application/pdf") {
      return {
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: buffer.toString("base64")
        }
      };
    }
    if (mimeType.startsWith("text/") || mimeType === "application/json") {
      return {
        type: "document",
        source: {
          type: "text",
          media_type: "text/plain",
          data: buffer.toString("utf8")
        }
      };
    }
    requester.logger.warn(
      `Unsupported Anthropic file mime type: ${mimeType}`
    );
    return null;
  } catch (error) {
    requester.logger.warn(error);
    return null;
  }
}
__name(fileContentToAnthropic, "fileContentToAnthropic");
function inlineDataToAnthropic(requester, part) {
  const inline = part.inline_data ?? part.inlineData;
  const mimeType = inline?.mime_type ?? inline?.mimeType;
  const data = inline?.data;
  if (typeof mimeType !== "string" || typeof data !== "string") return null;
  if (mimeType.startsWith("image/")) {
    return {
      type: "image",
      source: {
        type: "base64",
        media_type: normalizeAnthropicImageMime(mimeType),
        data
      }
    };
  }
  if (mimeType === "application/pdf") {
    return {
      type: "document",
      source: {
        type: "base64",
        media_type: "application/pdf",
        data
      }
    };
  }
  if (mimeType.startsWith("text/") || mimeType === "application/json") {
    return {
      type: "document",
      source: {
        type: "text",
        media_type: "text/plain",
        data: Buffer.from(data, "base64").toString("utf8")
      }
    };
  }
  requester.logger.warn(`Unsupported Anthropic inline mime type: ${mimeType}`);
  return null;
}
__name(inlineDataToAnthropic, "inlineDataToAnthropic");
function formatToolsToAnthropicTools(tools, toolNameMapper) {
  if (tools.length < 1) return void 0;
  return tools.map((tool2) => {
    const strict = (tool2.metadata?.strict ?? tool2.strict) === true;
    const schema = (0, import_types8.isZodSchemaV3)(tool2.schema) ? (0, import_zod_to_json_schema2.zodToJsonSchema)(tool2.schema) : tool2.schema;
    return {
      name: toolNameMapper.sanitize(tool2.name),
      description: tool2.description,
      input_schema: normalizeToolInputSchema(
        strict ? schema : (0, import_v1_shared_adapter8.removeAdditionalProperties)(schema)
      ),
      ...strict ? { strict: true } : {}
    };
  });
}
__name(formatToolsToAnthropicTools, "formatToolsToAnthropicTools");
function parseAnthropicResponse(data, toolNameMapper) {
  let content = "";
  const toolCalls = [];
  const reasoningState = createReasoningState();
  for (const block of data.content ?? []) {
    if (block.type === "text") {
      content += block.text;
    } else if (block.type === "tool_use") {
      toolCalls.push({
        name: toolNameMapper.restore(block.name),
        args: JSON.stringify(block.input ?? {}),
        id: block.id,
        index: toolCalls.length
      });
    } else if (block.type === "thinking") {
      pushThinkingBlock(
        reasoningState,
        reasoningState.blocks.length,
        block
      );
    } else if (block.type === "redacted_thinking") {
      reasoningState.blocks.push(block);
    }
  }
  const usage2 = data.usage ? anthropicUsageToMetadata(data.usage) : void 0;
  const additional = {
    ...reasoningAdditionalKwargs(reasoningState),
    hub_anthropic_content: structuredClone(data.content ?? [])
  };
  const message = new import_messages6.AIMessageChunk({
    content,
    tool_call_chunks: toolCalls,
    usage_metadata: usage2,
    additional_kwargs: additional
  });
  return new import_outputs7.ChatGenerationChunk({
    generationInfo: stripUndefined2({
      id: data.id,
      model: data.model,
      stop_reason: data.stop_reason,
      stop_sequence: data.stop_sequence,
      stop_details: data.stop_details,
      usage_metadata: usage2
    }),
    message,
    text: (0, import_string3.getMessageContent)(message.content) ?? content
  });
}
__name(parseAnthropicResponse, "parseAnthropicResponse");
function convertAnthropicStreamEvent(event, reasoningState, toolNameMapper) {
  if (event.type === "content_block_start") {
    const block = event.content_block;
    if (block.type === "text") {
      return block.text ? createAnthropicChunk(block.text) : void 0;
    }
    if (block.type === "tool_use") {
      return createAnthropicToolChunk({
        id: block.id,
        index: event.index,
        name: toolNameMapper.restore(block.name),
        args: objectHasKeys(block.input) ? JSON.stringify(block.input) : ""
      });
    }
    if (block.type === "thinking") {
      pushThinkingBlock(reasoningState, event.index, block);
      return void 0;
    }
    if (block.type === "redacted_thinking") {
      reasoningState.blocks[event.index] = block;
    }
    return void 0;
  }
  if (event.type !== "content_block_delta") return void 0;
  const delta = event.delta;
  if (delta.type === "text_delta") {
    return createAnthropicChunk(delta.text);
  }
  if (delta.type === "input_json_delta") {
    return createAnthropicToolChunk({
      index: event.index,
      args: delta.partial_json
    });
  }
  if (delta.type === "thinking_delta") {
    reasoningState.content += delta.thinking;
    const block = reasoningState.blocks[event.index];
    if (block?.type === "thinking") block.thinking += delta.thinking;
    return void 0;
  }
  if (delta.type === "signature_delta") {
    const block = reasoningState.blocks[event.index];
    if (block?.type === "thinking") block.signature = delta.signature;
    return void 0;
  }
}
__name(convertAnthropicStreamEvent, "convertAnthropicStreamEvent");
async function getAnthropicModels(requester, signal) {
  const result = [];
  let afterId;
  while (true) {
    const query = new URLSearchParams({ limit: "100" });
    if (afterId) query.set("after_id", afterId);
    const response = await requester.get(
      `models?${query.toString()}`,
      {},
      { signal }
    );
    await (0, import_sse6.checkResponse)(response);
    const payload = JSON.parse(await response.text());
    result.push(...parseAnthropicModels(payload));
    if (!payload.has_more || !payload.last_id) break;
    afterId = payload.last_id;
  }
  return dedupeProviderModels(result);
}
__name(getAnthropicModels, "getAnthropicModels");
function createAnthropicChunk(text, options = {}) {
  const usage2 = options.usage ? anthropicUsageToMetadata(options.usage) : void 0;
  return new import_outputs7.ChatGenerationChunk({
    generationInfo: stripUndefined2({
      ...options.generationInfo,
      usage_metadata: usage2
    }),
    message: new import_messages6.AIMessageChunk({
      content: text,
      usage_metadata: usage2
    }),
    text
  });
}
__name(createAnthropicChunk, "createAnthropicChunk");
function createAnthropicToolChunk(toolCall) {
  return new import_outputs7.ChatGenerationChunk({
    message: new import_messages6.AIMessageChunk({
      content: "",
      tool_call_chunks: [toolCall]
    }),
    text: ""
  });
}
__name(createAnthropicToolChunk, "createAnthropicToolChunk");
function createReasoningChunk(reasoningState) {
  const additional = reasoningAdditionalKwargs(reasoningState);
  if (Object.keys(additional).length < 1) return void 0;
  return new import_outputs7.ChatGenerationChunk({
    message: new import_messages6.AIMessageChunk({
      content: "",
      additional_kwargs: additional
    }),
    text: ""
  });
}
__name(createReasoningChunk, "createReasoningChunk");
function reasoningAdditionalKwargs(reasoningState) {
  const blocks = reasoningState.blocks.filter(isReasoningBlock);
  const reasoningSignature = blocks.length === 1 && blocks[0].type === "thinking" ? blocks[0].signature : void 0;
  const reasoningTime = reasoningState.content || blocks.length > 0 ? (reasoningState.endedAt ?? Date.now()) - reasoningState.startedAt : void 0;
  return stripUndefined2({
    reasoning_content: reasoningState.content || void 0,
    reasoning_signature: reasoningSignature,
    reasoning_blocks: blocks.length > 0 ? blocks : void 0,
    reasoning_time: reasoningTime
  });
}
__name(reasoningAdditionalKwargs, "reasoningAdditionalKwargs");
function createReasoningState() {
  return {
    content: "",
    startedAt: Date.now(),
    endedAt: void 0,
    blocks: []
  };
}
__name(createReasoningState, "createReasoningState");
function pushThinkingBlock(reasoningState, index, block) {
  reasoningState.content += block.thinking ?? "";
  reasoningState.blocks[index] = {
    type: "thinking",
    thinking: block.thinking ?? "",
    signature: block.signature ?? ""
  };
}
__name(pushThinkingBlock, "pushThinkingBlock");
function anthropicUsageToMetadata(usage2) {
  const cacheReadTokens = usage2.cache_read_input_tokens ?? 0;
  const cacheCreationTokens = usage2.cache_creation_input_tokens ?? 0;
  const inputTokens = (usage2.input_tokens ?? 0) + cacheReadTokens + cacheCreationTokens;
  const outputTokens = usage2.output_tokens ?? 0;
  const metadata = (0, import_v1_shared_adapter8.createUsageMetadata)({
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    cacheReadTokens: usage2.cache_read_input_tokens,
    cacheCreationTokens: usage2.cache_creation_input_tokens,
    reasoningTokens: usage2.output_tokens_details?.thinking_tokens
  });
  const cacheCreation = usage2.cache_creation;
  if (cacheCreation != null) {
    metadata.input_token_details = {
      ...metadata.input_token_details,
      ...cacheCreation.ephemeral_5m_input_tokens != null ? {
        cache_creation_5m: cacheCreation.ephemeral_5m_input_tokens
      } : {},
      ...cacheCreation.ephemeral_1h_input_tokens != null ? {
        cache_creation_1h: cacheCreation.ephemeral_1h_input_tokens
      } : {}
    };
  }
  return metadata;
}
__name(anthropicUsageToMetadata, "anthropicUsageToMetadata");
function mergeAnthropicUsage(previous, next) {
  return {
    ...previous,
    ...next,
    input_tokens: next.input_tokens ?? previous?.input_tokens,
    output_tokens: next.output_tokens ?? previous?.output_tokens,
    cache_creation_input_tokens: next.cache_creation_input_tokens ?? previous?.cache_creation_input_tokens,
    cache_read_input_tokens: next.cache_read_input_tokens ?? previous?.cache_read_input_tokens,
    cache_creation: mergeAnthropicCacheCreation(
      previous?.cache_creation,
      next.cache_creation
    ),
    iterations: next.iterations ?? previous?.iterations,
    output_tokens_details: {
      ...previous?.output_tokens_details,
      ...next.output_tokens_details
    }
  };
}
__name(mergeAnthropicUsage, "mergeAnthropicUsage");
function mergeAnthropicCacheCreation(previous, next) {
  if (previous == null) return next;
  if (next == null) return previous;
  return {
    ...previous,
    ...next,
    ephemeral_5m_input_tokens: next.ephemeral_5m_input_tokens ?? previous.ephemeral_5m_input_tokens,
    ephemeral_1h_input_tokens: next.ephemeral_1h_input_tokens ?? previous.ephemeral_1h_input_tokens
  };
}
__name(mergeAnthropicCacheCreation, "mergeAnthropicCacheCreation");
function createAnthropicCacheControl(requester) {
  const config = requester.currentConfig();
  if (config.anthropicPromptCache !== true) return void 0;
  return {
    type: "ephemeral",
    ...config.anthropicPromptCacheTtl === "1h" ? { ttl: "1h" } : {}
  };
}
__name(createAnthropicCacheControl, "createAnthropicCacheControl");
function normalizeMaxTokens(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 1) return 4096;
  return Math.floor(number);
}
__name(normalizeMaxTokens, "normalizeMaxTokens");
function normalizeAnthropicImageMime(mimeType) {
  if (mimeType === "image/jpeg" || mimeType === "image/png" || mimeType === "image/gif" || mimeType === "image/webp") {
    return mimeType;
  }
  return "image/jpeg";
}
__name(normalizeAnthropicImageMime, "normalizeAnthropicImageMime");
function createAnthropicToolNameMapper(tools) {
  const sanitizeMap = /* @__PURE__ */ new Map();
  const restoreMap = /* @__PURE__ */ new Map();
  const used = /* @__PURE__ */ new Set();
  for (const tool2 of tools) {
    const sanitized = sanitizeAnthropicToolName(tool2.name, used);
    sanitizeMap.set(tool2.name, sanitized);
    restoreMap.set(sanitized, tool2.name);
  }
  return {
    sanitize(name2) {
      const original = name2 || "tool";
      const known = sanitizeMap.get(original);
      if (known) return known;
      const sanitized = sanitizeAnthropicToolName(original, used);
      sanitizeMap.set(original, sanitized);
      restoreMap.set(sanitized, original);
      return sanitized;
    },
    restore(name2) {
      const value = name2 || "";
      return restoreMap.get(value) ?? value;
    }
  };
}
__name(createAnthropicToolNameMapper, "createAnthropicToolNameMapper");
function sanitizeAnthropicToolName(name2, used) {
  const fallback = "tool";
  const normalized = (name2 || fallback).normalize("NFKC").replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^[^a-zA-Z_]+/, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "").slice(0, 64);
  let result = normalized || fallback;
  if (!/^[A-Za-z_]/.test(result)) result = `_${result}`;
  result = result.slice(0, 64);
  let unique2 = result;
  let index = 2;
  while (used.has(unique2)) {
    const suffix = `_${index++}`;
    unique2 = `${result.slice(0, Math.max(1, 64 - suffix.length))}${suffix}`;
  }
  used.add(unique2);
  return unique2;
}
__name(sanitizeAnthropicToolName, "sanitizeAnthropicToolName");
function normalizeToolInputSchema(schema) {
  if (schema.type === "object") return schema;
  return {
    type: "object",
    properties: {},
    ...schema
  };
}
__name(normalizeToolInputSchema, "normalizeToolInputSchema");
function systemTextFromContent(content) {
  if (typeof content === "string") return content.trim();
  return content.map((part) => {
    if ((0, import_string3.isMessageContentText)(part)) return part.text;
    const text = part.text;
    return typeof text === "string" ? text : "";
  }).filter(Boolean).join("\n").trim();
}
__name(systemTextFromContent, "systemTextFromContent");
function stringifyUnknownContent(value) {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
__name(stringifyUnknownContent, "stringifyUnknownContent");
function objectOf(value) {
  return value != null && typeof value === "object" && !Array.isArray(value) ? value : {};
}
__name(objectOf, "objectOf");
function objectHasKeys(value) {
  return value != null && typeof value === "object" && Object.keys(value).length > 0;
}
__name(objectHasKeys, "objectHasKeys");
function stripUndefined2(value) {
  for (const key of Object.keys(value)) {
    if (value[key] === void 0) delete value[key];
    if (value[key] != null && typeof value[key] === "object" && !Array.isArray(value[key])) {
      stripUndefined2(value[key]);
    }
  }
  return value;
}
__name(stripUndefined2, "stripUndefined");
function isFileLikePart3(part) {
  return part != null && typeof part === "object" && ["file_url", "audio_url", "video_url"].includes(String(part.type));
}
__name(isFileLikePart3, "isFileLikePart");
function isInlineDataPart(part) {
  return part != null && typeof part === "object" && (part.inline_data != null || part.inlineData != null);
}
__name(isInlineDataPart, "isInlineDataPart");
function isAnthropicInputBlock(value) {
  if (value == null || typeof value !== "object") return false;
  return value.type === "text" || value.type === "image" || value.type === "document";
}
__name(isAnthropicInputBlock, "isAnthropicInputBlock");
function isReasoningBlock(value) {
  return value?.type === "thinking" || value?.type === "redacted_thinking";
}
__name(isReasoningBlock, "isReasoningBlock");
function hasAnthropicResponseChunk(chunk) {
  const message = chunk.message;
  return chunk.text.length > 0 || typeof message.content === "string" && message.content.length > 0 || Array.isArray(message.content) && message.content.length > 0 || (message.tool_call_chunks?.length ?? 0) > 0;
}
__name(hasAnthropicResponseChunk, "hasAnthropicResponseChunk");
function createToolUseId(name2) {
  return `toolu_${(name2 || "tool").replace(/[^a-zA-Z0-9_-]+/g, "_")}`;
}
__name(createToolUseId, "createToolUseId");
function dedupeProviderModels(models) {
  const result = /* @__PURE__ */ new Map();
  for (const model of models) {
    if (!model.name) continue;
    result.set(model.name, model);
  }
  return [...result.values()];
}
__name(dedupeProviderModels, "dedupeProviderModels");

// src/adapters/registry.ts
var adapters = /* @__PURE__ */ new Map([
  [openAIChatAdapter.id, openAIChatAdapter],
  [openAIAdapter.id, openAIAdapter],
  [geminiAdapter.id, geminiAdapter],
  [difyAdapter.id, difyAdapter],
  [anthropicAdapter.id, anthropicAdapter]
]);
function getProviderAdapter(id) {
  return adapters.get(id) ?? openAIChatAdapter;
}
__name(getProviderAdapter, "getProviderAdapter");

// src/adapters/gemini-resources.ts
var import_crypto = require("crypto");
var import_sse7 = require("koishi-plugin-chatluna/utils/sse");
var GeminiResources = class {
  constructor(requester) {
    this.requester = requester;
    requester.koishiContext().on?.("dispose", () => this.dispose());
  }
  static {
    __name(this, "GeminiResources");
  }
  uploads = /* @__PURE__ */ new Map();
  lifetime = new AbortController();
  async request(request, signal) {
    if (this.lifetime.signal.aborted) throw this.lifetime.signal.reason;
    signal ??= AbortSignal.timeout(
      this.requester.currentConfig().timeout ?? 6e4
    );
    if (this.requester.currentProviderPreset().adapter !== "gemini")
      throw new Error("Gemini resources require a Gemini provider");
    const { resource, action, name: name2, body } = request;
    if (!["files", "cachedContents", "interactions"].includes(resource))
      throw new Error("Unknown Gemini resource");
    const methods = {
      list: "GET",
      get: "GET",
      create: "POST",
      update: "PATCH",
      delete: "DELETE",
      cancel: "POST"
    };
    const allowed = resource === "cachedContents" ? ["list", "get", "create", "update", "delete"] : resource === "files" ? ["list", "get", "delete"] : ["get", "create", "delete", "cancel"];
    if (!allowed.includes(action))
      throw new Error(`Unsupported ${resource} action: ${action}`);
    if (!["list", "create"].includes(action) && !new RegExp(`^${resource}/[A-Za-z0-9_-]+$`).test(name2 ?? "")) {
      throw new Error("Invalid Gemini resource name");
    }
    let path2 = ["list", "create"].includes(action) ? resource : name2;
    if (action === "cancel") path2 += ":cancel";
    if (request.pageToken)
      path2 += `?pageToken=${encodeURIComponent(request.pageToken)}`;
    const response = await this.fetch(this.requester.concatUrl(path2), {
      method: methods[action],
      signal,
      headers: this.requester.buildHeaders(),
      ...body ? { body: JSON.stringify(body) } : {}
    });
    await (0, import_sse7.checkResponse)(response);
    if (resource === "files" && action === "delete") {
      for (const [key, value] of this.uploads)
        if (value.file.name === name2) this.uploads.delete(key);
    }
    const text = await response.text();
    return text ? JSON.parse(text) : {};
  }
  async upload(buffer, mimeType, signal) {
    if (this.lifetime.signal.aborted) throw this.lifetime.signal.reason;
    if (signal?.aborted) throw signal.reason;
    signal ??= AbortSignal.timeout(
      this.requester.currentConfig().timeout ?? 6e4
    );
    const config = this.requester.currentConfig();
    if (!config.geminiFileUpload)
      throw new Error("Gemini file upload is disabled");
    const limit = Math.min(config.geminiMaxFileSizeMb ?? 64, 2048) * 1024 * 1024;
    if (buffer.length > limit)
      throw new Error(
        `Gemini file exceeds configured upload limit (${limit} bytes)`
      );
    const key = (0, import_crypto.createHash)("sha256").update(config.apiEndpoint).update(config.apiKey).update(mimeType).update(buffer).digest("hex");
    const saved = this.uploads.get(key);
    if (saved && saved.expires > Date.now() + 6e4) return saved.file;
    const url = new URL(this.requester.concatUrl("files"));
    url.pathname = url.pathname.replace(
      /\/(v1(?:beta)?)\/files$/,
      "/upload/$1/files"
    );
    const start = await this.fetch(url.toString(), {
      method: "POST",
      signal,
      redirect: "error",
      headers: {
        ...this.requester.buildHeaders(),
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": String(buffer.length),
        "X-Goog-Upload-Header-Content-Type": mimeType
      },
      body: JSON.stringify({
        file: { display_name: `chatluna-${key.slice(0, 12)}` }
      })
    });
    await (0, import_sse7.checkResponse)(start);
    const location = start.headers.get("x-goog-upload-url");
    if (!location) throw new Error("Gemini did not return an upload URL");
    const uploadUrl = new URL(location, url);
    if (uploadUrl.origin !== url.origin)
      throw new Error("Gemini upload URL changed origin");
    const response = await this.fetch(uploadUrl.toString(), {
      method: "POST",
      signal,
      redirect: "error",
      headers: {
        ...this.requester.buildHeaders(),
        "Content-Type": mimeType,
        "X-Goog-Upload-Offset": "0",
        "X-Goog-Upload-Command": "upload, finalize"
      },
      body: buffer
    });
    await (0, import_sse7.checkResponse)(response);
    let file2 = JSON.parse(await response.text()).file;
    for (let attempt = 0; file2?.state === "PROCESSING" && attempt < 60; attempt++) {
      await abortableDelay(1e3, signal);
      file2 = await this.request(
        { resource: "files", action: "get", name: file2.name },
        signal
      );
    }
    if (!file2?.uri || file2.state === "FAILED" || file2.state === "PROCESSING")
      throw new Error("Gemini file is not ready");
    const expires = Date.parse(file2.expirationTime ?? "") || Date.now() + 48 * 36e5;
    if (this.uploads.size >= 64)
      this.uploads.delete(this.uploads.keys().next().value);
    this.uploads.set(key, { file: file2, expires });
    return file2;
  }
  async fetch(url, init) {
    const controller = new AbortController();
    const cancelCaller = /* @__PURE__ */ __name(() => controller.abort(init.signal?.reason), "cancelCaller");
    const cancelLifetime = /* @__PURE__ */ __name(() => controller.abort(this.lifetime.signal.reason), "cancelLifetime");
    if (init.signal?.aborted) cancelCaller();
    if (this.lifetime.signal.aborted) cancelLifetime();
    init.signal?.addEventListener("abort", cancelCaller, { once: true });
    this.lifetime.signal.addEventListener("abort", cancelLifetime, {
      once: true
    });
    try {
      const response = await this.requester.vendorFetch(url, {
        ...init,
        signal: controller.signal
      });
      const buffer = await response.arrayBuffer();
      return new Response(
        [204, 205, 304].includes(response.status) ? null : buffer,
        { status: response.status, headers: response.headers }
      );
    } finally {
      init.signal?.removeEventListener("abort", cancelCaller);
      this.lifetime.signal.removeEventListener("abort", cancelLifetime);
    }
  }
  dispose() {
    this.lifetime.abort(new Error("Gemini resource client disposed"));
    this.uploads.clear();
  }
};
function abortableDelay(ms, signal) {
  return new Promise((resolve4, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const abort = /* @__PURE__ */ __name(() => {
      clearTimeout(timer);
      reject(signal?.reason);
    }, "abort");
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve4();
    }, ms);
    signal?.addEventListener("abort", abort, { once: true });
  });
}
__name(abortableDelay, "abortableDelay");

// src/requester.ts
var ModelHubRequester = class extends import_api2.ModelRequester {
  static {
    __name(this, "ModelHubRequester");
  }
  _modelCapabilities = /* @__PURE__ */ new Map();
  _geminiResources = new GeminiResources(this);
  geminiResources() {
    return this._geminiResources;
  }
  vendorFetch(url, init) {
    return this._plugin.fetch(url, init);
  }
  setModelCapabilities(models) {
    this._modelCapabilities = new Map(
      models.map((model) => [model.name, model.capabilities])
    );
  }
  supportsCapability(model, capability) {
    return this._modelCapabilities.get(model)?.includes(capability);
  }
  constructor(ctx, configPool, pluginConfig, plugin) {
    super(ctx, configPool, pluginConfig, plugin);
  }
  async completion(params) {
    const start = Date.now();
    const generation = await this._adapter().completion(
      this,
      await this._prepareParams(params)
    );
    attachGenerationMetrics(generation, start);
    return generation;
  }
  async *completionStream(params) {
    const preparedParams = await this._prepareParams(params);
    if (!this.currentConfig().nonStreaming) {
      yield* super.completionStream(preparedParams);
      return;
    }
    const tracker = new ModelHubStreamMetricsTracker();
    for await (const chunk of this._adapter().completionStream(
      this,
      preparedParams
    )) {
      tracker.observe(chunk);
      yield chunk;
    }
    yield tracker.attachTo(
      new import_outputs8.ChatGenerationChunk({
        message: new import_messages7.AIMessageChunk({ content: "" }),
        text: ""
      })
    );
  }
  async *completionStreamInternal(params) {
    yield* this._adapter().completionStreamInternal(
      this,
      await this._prepareParams(params)
    );
  }
  async embeddings(params) {
    return await this._adapter().embeddings(this, params);
  }
  async rerank(params) {
    return await this._adapter().rerank(this, params);
  }
  async dispose(model, id) {
    if (model == null && id == null) this._geminiResources.dispose();
    await this._adapter().dispose?.(this, model, id);
  }
  async getModels(config) {
    return await this._adapter().getModels(this, config);
  }
  buildHeaders() {
    const current = this._config.value;
    const preset = getProviderPreset(current.provider);
    const result = preset.adapter === "anthropic" ? {
      "Content-Type": "application/json",
      "x-api-key": current.apiKey,
      "anthropic-version": "2023-06-01"
    } : {
      "Content-Type": "application/json",
      "HTTP-Referer": "https://github.com/ChatLunaLab/chatluna",
      "X-Title": "ChatLuna"
    };
    if (preset.adapter !== "gemini" && preset.adapter !== "anthropic" && current.apiKey.length > 0) {
      result.Authorization = `Bearer ${current.apiKey}`;
    }
    for (const header of current.customHeaders ?? []) {
      const name2 = header.name?.trim();
      if (!name2) continue;
      if (!targetMatches(
        header.target,
        current.platform,
        current.provider
      ))
        continue;
      result[name2] = header.value;
    }
    return result;
  }
  async post(url, body, options) {
    const current = this._config.value;
    const preset = getProviderPreset(current.provider);
    if (url === "chat/completions" || url === "responses") {
      if (current.promptCacheMode && current.promptCacheMode !== "default") {
        body.prompt_cache_options ??= {
          mode: current.promptCacheMode,
          ttl: current.promptCacheTtl ?? (current.provider === "moonshot" ? "5m" : "30m")
        };
      }
      if (current.promptCacheKey)
        body.prompt_cache_key ??= current.promptCacheKey;
      if (current.promptCacheRetention && current.provider === "openai")
        body.prompt_cache_retention ??= current.promptCacheRetention;
    }
    if (url === "chat/completions") {
      validateNativeReasoningEffort(body, String(body.model ?? ""));
      if (body.stream !== true) {
        delete body.stream_options;
      }
      const parsedModel = (0, import_v1_shared_adapter9.parseOpenAIModelNameWithReasoningEffort)(
        String(body.model ?? "")
      );
      applyReasoningEffortStrategy(
        preset.reasoningEffort,
        body,
        parsedModel.model,
        current.reasoningProtocol
      );
      preset.patchCompletionBody?.(body, String(body.model ?? ""));
    }
    if (url === "embeddings") {
      preset.patchEmbeddingsBody?.(body, String(body.model ?? ""));
    }
    if (url === "responses" && Array.isArray(body.input)) {
      validateNativeReasoningEffort(
        { reasoning_effort: body.reasoning?.effort },
        String(body.model ?? "")
      );
      for (const item of body.input) {
        if (!Array.isArray(item.content)) continue;
        for (const part of item.content) {
          if (part.type === "input_file" && typeof part.file_url === "string" && part.file_url.startsWith("data:")) {
            part.file_data = part.file_url;
            part.filename ??= "attachment.pdf";
            delete part.file_url;
          }
        }
      }
    }
    if (url === "rerank") {
      preset.patchRerankBody?.(body, String(body.model ?? ""));
    }
    return super.post(url, body, options);
  }
  get logger() {
    return logger;
  }
  get pluginConfig() {
    return this._pluginConfig;
  }
  requestContext() {
    return (0, import_v1_shared_adapter10.createRequestContext)(
      this.ctx,
      this._config.value,
      this._pluginConfig,
      this._plugin,
      this
    );
  }
  currentProviderPreset() {
    return getProviderPreset(this._config.value.provider);
  }
  currentConfig() {
    return this._config.value;
  }
  koishiContext() {
    return this.ctx;
  }
  responseBuiltinTools(params) {
    const current = this._config.value;
    if (!usesResponses(this, params)) return [];
    if (!matchesResponseBuiltinToolModel(
      params.model,
      current.responseBuiltinToolSupportModel
    )) {
      return [];
    }
    const result = [];
    for (const type of current.responseBuiltinTools ?? []) {
      if (type === "file_search") {
        if ((current.responseFileSearchVectorStoreIds ?? []).length > 0) {
          result.push({
            type,
            vector_store_ids: current.responseFileSearchVectorStoreIds
          });
        }
        continue;
      }
      if (type === "code_interpreter") {
        result.push(
          current.provider === "xai" ? { type } : { type, container: { type: "auto" } }
        );
        continue;
      }
      result.push({ type });
    }
    return result;
  }
  responseImageProvider() {
    return async (item) => {
      const format = item.output_format === "png" || item.output_format === "jpeg" || item.output_format === "webp" ? item.output_format : "png";
      const ext = format === "jpeg" ? "jpg" : format;
      const mime = format === "jpeg" ? "image/jpeg" : `image/${format}`;
      const data = item.result;
      return `data:${mime};base64,${data}`;
    };
  }
  async defaultCompletion(params) {
    return super.completion(await this._prepareParams(params));
  }
  async *defaultCompletionStream(params) {
    yield* super.completionStream(await this._prepareParams(params));
  }
  _adapter() {
    return getProviderAdapter(this.currentProviderPreset().adapter);
  }
  concatUrl(url) {
    const base = super.concatUrl(url);
    if (this.currentProviderPreset().adapter !== "gemini") return base;
    const next = new URL(base);
    const apiKey = this._config.value.apiKey?.trim();
    if (apiKey) next.searchParams.set("key", apiKey);
    return next.toString();
  }
  async _prepareParams(params) {
    if (!params.model) return params;
    params = await prepareCapabilityParams(
      params,
      this._modelCapabilities.get(params.model),
      this.currentProviderPreset().adapter,
      this._plugin,
      usesResponses(this, params)
    );
    const { model, reasoningEffort } = (0, import_v1_shared_adapter9.parseOpenAIModelNameWithReasoningEffort)(params.model);
    if (model === params.model && reasoningEffort == null) return params;
    return {
      ...params,
      overrideRequestParams: {
        ...params.overrideRequestParams,
        model,
        ...reasoningEffort == null ? {} : { reasoning_effort: reasoningEffort },
        ...params.overrideRequestParams
      }
    };
  }
};
function applyReasoningEffortStrategy(strategy, body, model, configuredProtocol) {
  const effort = body.reasoning_effort;
  if (effort == null) return;
  if (strategy === "passthrough") {
    applyReasoningProtocol(
      resolveReasoningProtocol(configuredProtocol, model),
      body,
      model
    );
    return;
  }
  if (strategy === "deepseek") {
    applyReasoningProtocol("deepseek", body, model);
    return;
  }
  if (strategy === "qwen") {
    applyReasoningProtocol("qwen", body, model);
    return;
  }
  delete body.reasoning_effort;
}
__name(applyReasoningEffortStrategy, "applyReasoningEffortStrategy");
function matchesResponseBuiltinToolModel(model, supported) {
  if (!model || (supported?.length ?? 0) < 1) return false;
  const normalized = normalizeResponseToolModel(model);
  return (supported ?? []).some((item) => {
    const target = normalizeResponseToolModel(item);
    if (!target) return false;
    return normalized === target || isResponseModelPrefix(normalized, target) || isResponseModelPrefix(target, normalized);
  });
}
__name(matchesResponseBuiltinToolModel, "matchesResponseBuiltinToolModel");
function normalizeResponseToolModel(model) {
  return (0, import_v1_shared_adapter9.parseOpenAIModelNameWithReasoningEffort)(model).model.trim().toLowerCase();
}
__name(normalizeResponseToolModel, "normalizeResponseToolModel");
function isResponseModelPrefix(model, prefix) {
  if (!model.startsWith(prefix)) return false;
  const next = model[prefix.length];
  return next === "-" || next === "." || next === ":";
}
__name(isResponseModelPrefix, "isResponseModelPrefix");
var ModelHubStreamMetricsTracker = class {
  static {
    __name(this, "ModelHubStreamMetricsTracker");
  }
  start = Date.now();
  firstAt;
  usage;
  observe(chunk) {
    const usage2 = readChunkUsage(chunk);
    if (usage2 != null) {
      this.usage = usage2;
    }
    if (this.firstAt == null && hasResponseChunk(chunk)) {
      this.firstAt = Date.now();
    }
  }
  attachTo(chunk) {
    (0, import_api2.attachInvocationMetrics)(chunk, {
      usageMetadata: this.usage,
      timing: createModelHubUsageTiming(
        this.start,
        this.firstAt,
        this.usage
      )
    });
    return chunk;
  }
};
function attachGenerationMetrics(generation, start) {
  const metrics = (0, import_api2.readInvocationMetrics)(generation);
  if (isUsableTiming(metrics.timing)) return;
  const usage2 = metrics.usageMetadata ?? readChunkUsage(generation);
  (0, import_api2.attachInvocationMetrics)(generation, {
    usageMetadata: usage2,
    timing: createModelHubUsageTiming(start, void 0, usage2)
  });
}
__name(attachGenerationMetrics, "attachGenerationMetrics");
function createModelHubUsageTiming(start, firstAt, usage2) {
  const totalMs = Math.max(Date.now() - start, 10);
  const outputTokens = usage2 == null ? void 0 : (usage2.output_tokens ?? 0) + (usage2.output_token_details?.reasoning ?? 0);
  const timing = {
    totalMs,
    tps: outputTokens == null ? void 0 : outputTokens * 1e3 / totalMs
  };
  if (firstAt == null) return timing;
  return {
    ttftMs: Math.max(firstAt - start, 10),
    ...timing
  };
}
__name(createModelHubUsageTiming, "createModelHubUsageTiming");
function isUsableTiming(timing) {
  if (timing == null) return false;
  if (timing.totalMs == null) return false;
  if (timing.totalMs != null && !Number.isFinite(timing.totalMs)) return false;
  if (timing.ttftMs != null && !Number.isFinite(timing.ttftMs)) return false;
  if (timing.tps != null && !Number.isFinite(timing.tps)) return false;
  return true;
}
__name(isUsableTiming, "isUsableTiming");
function readChunkUsage(chunk) {
  return chunk.message?.usage_metadata ?? chunk.generationInfo?.usage_metadata;
}
__name(readChunkUsage, "readChunkUsage");
function hasResponseChunk(chunk) {
  const message = chunk.message;
  const content = message?.content;
  const kwargs = message?.additional_kwargs;
  return chunk.text.length > 0 || (typeof content === "string" ? content.trim().length > 0 : Array.isArray(content) && content.length > 0) || (message?.tool_call_chunks?.length ?? 0) > 0 || (message?.tool_calls?.length ?? 0) > 0 || (message?.invalid_tool_calls?.length ?? 0) > 0 || (kwargs?.tool_calls?.length ?? 0) > 0 || kwargs?.function_call != null || kwargs?.thought_data != null;
}
__name(hasResponseChunk, "hasResponseChunk");

// src/client.ts
var ModelHubClient = class extends import_client.PlatformModelEmbeddingsAndRerankerClient {
  constructor(ctx, _config, plugin, _runtime, _metadata) {
    super(ctx, plugin.platformConfigPool);
    this._config = _config;
    this.plugin = plugin;
    this._runtime = _runtime;
    this._metadata = _metadata;
    this.platform = _runtime.platform;
    this._requester = new ModelHubRequester(
      ctx,
      plugin.platformConfigPool,
      _config,
      plugin
    );
  }
  static {
    __name(this, "ModelHubClient");
  }
  platform;
  _requester;
  async refreshModels(config) {
    try {
      const current = this.config;
      const rawModels = current?.pullModels === true || this._runtime.provider.adapter === "dify" ? await this._requester.getModels(config) : [];
      const enhancedModels = rawModels.map(
        (model) => this._metadata.enhance(this._runtime.provider.id, model)
      );
      const providerModels = current?.expandReasoningVariants === true ? expandReasoningVariantsForProvider(
        this._runtime.provider,
        enhancedModels,
        {
          reasoningProtocol: current?.reasoningProtocol
        }
      ) : enhancedModels;
      const apiModels = providerModels.filter(
        (model) => !(0, import_v1_shared_adapter11.isNonLLMModel)(model.name) || (0, import_v1_shared_adapter11.isImageGenerationModel)(model.name)
      ).map((model) => this._inferModelInfo(model));
      const additionalModels = getTargetedAdditionalModels(
        this._config.additionalModels,
        this._runtime.platform,
        this._runtime.provider.id
      ).map((model) => this._additionalModelInfo(model));
      const blacklist = getTargetedBlacklist(
        this._config.blacklistModels,
        this._runtime.platform,
        this._runtime.provider.id
      );
      const models = this._dedupeModels([
        ...apiModels,
        ...additionalModels
      ]).filter((model) => {
        const id = model.name.toLowerCase();
        return !blacklist.some((keyword) => id.includes(keyword));
      });
      this._requester.setModelCapabilities(models);
      return models;
    } catch (e) {
      if (e instanceof import_error6.ChatLunaError) {
        throw e;
      }
      throw new import_error6.ChatLunaError(import_error6.ChatLunaErrorCode.MODEL_INIT_ERROR, e);
    }
  }
  async reloadModels(config) {
    this._modelInfos = {};
    return await this.getModels(config);
  }
  async geminiResource(request) {
    return this._requester.geminiResources().request(request);
  }
  registerSelf() {
    this.ctx.chatluna.platform.registerClient(this.platform, () => this);
  }
  getFileHandlingConfig() {
    if (this._runtime.provider.adapter === "anthropic") {
      return ANTHROPIC_FILE_HANDLING_CONFIG;
    }
    if (this._runtime.provider.adapter !== "dify") {
      return null;
    }
    const configs = Object.keys(this.config.difyApps ?? {}).map((model) => this._difyFileHandlingConfig(model)).filter((item) => item != null);
    if (configs.length < 1) return null;
    const supportedMimeTypes = /* @__PURE__ */ new Set();
    const maxFileSizeBytesOverrides = {};
    let maxTotalSizeBytes = 0;
    let maxFileSizeBytes = 0;
    for (const config of configs) {
      for (const mimeType of config.supportedMimeTypes) {
        supportedMimeTypes.add(mimeType);
      }
      maxTotalSizeBytes = Math.max(
        maxTotalSizeBytes,
        config.maxTotalSizeBytes
      );
      maxFileSizeBytes = Math.max(
        maxFileSizeBytes,
        config.maxFileSizeBytes
      );
      for (const [mimeType, size] of Object.entries(
        config.maxFileSizeBytesOverrides ?? {}
      )) {
        maxFileSizeBytesOverrides[mimeType] = Math.max(
          maxFileSizeBytesOverrides[mimeType] ?? 0,
          size
        );
      }
    }
    return {
      supportedMimeTypes,
      maxTotalSizeBytes,
      maxFileSizeBytes,
      maxFileSizeBytesOverrides
    };
  }
  _createModel(model, report) {
    const info = this._modelInfos[model];
    if (info == null) {
      logger.warn(
        `Model ${model} not found`,
        JSON.stringify(this._modelInfos)
      );
      throw new import_error6.ChatLunaError(
        import_error6.ChatLunaErrorCode.MODEL_NOT_FOUND,
        new Error(`The model ${model} is not found in ${this.platform}`)
      );
    }
    if (info.type === import_types9.ModelType.llm) {
      const current2 = this.config ?? this._config;
      const modelMaxContextSize = (0, import_v1_shared_adapter11.getModelMaxContextSize)(info);
      return new import_model.ChatLunaChatModel({
        usageReporter: report,
        modelInfo: info,
        requester: this._requester,
        model,
        maxTokenLimit: Math.floor(
          (info.maxTokens || modelMaxContextSize || 128e3) * current2.maxContextRatio
        ),
        modelMaxContextSize,
        frequencyPenalty: current2.frequencyPenalty,
        presencePenalty: current2.presencePenalty,
        timeout: current2.timeout,
        temperature: current2.temperature,
        maxRetries: current2.maxRetries,
        llmType: this._runtime.provider.id,
        fileHandlingConfig: this._fileHandlingConfig(model, info),
        isThinkModel: info.capabilities.includes(
          import_types9.ModelCapabilities.Thinking
        )
      });
    }
    if (info.type === import_types9.ModelType.reranker) {
      const current2 = this.config ?? this._config;
      return new import_rerank.ChatLunaReranker({
        usageReporter: report,
        client: this._requester,
        model,
        maxRetries: current2.maxRetries,
        timeout: current2.timeout
      });
    }
    const current = this.config ?? this._config;
    return new import_model.ChatLunaEmbeddings({
      usageReporter: report,
      client: this._requester,
      model,
      maxRetries: current.maxRetries
    });
  }
  _inferModelInfo(model) {
    const name2 = model.name;
    const lower = name2.toLowerCase();
    const type = model.type ?? ((0, import_v1_shared_adapter11.isRerankerModel)(lower) ? import_types9.ModelType.reranker : (0, import_v1_shared_adapter11.isEmbeddingModel)(lower) ? import_types9.ModelType.embeddings : import_types9.ModelType.llm);
    if ((0, import_v1_shared_adapter11.isImageGenerationModel)(lower)) {
      return {
        name: name2,
        type: import_types9.ModelType.llm,
        maxTokens: positiveNumber(model.maxTokens) ?? 4096,
        capabilities: resolveCapabilities(
          this._runtime.provider.adapter,
          {
            ...model,
            capabilities: [
              ...model.capabilities ?? [],
              import_types9.ModelCapabilities.ImageGeneration
            ]
          },
          this.config?.responseApi === true
        ).filter(
          (capability) => capability !== import_types9.ModelCapabilities.ToolCall
        )
      };
    }
    const maxTokens = positiveNumber(model.maxTokens) ?? positiveNumber(
      this._metadata.getMaxTokens(this._runtime.provider.id, name2)
    );
    const info = {
      name: name2,
      type,
      ...model.reasoningVariantOf ? { reasoningVariantOf: model.reasoningVariantOf } : {},
      maxTokens: type === import_types9.ModelType.llm ? maxTokens ?? this._fallbackModelMaxContextSize(name2) : maxTokens ?? this._nonLlmInputTokenLimit(),
      capabilities: type === import_types9.ModelType.llm ? resolveCapabilities(
        this._runtime.provider.adapter,
        model,
        this.config?.responseApi === true
      ) : []
    };
    return info;
  }
  _additionalModelInfo(model) {
    const type = model.modelType === "embeddings" || model.modelType === "Embeddings 嵌入模型" ? import_types9.ModelType.embeddings : model.modelType === "reranker" || model.modelType === "Reranker 重排序模型" ? import_types9.ModelType.reranker : import_types9.ModelType.llm;
    return {
      name: model.model,
      type,
      maxTokens: positiveNumber(model.contextSize) ?? 4096,
      capabilities: type === import_types9.ModelType.llm ? protocolCapabilities(
        this._runtime.provider.adapter,
        model.modelCapabilities,
        this.config?.responseApi === true
      ) : model.modelCapabilities.filter(
        (cap) => cap !== import_types9.ModelCapabilities.ToolCall
      )
    };
  }
  _dedupeModels(models) {
    const result = /* @__PURE__ */ new Map();
    for (const model of models) {
      if (!model.name) continue;
      result.set(model.name, model);
    }
    return [...result.values()];
  }
  _fallbackModelMaxContextSize(model) {
    const inferred = (0, import_v1_shared_adapter11.getModelMaxContextSize)({
      name: model,
      type: import_types9.ModelType.llm,
      maxTokens: void 0,
      capabilities: []
    });
    return positiveNumber(inferred) ?? 128e3;
  }
  _nonLlmInputTokenLimit() {
    return positiveNumber(this.config?.nonLlmInputTokenLimit) ?? 8192;
  }
  _fileHandlingConfig(model, info) {
    if (this._runtime.provider.adapter === "anthropic") {
      const supportedMimeTypes = new Set(
        [...ANTHROPIC_FILE_HANDLING_CONFIG.supportedMimeTypes].filter(
          (mime) => info.capabilities.includes(
            mime.startsWith("image/") ? import_types9.ModelCapabilities.ImageInput : import_types9.ModelCapabilities.FileInput
          )
        )
      );
      return supportedMimeTypes.size > 0 ? { ...ANTHROPIC_FILE_HANDLING_CONFIG, supportedMimeTypes } : void 0;
    }
    if (this._runtime.provider.adapter !== "dify") {
      const config = capabilityFileHandling(
        this._runtime.provider.adapter,
        info.capabilities
      );
      if (config && this._runtime.provider.adapter === "gemini" && this.config.geminiFileUpload) {
        const limit = Math.min(this.config.geminiMaxFileSizeMb ?? 64, 2048) * 1024 * 1024;
        return {
          ...config,
          maxFileSizeBytes: limit,
          maxTotalSizeBytes: limit
        };
      }
      return config;
    }
    if (!info.capabilities.includes(import_types9.ModelCapabilities.FileInput)) {
      return void 0;
    }
    const difyFileHandling = this._difyFileHandlingConfig(model);
    if (difyFileHandling != null) return difyFileHandling;
    return {
      supportedMimeTypes: /* @__PURE__ */ new Set([
        "image/png",
        "image/jpeg",
        "image/gif",
        "image/webp",
        "image/svg+xml",
        "application/pdf",
        "text/plain",
        "text/markdown",
        "audio/mpeg",
        "audio/wav",
        "audio/ogg",
        "video/mp4",
        "video/quicktime"
      ]),
      maxTotalSizeBytes: 100 * 1024 * 1024,
      maxFileSizeBytes: 50 * 1024 * 1024,
      maxFileSizeBytesOverrides: {
        "application/pdf": 50 * 1024 * 1024,
        "video/mp4": 100 * 1024 * 1024,
        "video/quicktime": 100 * 1024 * 1024
      }
    };
  }
  _difyFileHandlingConfig(model) {
    const app = this.config.difyApps?.[model];
    const limits = app?.parameters?.fileHandling;
    if (limits == null) return void 0;
    return {
      supportedMimeTypes: new Set(limits.supportedMimeTypes),
      maxTotalSizeBytes: limits.maxTotalSizeBytes,
      maxFileSizeBytes: limits.maxFileSizeBytes,
      maxFileSizeBytesOverrides: limits.maxFileSizeBytesOverrides
    };
  }
};
function positiveNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : void 0;
}
__name(positiveNumber, "positiveNumber");
var ANTHROPIC_FILE_HANDLING_CONFIG = {
  supportedMimeTypes: /* @__PURE__ */ new Set([
    "text/html",
    "text/css",
    "text/plain",
    "text/markdown",
    "text/xml",
    "text/csv",
    "text/rtf",
    "text/javascript",
    "application/json",
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp"
  ]),
  maxTotalSizeBytes: 32 * 1024 * 1024,
  maxFileSizeBytes: 32 * 1024 * 1024,
  maxFileSizeBytesOverrides: {
    "image/jpeg": 5 * 1024 * 1024,
    "image/png": 5 * 1024 * 1024,
    "image/gif": 5 * 1024 * 1024,
    "image/webp": 5 * 1024 * 1024
  }
};

// src/metadata.ts
var import_promises2 = require("fs/promises");
var import_crypto2 = require("crypto");
var import_path2 = require("path");
var import_v1_shared_adapter12 = require("@chatluna/v1-shared-adapter");
var import_types10 = require("koishi-plugin-chatluna/llm-core/platform/types");
var ModelMetadataStore = class {
  constructor(ctx, options = {}) {
    this.ctx = ctx;
    this.options = options;
    this.path = (0, import_path2.resolve)(
      ctx.baseDir,
      options.cachePath || "data/chatluna-model-hub/models.dev.models.json"
    );
  }
  static {
    __name(this, "ModelMetadataStore");
  }
  _models = /* @__PURE__ */ new Map();
  _aliases = /* @__PURE__ */ new Map();
  _timer;
  _refreshing;
  _disposed = false;
  _controller;
  path;
  async start() {
    if (this._timer || this._disposed) return;
    const interval = Math.max(1, this.options.updateHours ?? 24) * 60 * 60 * 1e3;
    this._timer = setInterval(() => {
      this.refresh().then(
        () => this._disposed ? void 0 : this.options.onUpdate?.()
      ).catch(
        (error) => this.ctx.logger("chatluna-model-hub-adapter").warn(error)
      );
    }, interval);
    this.ctx.on("dispose", () => {
      this._disposed = true;
      if (this._timer) clearInterval(this._timer);
      this._controller?.abort();
    });
    try {
      await this.load();
    } catch (error) {
      this.ctx.logger("chatluna-model-hub-adapter").warn(error);
    }
    await this.refresh();
  }
  async load() {
    try {
      const raw = await (0, import_promises2.readFile)(this.path, "utf8");
      this.apply(JSON.parse(raw));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  refresh() {
    if (this._disposed) return Promise.resolve();
    if (this._refreshing) return this._refreshing;
    this._refreshing = this.refreshInternal().then(
      () => {
        if (!this._disposed) this.options.onStatus?.();
      },
      (error) => {
        if (!this._disposed) this.options.onStatus?.(error);
        throw error;
      }
    ).finally(() => {
      this._refreshing = void 0;
    });
    return this._refreshing;
  }
  async refreshInternal() {
    const catalog = await this.downloadCatalog(
      this.options.url || "https://models.dev/api.json"
    );
    validateCatalog(catalog);
    if (this._disposed) return;
    const temporaryPath = `${this.path}.${(0, import_crypto2.randomUUID)()}.tmp`;
    try {
      await (0, import_promises2.mkdir)((0, import_path2.dirname)(this.path), { recursive: true });
      await (0, import_promises2.writeFile)(
        temporaryPath,
        `${JSON.stringify(catalog)}
`,
        "utf8"
      );
      if (this._disposed) return;
      await (0, import_promises2.rename)(temporaryPath, this.path);
      this.apply(catalog);
    } finally {
      await (0, import_promises2.rm)(temporaryPath, { force: true });
    }
  }
  enhance(provider, model) {
    const metadata = this.findEntry(provider, model);
    if (!metadata) return model;
    return {
      ...model,
      maxTokens: positiveNumber2(model.maxTokens) ?? metadataMaxTokens(metadata),
      capabilities: mergeCapabilities2(
        model.capabilities,
        capabilitiesFromMetadata(metadata)
      ),
      capabilityOverrides: {
        ...capabilityOverridesFromMetadata(metadata),
        ...model.capabilityOverrides
      },
      reasoningEfforts: model.reasoningEfforts ?? reasoningEffortsFromMetadata(provider, metadata)
    };
  }
  getMaxTokens(provider, model) {
    const metadata = this.find(provider, model);
    return metadata ? metadataMaxTokens(metadata) : void 0;
  }
  apply(catalog) {
    validateCatalog(catalog);
    this._models.clear();
    this._aliases.clear();
    for (const [id, model] of Object.entries(modelsFromCatalog(catalog))) {
      const keys = /* @__PURE__ */ new Set([
        id,
        ...!id.includes("/") && model.id ? [model.id] : []
      ]);
      for (const key of keys) {
        const normalized = normalizeModelId(key);
        this._models.set(normalized, model);
        const alias = modelAlias(normalized);
        if (alias !== normalized) this.setAlias(alias, model);
      }
    }
  }
  findEntry(provider, model) {
    return this.find(provider, model.name) ?? (model.reasoningVariantOf ? this.find(provider, model.reasoningVariantOf) : void 0);
  }
  find(provider, model) {
    for (const candidate of metadataLookupCandidates(model)) {
      const metadata = this.findCandidate(provider, candidate);
      if (metadata) return metadata;
    }
  }
  findCandidate(provider, model) {
    for (const prefix of providerPrefixes(provider)) {
      const prefixed = this._models.get(
        normalizeModelId(`${prefix}/${model}`)
      );
      if (prefixed) return prefixed;
    }
    const exact = this._models.get(normalizeModelId(model));
    if (exact) return exact;
    const alias = this._aliases.get(normalizeModelId(model));
    if (alias) return alias;
  }
  setAlias(alias, model) {
    if (!alias) return;
    if (!this._aliases.has(alias)) {
      this._aliases.set(alias, model);
      return;
    }
    if (this._aliases.get(alias) !== model) {
      this._aliases.set(alias, void 0);
    }
  }
  async downloadCatalog(url) {
    const controller = new AbortController();
    this._controller = controller;
    const timer = setTimeout(() => controller.abort(), 6e4);
    try {
      if (this.ctx.http != null) {
        const response2 = await this.ctx.http(url, {
          method: "GET",
          responseType: "json",
          timeout: 6e4,
          signal: controller.signal
        });
        return response2.data;
      }
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(
          `Failed to download models.dev catalog: ${response.status}`
        );
      }
      return await response.json();
    } finally {
      clearTimeout(timer);
      this._controller = void 0;
    }
  }
};
function reasoningEffortsFromMetadata(provider, model) {
  const values = [
    ...Array.isArray(model.reasoning_effort) ? model.reasoning_effort : [],
    ...model.reasoning_efforts ?? [],
    ...model.supported_reasoning_efforts ?? [],
    ...reasoningOptionEfforts(model.reasoning_options)
  ].map(normalizeReasoningEffort3).filter((value) => value != null);
  if (values.length > 0) return [...new Set(values)];
  if (provider === "anthropic") return void 0;
  if (model.reasoning_effort === true || model.supported_parameters?.includes("reasoning_effort")) {
    return ["low", "medium", "high"];
  }
  if (model.reasoning === true) return ["low", "medium", "high"];
}
__name(reasoningEffortsFromMetadata, "reasoningEffortsFromMetadata");
function reasoningOptionEfforts(options) {
  return (options ?? []).filter((option) => option?.type === "effort").flatMap((option) => option.values ?? []);
}
__name(reasoningOptionEfforts, "reasoningOptionEfforts");
function normalizeReasoningEffort3(value) {
  if (typeof value !== "string") return void 0;
  const normalized = value.trim().toLowerCase().replace(/[-_\s]*thinking$/, "");
  if (normalized === "tiny") return "minimal";
  if (normalized === "none" || normalized === "minimal" || normalized === "low" || normalized === "medium" || normalized === "high" || normalized === "xhigh" || normalized === "max") {
    return normalized;
  }
}
__name(normalizeReasoningEffort3, "normalizeReasoningEffort");
function modelsFromCatalog(catalog) {
  if (isRecord(catalog) && isModelMap(catalog.models)) {
    return catalog.models;
  }
  const providerModels = {};
  for (const [provider, value] of Object.entries(catalog)) {
    if (!isRecord(value) || !isModelMap(value.models)) continue;
    for (const [id, model] of Object.entries(value.models)) {
      providerModels[`${provider}/${id}`] = model;
    }
  }
  if (Object.keys(providerModels).length > 0) return providerModels;
  return catalog;
}
__name(modelsFromCatalog, "modelsFromCatalog");
function isModelMap(value) {
  if (!isRecord(value)) return false;
  return Object.values(value).some(isModelsDevModel);
}
__name(isModelMap, "isModelMap");
function isModelsDevModel(value) {
  if (!isRecord(value)) return false;
  const modalities = value.modalities;
  return typeof value.id === "string" || typeof value.name === "string" || isRecord(value.limit) || isRecord(modalities) && Array.isArray(modalities.input) || typeof value.reasoning === "boolean" || typeof value.tool_call === "boolean";
}
__name(isModelsDevModel, "isModelsDevModel");
function isRecord(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}
__name(isRecord, "isRecord");
function normalizeModelId(value) {
  return value.trim().toLowerCase();
}
__name(normalizeModelId, "normalizeModelId");
function metadataLookupCandidates(model) {
  const exact = model.trim();
  const realModel = (0, import_v1_shared_adapter12.parseOpenAIModelNameWithReasoningEffort)(exact).model.trim();
  return unique([exact, realModel].filter(Boolean));
}
__name(metadataLookupCandidates, "metadataLookupCandidates");
function unique(values) {
  return [...new Set(values)];
}
__name(unique, "unique");
function modelAlias(value) {
  const index = value.lastIndexOf("/");
  return index >= 0 ? value.slice(index + 1) : value;
}
__name(modelAlias, "modelAlias");
function providerPrefixes(provider) {
  const map = {
    openai: ["openai"],
    gemini: ["google"],
    deepseek: ["deepseek"],
    qwen: ["alibaba"],
    zhipu: ["zhipuai"],
    moonshot: ["moonshotai"],
    xai: ["xai"],
    minimax: ["minimax"],
    mistral: ["mistral"],
    anthropic: ["anthropic"],
    groq: ["groq"],
    together: ["togetherai", "together"],
    modelscope: ["modelscope"],
    openrouter: ["openrouter"]
  };
  return map[provider] ?? [provider];
}
__name(providerPrefixes, "providerPrefixes");
function capabilitiesFromMetadata(model) {
  const capabilities = [];
  const input = new Set(model.modalities?.input ?? []);
  const output = new Set(model.modalities?.output ?? []);
  if (model.tool_call) capabilities.push(import_types10.ModelCapabilities.ToolCall);
  if (model.reasoning) capabilities.push(import_types10.ModelCapabilities.Thinking);
  if (input.has("image")) capabilities.push(import_types10.ModelCapabilities.ImageInput);
  if (input.has("audio")) capabilities.push(import_types10.ModelCapabilities.AudioInput);
  if (input.has("video")) capabilities.push(import_types10.ModelCapabilities.VideoInput);
  if (input.has("pdf")) capabilities.push(import_types10.ModelCapabilities.FileInput);
  if (output.has("image"))
    capabilities.push(import_types10.ModelCapabilities.ImageGeneration);
  return capabilities;
}
__name(capabilitiesFromMetadata, "capabilitiesFromMetadata");
function capabilityOverridesFromMetadata(model) {
  const result = {};
  if (typeof model.tool_call === "boolean")
    result[import_types10.ModelCapabilities.ToolCall] = model.tool_call;
  if (typeof model.reasoning === "boolean")
    result[import_types10.ModelCapabilities.Thinking] = model.reasoning;
  if (Array.isArray(model.modalities?.input)) {
    const input = new Set(model.modalities.input);
    result[import_types10.ModelCapabilities.ImageInput] = input.has("image");
    result[import_types10.ModelCapabilities.AudioInput] = input.has("audio");
    result[import_types10.ModelCapabilities.VideoInput] = input.has("video");
    result[import_types10.ModelCapabilities.FileInput] = input.has("file") || input.has("pdf");
  }
  if (Array.isArray(model.modalities?.output)) {
    result[import_types10.ModelCapabilities.ImageGeneration] = model.modalities.output.includes("image");
  }
  return result;
}
__name(capabilityOverridesFromMetadata, "capabilityOverridesFromMetadata");
function validateCatalog(catalog) {
  const models = isRecord(catalog) ? Object.values(modelsFromCatalog(catalog)) : [];
  if (!models.length || !models.every(
    (model) => isModelsDevModel(model) && (model.id == null || typeof model.id === "string")
  )) {
    throw new Error(
      "Invalid or empty models.dev catalog; keeping the last known cache."
    );
  }
}
__name(validateCatalog, "validateCatalog");
function metadataMaxTokens(model) {
  return positiveNumber2(model.limit?.context) ?? positiveNumber2(model.limit?.input);
}
__name(metadataMaxTokens, "metadataMaxTokens");
function positiveNumber2(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : void 0;
}
__name(positiveNumber2, "positiveNumber");
function mergeCapabilities2(preferred, fallback) {
  if ((preferred?.length ?? 0) < 1) return fallback;
  return [.../* @__PURE__ */ new Set([...preferred ?? [], ...fallback])];
}
__name(mergeCapabilities2, "mergeCapabilities");

// src/settings.ts
var import_promises3 = require("fs/promises");
var import_path3 = require("path");
var import_types11 = require("koishi-plugin-chatluna/llm-core/platform/types");
var DEFAULT_SETTINGS_PATH = "data/chatluna-model-hub/config.json";
var DEFAULT_PROVIDER_ADVANCED_SETTINGS = {
  customHeaders: [],
  chatConcurrentMaxSize: 3,
  chatTimeLimit: 200,
  configMode: "default",
  maxRetries: 5,
  timeout: 3e5,
  proxyMode: "system",
  proxyAddress: "",
  maxContextRatio: 0.35,
  temperature: 1,
  presencePenalty: 0,
  frequencyPenalty: 0,
  nonStreaming: false,
  expandReasoningVariants: false,
  nonLlmInputTokenLimit: 8192
};
var DEFAULT_RESPONSE_BUILTIN_TOOL_SUPPORT_MODELS = [
  "gpt-4o",
  "gpt-4.1",
  "gpt-5",
  "gpt-6",
  "o3",
  "o4"
];
var ModelHubSettingsStore = class {
  static {
    __name(this, "ModelHubSettingsStore");
  }
  path;
  constructor(ctx, settingsPath) {
    this.path = resolveSettingsPath(ctx, settingsPath);
  }
  async load(legacy) {
    try {
      const raw = await (0, import_promises3.readFile)(this.path, "utf8");
      return normalizeSettings(JSON.parse(raw));
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }
    const migrated = pickLegacySettings(legacy);
    const settings = normalizeSettings(migrated ?? {});
    await this.save(settings);
    return settings;
  }
  async save(settings) {
    await (0, import_promises3.mkdir)((0, import_path3.dirname)(this.path), { recursive: true });
    await (0, import_promises3.writeFile)(
      this.path,
      `${JSON.stringify(normalizeSettings(settings), null, 2)}
`,
      "utf8"
    );
  }
};
function resolveSettingsPath(ctx, settingsPath) {
  const value = (settingsPath || DEFAULT_SETTINGS_PATH).trim();
  return (0, import_path3.isAbsolute)(value) ? value : (0, import_path3.resolve)(ctx.baseDir, value);
}
__name(resolveSettingsPath, "resolveSettingsPath");
function createResolvedConfig(config, settings, advanced = DEFAULT_PROVIDER_ADVANCED_SETTINGS) {
  return {
    ...settings,
    ...advanced,
    ...config
  };
}
__name(createResolvedConfig, "createResolvedConfig");
function toConsoleSettings(settings) {
  return {
    ...cloneSettings(settings),
    providers: settings.providers.map((provider) => ({
      ...provider,
      apiKey: "",
      apiKeyPreview: previewSecret(provider.apiKey),
      hasApiKey: provider.apiKey.trim().length > 0,
      clearApiKey: false,
      customHeaders: provider.customHeaders.map(
        (header) => toConsoleHeader(header)
      )
    }))
  };
}
__name(toConsoleSettings, "toConsoleSettings");
function normalizeSettings(input, previous) {
  const value = isRecord2(input) ? input : {};
  const legacyAdvanced = normalizeProviderAdvanced(value);
  return {
    providers: arrayOf2(value.providers).map(
      (entry) => normalizeProvider(entry, previous, legacyAdvanced)
    ),
    additionalModels: arrayOf2(value.additionalModels).map(
      normalizeAdditionalModel
    ),
    blacklistModels: arrayOf2(value.blacklistModels).map(normalizeFilter)
  };
}
__name(normalizeSettings, "normalizeSettings");
function normalizeProviderAdvanced(input, previous, fallback = DEFAULT_PROVIDER_ADVANCED_SETTINGS) {
  const value = isRecord2(input) ? input : {};
  const merged = {
    ...fallback,
    ...previous,
    ...value
  };
  const headerSource = value.customHeaders === void 0 ? previous?.customHeaders ?? fallback.customHeaders : value.customHeaders;
  return {
    customHeaders: arrayOf2(headerSource).map(
      (entry) => normalizeHeader(entry, previous?.customHeaders)
    ),
    chatConcurrentMaxSize: clampNumber(
      merged.chatConcurrentMaxSize,
      3,
      1,
      8
    ),
    chatTimeLimit: clampNumber(merged.chatTimeLimit, 200, 1, 2e3),
    configMode: merged.configMode === "balance" ? "balance" : "default",
    maxRetries: clampNumber(merged.maxRetries, 5, 0, 6),
    timeout: clampNumber(merged.timeout, 3e5, 1e3),
    proxyMode: merged.proxyMode === "on" || merged.proxyMode === "off" ? merged.proxyMode : "system",
    proxyAddress: stringOf(merged.proxyAddress),
    maxContextRatio: clampNumber(merged.maxContextRatio, 0.35, 0, 1),
    temperature: clampNumber(merged.temperature, 1, 0, 2),
    presencePenalty: clampNumber(merged.presencePenalty, 0, -2, 2),
    frequencyPenalty: clampNumber(merged.frequencyPenalty, 0, -2, 2),
    nonStreaming: merged.nonStreaming === true,
    expandReasoningVariants: merged.expandReasoningVariants === true,
    nonLlmInputTokenLimit: clampNumber(
      merged.nonLlmInputTokenLimit,
      8192,
      1
    )
  };
}
__name(normalizeProviderAdvanced, "normalizeProviderAdvanced");
function cloneSettings(settings) {
  return {
    ...settings,
    providers: settings.providers.map((item) => cloneProvider(item)),
    additionalModels: settings.additionalModels.map((item) => ({
      ...item,
      modelCapabilities: [...item.modelCapabilities]
    })),
    blacklistModels: settings.blacklistModels.map((item) => ({ ...item }))
  };
}
__name(cloneSettings, "cloneSettings");
function cloneProvider(provider) {
  return {
    ...provider,
    customHeaders: provider.customHeaders.map((item) => ({ ...item }))
  };
}
__name(cloneProvider, "cloneProvider");
function normalizeProvider(input, previous, legacyAdvanced = DEFAULT_PROVIDER_ADVANCED_SETTINGS) {
  const value = isRecord2(input) ? input : {};
  const preset = getProviderPreset(stringOf(value.provider, "openai"));
  const platform = normalizePlatformName(
    stringOf(value.platform),
    preset.defaultPlatform
  );
  const previousEntry = findPreviousProvider(previous, preset.id, platform);
  const consoleValue = value;
  const nextKey = stringOf(value.apiKey).trim();
  const providerAdvanced = normalizeProviderAdvanced(
    value,
    previousEntry,
    legacyAdvanced
  );
  if (value.customHeaders === void 0 && previousEntry == null) {
    providerAdvanced.customHeaders = providerAdvanced.customHeaders.filter(
      (header) => targetMatches(header.target, platform, preset.id)
    ).map((header) => ({ ...header, target: "*" }));
  }
  return {
    ...providerAdvanced,
    ...normalizeProviderSpecific(value, previousEntry, preset.id),
    provider: preset.id,
    name: stringOf(value.name).trim() || void 0,
    platform,
    apiKey: consoleValue.clearApiKey === true ? "" : nextKey || previousEntry?.apiKey || "",
    apiEndpoint: stringOf(value.apiEndpoint, preset.defaultEndpoint).trim(),
    enabled: value.enabled !== false,
    pullModels: value.pullModels !== false
  };
}
__name(normalizeProvider, "normalizeProvider");
function enumOf(value, choices, fallback) {
  return choices.includes(value) ? value : fallback;
}
__name(enumOf, "enumOf");
function jsonObject(value) {
  if (value == null) return void 0;
  if (typeof value !== "object" || Array.isArray(value))
    throw new Error("JSON Schema must be an object");
  return structuredClone(value);
}
__name(jsonObject, "jsonObject");
function normalizeProviderSpecific(input, previous, provider) {
  const cache = {
    promptCacheMode: enumOf(
      input.promptCacheMode ?? previous?.promptCacheMode,
      ["default", "implicit", "explicit"],
      "default"
    ),
    promptCacheTtl: enumOf(
      input.promptCacheTtl ?? previous?.promptCacheTtl,
      ["5m", "30m", "1h"],
      provider === "moonshot" ? "5m" : "30m"
    ),
    promptCacheRetention: input.promptCacheRetention == null ? previous?.promptCacheRetention : enumOf(
      input.promptCacheRetention,
      ["24h", "in-memory"],
      "in-memory"
    ),
    promptCacheKey: stringOf(
      input.promptCacheKey ?? previous?.promptCacheKey,
      ""
    )
  };
  if (provider === "openai" || provider === "xai") {
    return {
      ...cache,
      reasoningProtocol: normalizeReasoningProtocol(
        input.reasoningProtocol ?? previous?.reasoningProtocol,
        defaultReasoningProtocol(provider)
      ),
      responseApi: booleanOrUndefined(input.responseApi) ?? previous?.responseApi ?? provider === "xai",
      responseBuiltinTools: arrayOf2(
        input.responseBuiltinTools ?? previous?.responseBuiltinTools ?? []
      ).filter(isResponseBuiltinTool),
      responseBuiltinToolSupportModel: stringArrayOf(
        input.responseBuiltinToolSupportModel ?? previous?.responseBuiltinToolSupportModel,
        provider === "xai" ? ["grok"] : DEFAULT_RESPONSE_BUILTIN_TOOL_SUPPORT_MODELS
      ),
      responseFileSearchVectorStoreIds: stringArrayOf(
        input.responseFileSearchVectorStoreIds ?? previous?.responseFileSearchVectorStoreIds,
        []
      )
    };
  }
  if (isOpenAICompatibleProvider(provider)) {
    return {
      ...cache,
      reasoningProtocol: normalizeReasoningProtocol(
        input.reasoningProtocol ?? previous?.reasoningProtocol,
        defaultReasoningProtocol(provider)
      )
    };
  }
  if (provider === "gemini") {
    return {
      geminiApi: enumOf(
        input.geminiApi ?? previous?.geminiApi,
        ["generateContent", "interactions"],
        "generateContent"
      ),
      geminiFileUpload: booleanOrUndefined(input.geminiFileUpload) ?? previous?.geminiFileUpload ?? false,
      geminiMaxFileSizeMb: clampNumber(
        input.geminiMaxFileSizeMb ?? previous?.geminiMaxFileSizeMb,
        64,
        1,
        2048
      ),
      geminiCachedContent: stringOf(
        input.geminiCachedContent ?? previous?.geminiCachedContent,
        ""
      ),
      geminiResponseMimeType: stringOf(
        input.geminiResponseMimeType ?? previous?.geminiResponseMimeType,
        ""
      ),
      geminiResponseJsonSchema: jsonObject(
        input.geminiResponseJsonSchema ?? previous?.geminiResponseJsonSchema
      ),
      agenticVideo: booleanOrUndefined(input.agenticVideo) ?? previous?.agenticVideo ?? false,
      useCamelCaseMediaFields: booleanOrUndefined(input.useCamelCaseMediaFields) ?? previous?.useCamelCaseMediaFields ?? false,
      googleSearch: booleanOrUndefined(input.googleSearch) ?? previous?.googleSearch ?? false,
      codeExecution: booleanOrUndefined(input.codeExecution) ?? previous?.codeExecution ?? false,
      urlContext: booleanOrUndefined(input.urlContext) ?? previous?.urlContext ?? false,
      imageGeneration: booleanOrUndefined(input.imageGeneration) ?? previous?.imageGeneration ?? false,
      thinkingBudget: clampNumber(
        input.thinkingBudget ?? previous?.thinkingBudget,
        -1,
        -1,
        24576
      ),
      includeThoughts: booleanOrUndefined(input.includeThoughts) ?? previous?.includeThoughts ?? false,
      groundingContentDisplay: booleanOrUndefined(input.groundingContentDisplay) ?? previous?.groundingContentDisplay ?? false
    };
  }
  if (provider === "anthropic") {
    return {
      anthropicPromptCache: booleanOrUndefined(input.anthropicPromptCache) ?? previous?.anthropicPromptCache ?? false,
      anthropicPromptCacheTtl: normalizeAnthropicPromptCacheTtl(
        input.anthropicPromptCacheTtl ?? previous?.anthropicPromptCacheTtl
      )
    };
  }
  if (provider === "dify") {
    return {
      difyAppType: normalizeDifyAppType(
        input.difyAppType ?? previous?.difyAppType
      ),
      difyModelName: stringOf(
        input.difyModelName,
        previous?.difyModelName
      ).trim(),
      difyWorkflowId: stringOf(
        input.difyWorkflowId,
        previous?.difyWorkflowId
      ).trim(),
      difyOutputVariable: stringOf(
        input.difyOutputVariable,
        previous?.difyOutputVariable
      ).trim(),
      difyEnableFileUpload: booleanOrUndefined(input.difyEnableFileUpload) ?? previous?.difyEnableFileUpload ?? true,
      difyContextSize: clampNumber(
        input.difyContextSize ?? previous?.difyContextSize,
        128e3,
        1
      )
    };
  }
  return {};
}
__name(normalizeProviderSpecific, "normalizeProviderSpecific");
function normalizeAdditionalModel(input) {
  const value = isRecord2(input) ? input : {};
  const capabilities = new Set(Object.values(import_types11.ModelCapabilities));
  return {
    target: stringOf(value.target, "*"),
    model: stringOf(value.model).trim(),
    modelType: stringOf(value.modelType, "LLM 大语言模型"),
    modelCapabilities: stringArrayOf(value.modelCapabilities, [
      import_types11.ModelCapabilities.TextInput,
      import_types11.ModelCapabilities.ToolCall
    ]).filter(
      (item) => capabilities.has(item)
    ),
    contextSize: clampNumber(value.contextSize, 128e3, 1)
  };
}
__name(normalizeAdditionalModel, "normalizeAdditionalModel");
function normalizeFilter(input) {
  const value = isRecord2(input) ? input : {};
  return {
    target: stringOf(value.target, "*"),
    keyword: stringOf(value.keyword).trim()
  };
}
__name(normalizeFilter, "normalizeFilter");
function normalizeHeader(input, previous) {
  const value = isRecord2(input) ? input : {};
  const target = stringOf(value.target, "*");
  const name2 = stringOf(value.name).trim();
  const previousEntry = previous?.find(
    (item) => normalizeId(item.target, "*") === normalizeId(target, "*") && item.name.toLowerCase() === name2.toLowerCase()
  );
  const consoleValue = value;
  const nextValue = stringOf(value.value);
  return {
    target,
    name: name2,
    value: consoleValue.clearValue === true ? "" : nextValue || previousEntry?.value || ""
  };
}
__name(normalizeHeader, "normalizeHeader");
function toConsoleHeader(header) {
  return {
    ...header,
    value: "",
    valuePreview: previewSecret(header.value),
    hasValue: header.value.trim().length > 0,
    clearValue: false
  };
}
__name(toConsoleHeader, "toConsoleHeader");
function findPreviousProvider(previous, provider, platform) {
  if (!previous) return void 0;
  return previous.providers.find(
    (entry) => normalizeId(entry.provider) === normalizeId(provider) && normalizeId(entry.platform) === normalizeId(platform)
  ) ?? previous.providers.find(
    (entry) => normalizeId(entry.platform) === normalizeId(platform)
  );
}
__name(findPreviousProvider, "findPreviousProvider");
function pickLegacySettings(input) {
  if (!isRecord2(input)) return null;
  const result = {};
  const providers = arrayOf2(input.providers).filter(
    isMeaningfulLegacyProvider
  );
  if (providers.length > 0) {
    result.providers = providers.map((provider) => ({
      ...provider
    }));
  }
  for (const key of [
    "additionalModels",
    "blacklistModels",
    "customHeaders",
    "chatConcurrentMaxSize",
    "chatTimeLimit",
    "configMode",
    "maxRetries",
    "timeout",
    "proxyMode",
    "proxyAddress",
    "maxContextRatio",
    "temperature",
    "presencePenalty",
    "frequencyPenalty",
    "nonStreaming",
    "expandReasoningVariants",
    "nonLlmInputTokenLimit"
  ]) {
    if (input[key] !== void 0) {
      ;
      result[key] = input[key];
    }
  }
  return Object.keys(result).length > 0 ? result : null;
}
__name(pickLegacySettings, "pickLegacySettings");
function isResponseBuiltinTool(value) {
  return value === "web_search" || value === "x_search" || value === "web_search_preview" || value === "image_generation" || value === "code_interpreter" || value === "file_search";
}
__name(isResponseBuiltinTool, "isResponseBuiltinTool");
function booleanOrUndefined(value) {
  return typeof value === "boolean" ? value : void 0;
}
__name(booleanOrUndefined, "booleanOrUndefined");
function normalizeDifyAppType(value) {
  return value === "agent" || value === "workflow" || value === "completion" ? value : "chat";
}
__name(normalizeDifyAppType, "normalizeDifyAppType");
function normalizeAnthropicPromptCacheTtl(value) {
  return value === "1h" ? "1h" : "5m";
}
__name(normalizeAnthropicPromptCacheTtl, "normalizeAnthropicPromptCacheTtl");
function normalizeReasoningProtocol(value, fallback = "openai") {
  return value === "deepseek" || value === "qwen" || value === "gemini" || value === "anthropic" || value === "openrouter" || value === "auto" ? value : fallback;
}
__name(normalizeReasoningProtocol, "normalizeReasoningProtocol");
function isOpenAICompatibleProvider(provider) {
  return provider === "openai-compatible" || provider === "newapi" || provider === "openrouter" || provider === "siliconflow" || provider === "modelscope";
}
__name(isOpenAICompatibleProvider, "isOpenAICompatibleProvider");
function defaultReasoningProtocol(provider) {
  if (provider === "openrouter") return "openrouter";
  if (provider === "modelscope") return "auto";
  return "openai";
}
__name(defaultReasoningProtocol, "defaultReasoningProtocol");
function isMeaningfulLegacyProvider(input) {
  if (!isRecord2(input)) return false;
  const provider = stringOf(input.provider);
  const preset = getProviderPreset(provider);
  if (stringOf(input.apiKey).trim()) return true;
  if (preset.allowEmptyApiKey) return true;
  const equivalentDefault = DEFAULT_PROVIDER_CONFIGS.some(
    (item) => item.provider === preset.id && normalizeId(item.platform) === normalizeId(stringOf(input.platform, item.platform)) && item.apiEndpoint === stringOf(input.apiEndpoint, item.apiEndpoint).trim() && input.enabled !== false
  );
  return !equivalentDefault;
}
__name(isMeaningfulLegacyProvider, "isMeaningfulLegacyProvider");
function previewSecret(value) {
  const secret = value?.trim();
  if (!secret) return "";
  if (secret.length <= 8) return "已保存";
  return `${secret.slice(0, 3)}...${secret.slice(-4)}`;
}
__name(previewSecret, "previewSecret");
function arrayOf2(value) {
  return Array.isArray(value) ? value : [];
}
__name(arrayOf2, "arrayOf");
function stringArrayOf(value, fallback) {
  const source = Array.isArray(value) ? value : fallback;
  return source.map((item) => stringOf(item).trim()).filter(Boolean);
}
__name(stringArrayOf, "stringArrayOf");
function stringOf(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}
__name(stringOf, "stringOf");
function clampNumber(value, fallback, min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}
__name(clampNumber, "clampNumber");
function isRecord2(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}
__name(isRecord2, "isRecord");

// src/index.ts
var logger;
var ModelHubConsoleService = class extends import_plugin_console.DataService {
  constructor(ctx, _options) {
    super(ctx, "chatluna_model_hub", {
      immediate: true,
      authority: 1
    });
    this._options = _options;
  }
  static {
    __name(this, "ModelHubConsoleService");
  }
  get _settings() {
    return this._options.getSettings();
  }
  get _runtime() {
    return this._options.runtime;
  }
  async get() {
    const settings = this._settings;
    const configured = settings.providers ?? [];
    const runtimeByConfigIndex = /* @__PURE__ */ new Map();
    for (const runtime of this._runtime.providers) {
      for (const entry of runtime.entries) {
        if (entry.configIndex != null) {
          runtimeByConfigIndex.set(entry.configIndex, runtime);
        }
      }
    }
    const providers = configured.map((entry, index) => {
      const preset = getProviderPreset(entry.provider);
      const runtime = runtimeByConfigIndex.get(index);
      const platform = runtime?.platform ?? this._platformOf(entry);
      const endpoint = entry.apiEndpoint || preset.defaultEndpoint;
      const readyForLoad = entry.enabled !== false && endpoint.length > 0 && (entry.apiKey.length > 0 || preset.allowEmptyApiKey === true);
      const error = this._runtime.errors.get(platform);
      const loaded = this._runtime.clients.has(platform);
      const models2 = this.ctx.chatluna.platform.listPlatformModels(
        platform,
        import_types12.ModelType.all
      ).value;
      return {
        id: preset.id,
        name: entry.name?.trim() || preset.name,
        icon: preset.icon,
        platform,
        endpoint,
        website: preset.website,
        enabled: entry.enabled !== false,
        configured: readyForLoad,
        pullModels: entry.pullModels === true,
        status: entry.enabled === false ? "disabled" : error ? "error" : loaded ? "loaded" : readyForLoad ? "configured" : "missing-key",
        modelCount: models2.length,
        error
      };
    });
    const models = this._runtime.providers.flatMap(
      (runtime) => this._modelsFor(runtime)
    );
    const presets = PROVIDER_PRESETS.map((preset) => ({
      id: preset.id,
      name: preset.name,
      icon: preset.icon,
      kind: preset.kind,
      adapter: preset.adapter,
      defaultPlatform: preset.defaultPlatform,
      defaultEndpoint: preset.defaultEndpoint,
      website: preset.website,
      allowEmptyApiKey: preset.allowEmptyApiKey === true,
      modelCount: 0
    }));
    return {
      iconCdn: this._options.config.iconCdn || DEFAULT_ICON_CDN,
      settingsPath: this._options.settingsPath,
      revision: this._runtime.revision,
      settings: toConsoleSettings(settings),
      providers,
      models,
      presets,
      totals: {
        configured: providers.filter((item) => item.configured).length,
        loaded: providers.filter((item) => item.status === "loaded").length,
        models: models.length,
        presets: presets.length
      },
      frontendMode: this._options.config.frontendMode || "performance"
    };
  }
  async saveSettings(settings) {
    const result = await this._options.saveSettings(settings);
    await this.refresh();
    return result;
  }
  async refreshProvider(platform) {
    try {
      await this._options.refreshMetadata();
      this._runtime.errors.delete("__metadata__");
    } catch (error) {
      this._runtime.errors.set("__metadata__", errorMessage(error));
      logger.warn(error);
    }
    const targets = platform ? [[platform, this._runtime.clients.get(platform)]] : [...this._runtime.clients.entries()];
    let models = 0;
    for (const [name2, client] of targets) {
      if (!client) continue;
      try {
        const refreshed = await client.reloadModels();
        this.ctx.chatluna.platform.unregisterClient(name2);
        client.registerSelf();
        await this.ctx.chatluna.platform.createClient(name2);
        this._runtime.errors.delete(name2);
        models += refreshed.length;
      } catch (error) {
        this._runtime.errors.set(name2, errorMessage(error));
        logger.warn(error);
      }
    }
    this._runtime.revision = Date.now();
    await this.refresh();
    return {
      success: this._runtime.errors.size === 0,
      models,
      errors: Object.fromEntries(this._runtime.errors)
    };
  }
  async geminiResource(platform, request) {
    const client = this._runtime.clients.get(platform);
    if (!client)
      throw new Error(
        "Gemini provider is not loaded; save settings first"
      );
    return client.geminiResource(request);
  }
  _modelsFor(runtime) {
    const settings = this._settings;
    const platformModels = this.ctx.chatluna.platform.listPlatformModels(
      runtime.platform,
      import_types12.ModelType.all
    ).value;
    const additional = settings.additionalModels.filter(
      (item) => targetMatches(item.target, runtime.platform, runtime.provider.id)
    );
    return platformModels.map((model) => {
      const custom = additional.some((item) => item.model === model.name);
      return {
        platform: runtime.platform,
        provider: runtime.provider.name,
        name: model.name,
        type: import_types12.ModelType[model.type],
        maxTokens: model.maxTokens,
        capabilities: model.capabilities,
        source: custom ? "custom" : "api"
      };
    });
  }
  _platformOf(entry) {
    const preset = getProviderPreset(entry.provider);
    return (entry.platform || preset.defaultPlatform).trim();
  }
};
function apply(ctx, config) {
  logger = (0, import_logger.createLogger)(ctx, "chatluna-model-hub-adapter");
  const koishiConfig = normalizeKoishiConfig(config);
  const settingsStore = new ModelHubSettingsStore(
    ctx,
    koishiConfig.settingsPath
  );
  const metadataStore = new ModelMetadataStore(ctx, {
    url: koishiConfig.metadataUrl,
    cachePath: koishiConfig.metadataCachePath,
    updateHours: koishiConfig.metadataUpdateHours,
    onStatus: /* @__PURE__ */ __name((error) => {
      if (error) runtime.errors.set("__metadata__", errorMessage(error));
      else runtime.errors.delete("__metadata__");
    }, "onStatus"),
    onUpdate: /* @__PURE__ */ __name(async () => {
      for (const [platform, client] of runtime.clients) {
        try {
          await client.reloadModels();
          ctx.chatluna.platform.unregisterClient(platform);
          client.registerSelf();
          await ctx.chatluna.platform.createClient(platform);
          runtime.errors.delete(platform);
        } catch (error) {
          runtime.errors.set(platform, errorMessage(error));
          logger.warn(error);
        }
      }
      runtime.revision = Date.now();
      await ctx.get("console.services.chatluna_model_hub")?.refresh();
    }, "onUpdate")
  });
  const runtime = {
    providers: [],
    clients: /* @__PURE__ */ new Map(),
    errors: /* @__PURE__ */ new Map(),
    plugins: /* @__PURE__ */ new Map(),
    revision: Date.now()
  };
  let settings = normalizeSettings({});
  const reloadRuntime = /* @__PURE__ */ __name(async () => {
    unregisterRuntime(ctx, runtime);
    runtime.providers = resolveRuntimeProviders(settings.providers);
    for (const provider of runtime.providers) {
      const providerConfig = createResolvedConfig(
        koishiConfig,
        settings,
        provider.entries[0]
      );
      const plugin = new import_chat.ChatLunaPlugin(ctx, providerConfig, provider.platform);
      plugin.parseConfig(
        () => provider.entries.map((entry) => ({
          ...entry,
          apiKey: entry.apiKey,
          apiEndpoint: entry.apiEndpoint,
          platform: provider.platform,
          provider: entry.provider,
          providerName: entry.providerName,
          icon: entry.icon,
          pullModels: entry.pullModels,
          chatLimit: entry.chatTimeLimit,
          timeout: entry.timeout,
          maxRetries: entry.maxRetries,
          concurrentMaxSize: entry.chatConcurrentMaxSize,
          difyApps: provider.provider.adapter === "dify" ? createDifyApps(provider.entries) : void 0
        }))
      );
      plugin.registerClient(() => {
        const client = new ModelHubClient(
          ctx,
          providerConfig,
          plugin,
          provider,
          metadataStore
        );
        runtime.clients.set(provider.platform, client);
        return client;
      });
      try {
        runtime.plugins.set(provider.platform, plugin);
        await plugin.initClient();
        runtime.errors.delete(provider.platform);
      } catch (error) {
        runtime.errors.set(provider.platform, errorMessage(error));
        ctx.chatluna.uninstallPlugin(provider.platform);
        ctx.chatluna.platform.unregisterClient(provider.platform);
        runtime.clients.delete(provider.platform);
        runtime.plugins.delete(provider.platform);
        logger.warn(error);
      }
    }
    runtime.revision = Date.now();
    return {
      success: runtime.errors.size === 0,
      errors: Object.fromEntries(runtime.errors)
    };
  }, "reloadRuntime");
  ctx.on("ready", async () => {
    try {
      await metadataStore.start();
    } catch (error) {
      runtime.errors.set("__metadata__", errorMessage(error));
      logger.warn(error);
    }
    try {
      settings = await settingsStore.load(config);
    } catch (error) {
      runtime.errors.set("__settings__", errorMessage(error));
      logger.warn(error);
    }
    await reloadRuntime();
    await ctx.get("console.services.chatluna_model_hub")?.refresh();
  });
  if (!koishiConfig.webui) return;
  ctx.inject(["console"], (ctx2) => {
    ctx2.plugin(ModelHubConsoleService, {
      config: koishiConfig,
      settingsPath: settingsStore.path,
      runtime,
      getSettings: /* @__PURE__ */ __name(() => settings, "getSettings"),
      refreshMetadata: /* @__PURE__ */ __name(() => metadataStore.refresh(), "refreshMetadata"),
      saveSettings: /* @__PURE__ */ __name(async (next) => {
        settings = normalizeSettings(next, settings);
        await settingsStore.save(settings);
        runtime.errors.delete("__settings__");
        return await reloadRuntime();
      }, "saveSettings")
    });
    ctx2.console.addListener(
      "chatluna-model-hub/getData",
      async () => ctx2.console.services.chatluna_model_hub.get()
    );
    ctx2.console.addListener(
      "chatluna-model-hub/saveSettings",
      async (settings2) => ctx2.console.services.chatluna_model_hub.saveSettings(settings2),
      { authority: 1 }
    );
    ctx2.console.addListener(
      "chatluna-model-hub/refresh",
      async (platform) => ctx2.console.services.chatluna_model_hub.refreshProvider(
        platform
      ),
      { authority: 1 }
    );
    ctx2.console.addListener(
      "chatluna-model-hub/geminiResource",
      async (platform, request) => ctx2.console.services.chatluna_model_hub.geminiResource(
        platform,
        request
      ),
      { authority: 4 }
    );
    ctx2.console.addEntry({
      dev: (0, import_path4.resolve)(__dirname, "../client/index.ts"),
      prod: (0, import_path4.resolve)(__dirname, "../dist")
    });
  });
}
__name(apply, "apply");
var Config = import_koishi.Schema.object({
  webui: import_koishi.Schema.boolean().default(true),
  frontendMode: import_koishi.Schema.union([
    import_koishi.Schema.const("performance").description("性能模式"),
    import_koishi.Schema.const("polished").description("精致模式")
  ]).role("radio").default("performance"),
  iconCdn: import_koishi.Schema.string().default(DEFAULT_ICON_CDN),
  settingsPath: import_koishi.Schema.string().default(DEFAULT_SETTINGS_PATH),
  metadataUrl: import_koishi.Schema.string().default("https://models.dev/api.json").description("模型元数据缓存源"),
  metadataCachePath: import_koishi.Schema.string().default("data/chatluna-model-hub/models.dev.models.json").description("模型元数据缓存文件"),
  metadataUpdateHours: import_koishi.Schema.number().default(24).min(1).max(168).description("元数据更新间隔（小时）")
}).i18n({
  "zh-CN": require_zh_CN_schema(),
  "en-US": require_en_US_schema()
});
var usage = `
## ChatLuna Model Hub Adapter

统一管理多个模型服务商。Koishi 配置页只保留 WebUI 入口；供应商、请求参数和密钥请在「Model Hub」WebUI 中配置。

OpenAI-compatible 服务商默认走 Chat Completions（/chat/completions）。OpenAI 本家可启用 Responses API，GPT-6 自动使用 Responses；xAI 可选择 Responses 并启用服务端工具。Gemini 默认 generateContent，可显式选择 stateless Interactions、Files 上传和缓存资源管理。

配置文件默认保存在 \`data/chatluna-model-hub/config.json\`。WebUI 不会把已保存的 API Key 明文回传到浏览器，留空密钥输入框会保留原值。
模型上下文大小和思考能力优先读取服务商 /models 返回值。未提供时，再用 models.dev 的本地缓存补全；可在配置页调整更新间隔。
`;
var inject = {
  required: ["chatluna"],
  optional: ["console", "chatluna_storage"]
};
var reusable = true;
var name = "chatluna-model-hub-adapter";
function normalizeKoishiConfig(config) {
  return {
    webui: config.webui !== false,
    frontendMode: config.frontendMode || "performance",
    iconCdn: config.iconCdn || DEFAULT_ICON_CDN,
    settingsPath: config.settingsPath || DEFAULT_SETTINGS_PATH,
    metadataUrl: config.metadataUrl || "https://models.dev/api.json",
    metadataCachePath: config.metadataCachePath || "data/chatluna-model-hub/models.dev.models.json",
    metadataUpdateHours: Math.max(1, config.metadataUpdateHours || 24)
  };
}
__name(normalizeKoishiConfig, "normalizeKoishiConfig");
function unregisterRuntime(ctx, runtime) {
  const platforms = /* @__PURE__ */ new Set([
    ...runtime.plugins.keys(),
    ...runtime.clients.keys(),
    ...runtime.providers.map((provider) => provider.platform)
  ]);
  for (const platform of platforms) {
    try {
      ctx.chatluna.uninstallPlugin(platform);
      ctx.chatluna.platform.unregisterClient(platform);
    } catch (error) {
      logger.warn(error);
    }
  }
  runtime.providers = [];
  runtime.clients.clear();
  runtime.plugins.clear();
  for (const key of runtime.errors.keys()) {
    if (key !== "__metadata__" && key !== "__settings__")
      runtime.errors.delete(key);
  }
}
__name(unregisterRuntime, "unregisterRuntime");
function createDifyApps(entries) {
  const seen = /* @__PURE__ */ new Map();
  return Object.fromEntries(
    entries.map((item) => {
      const baseModelName = item.difyModelName?.trim() || item.providerName || item.platform;
      const index = seen.get(baseModelName) ?? 0;
      seen.set(baseModelName, index + 1);
      const modelName = index === 0 ? baseModelName : `${baseModelName}-${index + 1}`;
      return [
        modelName,
        {
          apiKey: item.apiKey,
          apiEndpoint: item.apiEndpoint,
          platform: item.platform,
          providerName: item.providerName,
          modelName,
          appType: item.difyAppType ?? "chat",
          workflowId: item.difyWorkflowId?.trim() || void 0,
          outputVariable: item.difyOutputVariable?.trim() || void 0,
          enableFileUpload: item.difyEnableFileUpload !== false,
          contextSize: item.difyContextSize ?? 128e3
        }
      ];
    })
  );
}
__name(createDifyApps, "createDifyApps");
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
__name(errorMessage, "errorMessage");
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Config,
  ModelHubConsoleService,
  PROVIDER_PRESETS,
  apply,
  inject,
  logger,
  name,
  reusable,
  usage
});
