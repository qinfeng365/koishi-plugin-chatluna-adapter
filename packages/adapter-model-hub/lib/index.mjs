var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

// src/locales/zh-CN.schema.yml
var require_zh_CN_schema = __commonJS({
  "src/locales/zh-CN.schema.yml"(exports, module) {
    module.exports = { $inner: { webui: "启用独立 WebUI。供应商、模型、请求参数和密钥都在 WebUI 中管理。", frontendMode: "前端显示模式。性能模式保持低动效；精致模式启用更细腻的动效和高级样式。", iconCdn: "LobeHub 图标静态资源地址。", settingsPath: "WebUI 配置文件路径。相对路径会基于 Koishi 实例目录解析。", metadataUrl: "模型元数据缓存源。只用于补全上下文大小和能力，不作为可用模型列表。", metadataCachePath: "模型元数据本地缓存文件路径。相对路径会基于 Koishi 实例目录解析。", metadataUpdateHours: "模型元数据定时更新间隔，单位小时。" } };
  }
});

// src/locales/en-US.schema.yml
var require_en_US_schema = __commonJS({
  "src/locales/en-US.schema.yml"(exports, module) {
    module.exports = { $inner: { webui: "Enable the independent Web UI. Providers, models, request parameters, and secrets are managed there.", frontendMode: "Frontend display mode. Performance mode keeps low motion; Polished mode enables finer animation and advanced styles.", iconCdn: "LobeHub icon static asset base URL.", settingsPath: "Web UI settings file path. Relative paths are resolved from the Koishi instance directory.", metadataUrl: "Model metadata cache source. It only enriches context size and capabilities, not the available model list.", metadataCachePath: "Local model metadata cache file path. Relative paths are resolved from the Koishi instance directory.", metadataUpdateHours: "Model metadata refresh interval in hours." } };
  }
});

// src/index.ts
import { DataService } from "@koishijs/plugin-console";
import { resolve as resolve3 } from "path";
import { Schema } from "koishi";
import { ChatLunaPlugin } from "koishi-plugin-chatluna/services/chat";
import { ModelType as ModelType3 } from "koishi-plugin-chatluna/llm-core/platform/types";
import { createLogger } from "koishi-plugin-chatluna/utils/logger";

// src/client.ts
import { PlatformModelEmbeddingsAndRerankerClient } from "koishi-plugin-chatluna/llm-core/platform/client";
import {
  ChatLunaChatModel,
  ChatLunaEmbeddings
} from "koishi-plugin-chatluna/llm-core/platform/model";
import { ChatLunaReranker } from "koishi-plugin-chatluna/llm-core/platform/rerank";
import {
  ModelCapabilities as ModelCapabilities2,
  ModelType as ModelType2
} from "koishi-plugin-chatluna/llm-core/platform/types";
import {
  ChatLunaError,
  ChatLunaErrorCode
} from "koishi-plugin-chatluna/utils/error";
import {
  getModelMaxContextSize,
  getOpenAIFileHandlingConfig,
  isEmbeddingModel,
  isImageGenerationModel,
  isNonLLMModel,
  isRerankerModel,
  supportAudioInput,
  supportImageInput
} from "@chatluna/v1-shared-adapter";

// src/requester.ts
import {
  ModelRequester
} from "koishi-plugin-chatluna/llm-core/platform/api";
import { createRequestContext } from "@chatluna/v1-shared-adapter";

// src/providers/helpers.ts
import {
  ModelCapabilities,
  ModelType
} from "koishi-plugin-chatluna/llm-core/platform/types";
var DEFAULT_ICON_CDN = "https://cdn.jsdelivr.net/npm/@lobehub/icons-static-svg@latest/icons";
var tool = ModelCapabilities.ToolCall;
var image = ModelCapabilities.ImageInput;
var audio = ModelCapabilities.AudioInput;
var thinking = ModelCapabilities.Thinking;
var video = ModelCapabilities.VideoInput;
var file = ModelCapabilities.FileInput;
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

// src/providers/openai-compatible.ts
var openai_compatible_default = openAIChatProvider({
  id: "openai-compatible",
  name: "自定义 OpenAI-compatible",
  icon: "openai",
  kind: "cloud",
  defaultPlatform: "hub-openai-compatible",
  defaultEndpoint: "https://api.example.com/v1",
  website: "",
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
  models: [],
  patchCompletionBody(body, model) {
    const lower = model.toLowerCase();
    if (!lower.includes("reasoner") && !lower.includes("r1")) return;
    delete body.temperature;
    delete body.presence_penalty;
    delete body.frequency_penalty;
    delete body.top_p;
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
  defaultEndpoint: "https://api.together.xyz/v1",
  website: "https://api.together.xyz",
  models: []
});

// src/providers/xai.ts
var xai_default = openAIChatProvider({
  id: "xai",
  name: "xAI",
  icon: "xai",
  kind: "cloud",
  defaultPlatform: "hub-xai",
  defaultEndpoint: "https://api.x.ai/v1",
  website: "https://console.x.ai",
  models: []
});

// src/providers/minimax.ts
var minimax_default = openAIChatProvider({
  id: "minimax",
  name: "MiniMax",
  icon: "minimax",
  kind: "cloud",
  defaultPlatform: "hub-minimax",
  defaultEndpoint: "https://api.minimaxi.com/v1",
  website: "https://platform.minimaxi.com",
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
  icon: "llamacpp",
  kind: "local",
  defaultPlatform: "hub-llamacpp",
  defaultEndpoint: "http://127.0.0.1:8080/v1",
  website: "https://github.com/ggerganov/llama.cpp",
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
  icon: "localai",
  kind: "local",
  defaultPlatform: "hub-localai",
  defaultEndpoint: "http://127.0.0.1:8080/v1",
  website: "https://localai.io",
  allowEmptyApiKey: true,
  models: []
});

// src/providers/index.ts
var PROVIDER_PRESETS = [
  openai_compatible_default,
  openai_default,
  gemini_default,
  openrouter_default,
  deepseek_default,
  qwen_default,
  zhipu_default,
  moonshot_default,
  siliconflow_default,
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
    nonStreaming: false
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
  for (const entry of entries ?? []) {
    const preset = getProviderPreset(entry.provider);
    const platform = normalizePlatformName(entry.platform, preset.defaultPlatform);
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
      enabled: true,
      pullModels: entry.pullModels === true
    });
  }
  return [...groups.values()];
}
__name(resolveRuntimeProviders, "resolveRuntimeProviders");
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
import { ChatGenerationChunk } from "@langchain/core/outputs";
import {
  completion,
  completionStream,
  createEmbeddings,
  createRerank
} from "@chatluna/v1-shared-adapter";
import { checkResponse } from "koishi-plugin-chatluna/utils/sse";

// src/adapters/model-list.ts
import { expandReasoningEffortModelVariants } from "@chatluna/v1-shared-adapter";
function parseOpenAIModels(payload) {
  const items = Array.isArray(payload.data) ? payload.data ?? [] : [];
  const result = [];
  const seen = /* @__PURE__ */ new Set();
  for (const item of items) {
    const id = item.id?.trim();
    if (!id) continue;
    const base = makeOpenAIEntry(id, item);
    pushUnique(result, seen, base);
    for (const variant of expandReasoningEffortModelVariants(id)) {
      pushUnique(result, seen, {
        name: variant,
        maxTokens: base.maxTokens,
        capabilities: base.capabilities
      });
    }
  }
  return result;
}
__name(parseOpenAIModels, "parseOpenAIModels");
function parseGeminiModels(payload) {
  const items = Array.isArray(payload.models) ? payload.models ?? [] : [];
  return items.map((item) => {
    const name2 = item.name?.replace(/^models\//, "").trim();
    if (!name2) return void 0;
    return {
      name: name2,
      maxTokens: item.inputTokenLimit ?? item.metadata?.inputTokenLimit ?? item.outputTokenLimit ?? item.metadata?.outputTokenLimit
    };
  }).filter(Boolean);
}
__name(parseGeminiModels, "parseGeminiModels");
function makeOpenAIEntry(id, item) {
  return {
    name: id,
    maxTokens: item.context_length ?? item.max_context_length ?? item.input_token_limit ?? item.limit?.context ?? item.limit?.input ?? item.token_limit
  };
}
__name(makeOpenAIEntry, "makeOpenAIEntry");
function pushUnique(result, seen, entry) {
  const key = entry.name.toLowerCase();
  if (seen.has(key)) return;
  seen.add(key);
  result.push(entry);
}
__name(pushUnique, "pushUnique");

// src/adapters/openai-chat.ts
var openAIChatAdapter = {
  id: "openai-chat",
  async completion(requester, params) {
    if (!requester.currentConfig().nonStreaming) {
      return requester.defaultCompletion(params);
    }
    return completion(requester.requestContext(), params, "chat/completions");
  },
  async *completionStream(requester, params) {
    if (!requester.currentConfig().nonStreaming) {
      yield* requester.defaultCompletionStream(params);
      return;
    }
    const generation = await this.completion(requester, params);
    yield new ChatGenerationChunk({
      generationInfo: generation.generationInfo,
      message: generation.message,
      text: generation.text
    });
  },
  async *completionStreamInternal(requester, params) {
    yield* completionStream(
      requester.requestContext(),
      params,
      "chat/completions"
    );
  },
  async embeddings(requester, params) {
    return await createEmbeddings(requester.requestContext(), params);
  },
  async rerank(requester, params) {
    return await createRerank(requester.requestContext(), params);
  },
  async getModels(requester, config) {
    const response = await requester.get("models", {}, { signal: config?.signal });
    await checkResponse(response);
    return parseOpenAIModels(JSON.parse(await response.text()));
  }
};

// src/adapters/openai.ts
import { ChatGenerationChunk as ChatGenerationChunk2 } from "@langchain/core/outputs";
import {
  completion as completion2,
  completionStream as completionStream2,
  createEmbeddings as createEmbeddings2,
  createRerank as createRerank2,
  responseApiCompletion,
  responseApiCompletionStream
} from "@chatluna/v1-shared-adapter";
import { checkResponse as checkResponse2 } from "koishi-plugin-chatluna/utils/sse";
var openAIAdapter = {
  id: "openai",
  async completion(requester, params) {
    const current = requester.currentConfig();
    if (!current.nonStreaming && !current.responseApi) {
      return requester.defaultCompletion(params);
    }
    const requestContext = requester.requestContext();
    if (current.responseApi) {
      return await responseApiCompletion(
        requestContext,
        params,
        {
          builtinTools: requester.responseBuiltinTools(params)
        },
        true,
        requester.responseImageProvider()
      );
    }
    return await completion2(requestContext, params, "chat/completions");
  },
  async *completionStream(requester, params) {
    const current = requester.currentConfig();
    if (!current.nonStreaming) {
      yield* requester.defaultCompletionStream(params);
      return;
    }
    const generation = await this.completion(requester, params);
    yield new ChatGenerationChunk2({
      generationInfo: generation.generationInfo,
      message: generation.message,
      text: generation.text
    });
  },
  async *completionStreamInternal(requester, params) {
    const current = requester.currentConfig();
    const requestContext = requester.requestContext();
    if (current.responseApi) {
      yield* responseApiCompletionStream(
        requestContext,
        params,
        {
          builtinTools: requester.responseBuiltinTools(params)
        },
        true,
        requester.responseImageProvider()
      );
      return;
    }
    yield* completionStream2(requestContext, params, "chat/completions");
  },
  async embeddings(requester, params) {
    const requestContext = requester.requestContext();
    return await createEmbeddings2(requestContext, params);
  },
  async rerank(requester, params) {
    const requestContext = requester.requestContext();
    return await createRerank2(requestContext, params);
  },
  async getModels(requester, config) {
    const response = await requester.get("models", {}, { signal: config?.signal });
    await checkResponse2(response);
    return parseOpenAIModels(JSON.parse(await response.text()));
  }
};

// src/adapters/gemini.ts
import {
  AIMessageChunk
} from "@langchain/core/messages";
import { ChatGenerationChunk as ChatGenerationChunk3 } from "@langchain/core/outputs";
import { isZodSchemaV3 } from "@langchain/core/utils/types";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  createUsageMetadata,
  fetchFileLikeUrl,
  fetchImageUrl,
  removeAdditionalProperties
} from "@chatluna/v1-shared-adapter";
import { checkResponse as checkResponse3, sseIterable } from "koishi-plugin-chatluna/utils/sse";
import {
  getMessageContent,
  isMessageContentImageUrl,
  isMessageContentText
} from "koishi-plugin-chatluna/utils/string";
var geminiAdapter = {
  id: "gemini",
  async completion(requester, params) {
    if (!requester.currentConfig().nonStreaming) {
      return requester.defaultCompletion(params);
    }
    const generation = await geminiCompletion(requester, params);
    return generation;
  },
  async *completionStream(requester, params) {
    if (!requester.currentConfig().nonStreaming) {
      yield* requester.defaultCompletionStream(params);
      return;
    }
    const generation = await this.completion(requester, params);
    yield new ChatGenerationChunk3({
      generationInfo: generation.generationInfo,
      message: generation.message,
      text: generation.text
    });
  },
  async *completionStreamInternal(requester, params) {
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
    await checkResponse3(response);
    const data = JSON.parse(await response.text());
    return data.embeddings?.map((item) => item.values) ?? [];
  },
  async rerank() {
    return [];
  },
  async getModels(requester, config) {
    const response = await requester.get("models", {}, { signal: config?.signal });
    await checkResponse3(response);
    return parseGeminiModels(JSON.parse(await response.text()));
  }
};
async function geminiCompletion(requester, params) {
  const toolNameMapper = createGeminiToolNameMapper(params.tools ?? []);
  const request = await createGeminiRequest(requester, params, toolNameMapper);
  const response = await requester.post(
    `models/${prepareGeminiModel(params.model, requester)}:generateContent`,
    request,
    { signal: params.signal }
  );
  await checkResponse3(response);
  return await parseGeminiResponse(
    await response.text(),
    requester,
    toolNameMapper
  );
}
__name(geminiCompletion, "geminiCompletion");
async function* geminiCompletionStream(requester, params) {
  const toolNameMapper = createGeminiToolNameMapper(params.tools ?? []);
  const request = await createGeminiRequest(requester, params, toolNameMapper);
  const response = await requester.post(
    `models/${prepareGeminiModel(params.model, requester)}:streamGenerateContent?alt=sse`,
    request,
    { signal: params.signal }
  );
  await checkResponse3(response);
  let pending = new ChatGenerationChunk3({
    message: new AIMessageChunk(""),
    text: ""
  });
  for await (const event of sseIterable(response)) {
    if (!event.data || event.data === "[DONE]") continue;
    const chunk = await parseGeminiResponse(
      event.data,
      requester,
      toolNameMapper
    );
    pending = pending.concat(chunk);
    yield chunk;
  }
}
__name(geminiCompletionStream, "geminiCompletionStream");
async function createGeminiRequest(requester, params, toolNameMapper) {
  const messageContents = await messagesToGeminiContents(
    requester,
    params.input,
    toolNameMapper
  );
  const current = requester.currentConfig();
  const tools = geminiTools(
    requester,
    params.tools ?? [],
    params.model,
    toolNameMapper
  );
  const generationConfig = filterEmpty({
    temperature: params.temperature,
    topP: params.topP,
    maxOutputTokens: params.maxTokens,
    stopSequences: params.stop,
    responseModalities: current.imageGeneration ? ["TEXT", "IMAGE"] : void 0,
    thinkingConfig: current.includeThoughts || current.thinkingBudget != null ? filterEmpty({
      thinkingBudget: current.thinkingBudget ?? -1,
      includeThoughts: current.includeThoughts === true
    }) : void 0
  });
  return filterEmpty({
    ...messageContents,
    generationConfig,
    safetySettings: createSafetySettings(),
    tools,
    toolConfig: tools?.some(
      (tool2) => tool2.google_search != null || tool2.code_execution != null || tool2.urlContext != null
    ) && params.model?.includes("gemini-3") ? { includeServerSideToolInvocations: true } : void 0
  });
}
__name(createGeminiRequest, "createGeminiRequest");
async function messagesToGeminiContents(requester, messages, toolNameMapper) {
  const result = [];
  const systemParts = [];
  for (const message of messages) {
    const type = message.getType();
    if (type === "system") {
      systemParts.push(...await contentToParts(requester, message.content));
      continue;
    }
    if (type === "tool") {
      const tool2 = message;
      result.push({
        role: "user",
        parts: [
          {
            functionResponse: {
              name: toolNameMapper.sanitize(tool2.name),
              response: parseToolResponse(tool2.content),
              id: tool2.tool_call_id
            }
          }
        ]
      });
      continue;
    }
    const ai = message;
    if (ai.tool_calls?.length) {
      result.push({
        role: "model",
        parts: ai.tool_calls.map((toolCall) => ({
          functionCall: {
            name: toolNameMapper.sanitize(toolCall.name),
            args: toolCall.args,
            id: toolCall.id
          }
        }))
      });
      continue;
    }
    result.push({
      role: type === "ai" ? "model" : "user",
      parts: await contentToParts(requester, message.content)
    });
  }
  return filterEmpty({
    contents: result,
    systemInstruction: systemParts.length > 0 ? { parts: systemParts } : void 0
  });
}
__name(messagesToGeminiContents, "messagesToGeminiContents");
async function contentToParts(requester, content) {
  if (typeof content === "string") return [{ text: content }];
  const parts = await Promise.all(
    content.map(async (part) => {
      if (isMessageContentText(part)) return { text: part.text };
      if (isMessageContentImageUrl(part)) {
        const url = await fetchImageUrl(requester.requestContext().plugin, part);
        const mimeType = url.match(/^data:([^;]+);base64,/)?.[1] ?? "image/jpeg";
        return {
          inline_data: {
            mime_type: mimeType,
            data: url.replace(/^data:[^;]+;base64,/, "")
          }
        };
      }
      if (isFileLikePart(part)) {
        const file2 = await fetchFileLikeUrl(
          requester.requestContext().plugin,
          part
        );
        return {
          inline_data: {
            mime_type: file2.mimeType,
            data: file2.buffer.toString("base64")
          }
        };
      }
      return part;
    })
  );
  return parts.filter(Boolean);
}
__name(contentToParts, "contentToParts");
function geminiTools(requester, tools, model, toolNameMapper) {
  const result = [];
  const functionDeclarations = tools.map((tool2) => ({
    name: toolNameMapper.sanitize(tool2.name),
    description: tool2.description,
    parameters: removeAdditionalProperties(
      isZodSchemaV3(tool2.schema) ? zodToJsonSchema(tool2.schema) : tool2.schema
    )
  }));
  const builtinTools = geminiBuiltinTools(requester, model);
  if (functionDeclarations.length > 0) {
    result.push({ functionDeclarations });
  }
  result.push(...builtinTools);
  return result.length > 0 ? result : void 0;
}
__name(geminiTools, "geminiTools");
function geminiBuiltinTools(requester, model) {
  const config = requester.currentConfig();
  const lower = model.toLowerCase();
  const unsupported = lower.includes("gemini-2.0-flash-lite") || lower.includes("gemini-2.0-flash-exp");
  if (unsupported) return [];
  const result = [];
  if (config.googleSearch) result.push({ google_search: {} });
  if (config.codeExecution) result.push({ code_execution: {} });
  if (config.urlContext) result.push({ urlContext: {} });
  return result;
}
__name(geminiBuiltinTools, "geminiBuiltinTools");
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
      if (sanitizeMap.has(original)) return sanitizeMap.get(original) ?? original;
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
  let unique = result;
  let index = 2;
  while (used.has(unique)) {
    const suffix = `_${index++}`;
    unique = `${result.slice(0, Math.max(1, 128 - suffix.length))}${suffix}`;
  }
  used.add(unique);
  return unique;
}
__name(sanitizeGeminiToolName, "sanitizeGeminiToolName");
async function parseGeminiResponse(text, requester, toolNameMapper) {
  const data = JSON.parse(text);
  const usage2 = data.usageMetadata ? createUsageMetadata({
    inputTokens: data.usageMetadata.promptTokenCount,
    outputTokens: data.usageMetadata.candidatesTokenCount ?? data.candidates?.[0]?.tokenCount,
    totalTokens: data.usageMetadata.totalTokenCount,
    cacheReadTokens: data.usageMetadata.cachedContentTokenCount,
    reasoningTokens: data.usageMetadata.thoughtsTokenCount
  }) : void 0;
  let content = "";
  let reasoning = "";
  const toolCalls = [];
  const images = [];
  for (const candidate of data.candidates ?? []) {
    for (const part of candidate.content?.parts ?? []) {
      if (part.text && part.thought) {
        reasoning += part.text;
      } else if (part.text) {
        content += part.text;
      } else if (part.functionCall) {
        toolCalls.push({
          name: toolNameMapper.restore(part.functionCall.name),
          args: part.functionCall.args,
          id: part.functionCall.id
        });
      } else if (part.inlineData?.data || part.inline_data?.data) {
        const inline = part.inlineData ?? part.inline_data;
        const mime = inline.mimeType ?? inline.mime_type ?? "image/png";
        images.push(`data:${mime};base64,${inline.data}`);
      }
    }
    if (requester.currentConfig().groundingContentDisplay) {
      const grounding = formatGrounding(candidate.groundingMetadata);
      if (grounding) content += `
${grounding}`;
    }
  }
  const message = new AIMessageChunk({
    content: images.length > 0 ? [{ type: "text", text: content }] : content,
    tool_call_chunks: toolCalls.map((toolCall, index) => ({
      name: toolCall.name,
      args: JSON.stringify(toolCall.args ?? {}),
      id: toolCall.id ?? `function_call_${index}`,
      index
    })),
    usage_metadata: usage2,
    additional_kwargs: {
      images: images.length > 0 ? images : void 0,
      reasoning_content: reasoning || void 0
    }
  });
  return new ChatGenerationChunk3({
    generationInfo: usage2 ? { usage_metadata: usage2 } : void 0,
    message,
    text: getMessageContent(message.content) ?? content
  });
}
__name(parseGeminiResponse, "parseGeminiResponse");
function prepareGeminiModel(model, requester) {
  let result = model;
  if (requester.currentConfig().googleSearch && result.endsWith("-search")) {
    result = result.slice(0, -"-search".length);
  }
  return result.replace(/^models\//, "");
}
__name(prepareGeminiModel, "prepareGeminiModel");
function parseToolResponse(value) {
  try {
    return JSON.parse(value);
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

// src/adapters/registry.ts
var adapters = /* @__PURE__ */ new Map([
  [openAIChatAdapter.id, openAIChatAdapter],
  [openAIAdapter.id, openAIAdapter],
  [geminiAdapter.id, geminiAdapter]
]);
function getProviderAdapter(id) {
  return adapters.get(id) ?? openAIChatAdapter;
}
__name(getProviderAdapter, "getProviderAdapter");

// src/requester.ts
var ModelHubRequester = class extends ModelRequester {
  static {
    __name(this, "ModelHubRequester");
  }
  constructor(ctx, configPool, pluginConfig, plugin) {
    super(ctx, configPool, pluginConfig, plugin);
  }
  async completion(params) {
    return await this._adapter().completion(this, params);
  }
  async *completionStream(params) {
    yield* this._adapter().completionStream(this, params);
  }
  async *completionStreamInternal(params) {
    yield* this._adapter().completionStreamInternal(this, params);
  }
  async embeddings(params) {
    return await this._adapter().embeddings(this, params);
  }
  async rerank(params) {
    return await this._adapter().rerank(this, params);
  }
  async getModels(config) {
    return await this._adapter().getModels(this, config);
  }
  buildHeaders() {
    const current = this._config.value;
    const preset = getProviderPreset(current.provider);
    const result = {
      "Content-Type": "application/json",
      "HTTP-Referer": "https://github.com/ChatLunaLab/chatluna",
      "X-Title": "ChatLuna"
    };
    if (preset.adapter !== "gemini" && current.apiKey.length > 0) {
      result.Authorization = `Bearer ${current.apiKey}`;
    }
    for (const header of this._pluginConfig.customHeaders ?? []) {
      const name2 = header.name?.trim();
      if (!name2) continue;
      if (!targetMatches(header.target, current.platform, current.provider))
        continue;
      result[name2] = header.value;
    }
    return result;
  }
  async post(url, body, options) {
    if (url === "chat/completions") {
      const current = this._config.value;
      getProviderPreset(current.provider).patchCompletionBody?.(
        body,
        String(body.model ?? "")
      );
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
    return createRequestContext(
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
  responseBuiltinTools(params) {
    const current = this._config.value;
    if (!current.responseApi) return [];
    if (!current.responseBuiltinToolSupportModel?.includes(params.model ?? "")) {
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
        result.push({ type, container: { type: "auto" } });
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
  defaultCompletion(params) {
    return super.completion(params);
  }
  defaultCompletionStream(params) {
    return super.completionStream(params);
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
};

// src/client.ts
var ModelHubClient = class extends PlatformModelEmbeddingsAndRerankerClient {
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
      const rawModels = current?.pullModels === true ? await this._requester.getModels(config) : [];
      const apiModels = rawModels.filter(
        (model) => !isNonLLMModel(model.name) || isImageGenerationModel(model.name)
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
      return this._dedupeModels([
        ...apiModels,
        ...additionalModels
      ]).filter((model) => {
        const id = model.name.toLowerCase();
        return !blacklist.some((keyword) => id.includes(keyword));
      });
    } catch (e) {
      if (e instanceof ChatLunaError) {
        throw e;
      }
      throw new ChatLunaError(ChatLunaErrorCode.MODEL_INIT_ERROR, e);
    }
  }
  async reloadModels(config) {
    this._modelInfos = {};
    return await this.getModels(config);
  }
  _createModel(model, report) {
    const info = this._modelInfos[model];
    if (info == null) {
      logger.warn(
        `Model ${model} not found`,
        JSON.stringify(this._modelInfos)
      );
      throw new ChatLunaError(
        ChatLunaErrorCode.MODEL_NOT_FOUND,
        new Error(
          `The model ${model} is not found in ${this.platform}`
        )
      );
    }
    if (info.type === ModelType2.llm) {
      const modelMaxContextSize = getModelMaxContextSize(info);
      return new ChatLunaChatModel({
        usageReporter: report,
        modelInfo: info,
        requester: this._requester,
        model,
        maxTokenLimit: Math.floor(
          (info.maxTokens || modelMaxContextSize || 128e3) * this._config.maxContextRatio
        ),
        modelMaxContextSize,
        frequencyPenalty: this._config.frequencyPenalty,
        presencePenalty: this._config.presencePenalty,
        timeout: this._config.timeout,
        temperature: this._config.temperature,
        maxRetries: this._config.maxRetries,
        llmType: this._runtime.provider.id,
        fileHandlingConfig: getOpenAIFileHandlingConfig(model),
        isThinkModel: this._isThinkModel(model, info)
      });
    }
    if (info.type === ModelType2.reranker) {
      return new ChatLunaReranker({
        usageReporter: report,
        client: this._requester,
        model,
        maxRetries: this._config.maxRetries,
        timeout: this._config.timeout
      });
    }
    return new ChatLunaEmbeddings({
      usageReporter: report,
      client: this._requester,
      model,
      maxRetries: this._config.maxRetries
    });
  }
  _inferModelInfo(model) {
    const name2 = model.name;
    const lower = name2.toLowerCase();
    const type = isRerankerModel(lower) ? ModelType2.reranker : isEmbeddingModel(lower) ? ModelType2.embeddings : ModelType2.llm;
    if (isImageGenerationModel(lower)) {
      return {
        name: name2,
        type: ModelType2.llm,
        maxTokens: model.maxTokens ?? 4096,
        capabilities: [ModelCapabilities2.ImageGeneration]
      };
    }
    const info = {
      name: name2,
      type,
      maxTokens: model.maxTokens ?? this._metadata.getMaxTokens(this._runtime.provider.id, name2) ?? 0,
      capabilities: type === ModelType2.llm ? [
        ModelCapabilities2.ToolCall,
        supportImageInput(name2) ? ModelCapabilities2.ImageInput : null,
        supportAudioInput(name2) ? ModelCapabilities2.AudioInput : null
      ].filter(Boolean) : []
    };
    info.maxTokens = type === ModelType2.llm ? info.maxTokens || getModelMaxContextSize(info) : info.maxTokens || 8192;
    return info;
  }
  _additionalModelInfo(model) {
    const type = model.modelType === "embeddings" || model.modelType === "Embeddings 嵌入模型" ? ModelType2.embeddings : model.modelType === "reranker" || model.modelType === "Reranker 重排序模型" ? ModelType2.reranker : ModelType2.llm;
    return {
      name: model.model,
      type,
      maxTokens: model.contextSize ?? 4096,
      capabilities: type === ModelType2.llm ? model.modelCapabilities : model.modelCapabilities.filter(
        (cap) => cap !== ModelCapabilities2.ToolCall
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
  _isThinkModel(model, info) {
    const lower = model.toLowerCase();
    return info.capabilities.includes(ModelCapabilities2.Thinking) || lower.includes("reasoner") || lower.includes("thinking") || lower.includes("reasoning") || lower.includes("r1") || lower.startsWith("o1") || lower.startsWith("o3") || lower.startsWith("o4") || lower.startsWith("gpt-5");
  }
};

// src/metadata.ts
import { mkdir, readFile, writeFile } from "fs/promises";
import { dirname, resolve } from "path";
import { ModelCapabilities as ModelCapabilities3 } from "koishi-plugin-chatluna/llm-core/platform/types";
var ModelMetadataStore = class {
  constructor(ctx, options = {}) {
    this.ctx = ctx;
    this.options = options;
    this.path = resolve(
      ctx.baseDir,
      options.cachePath || "data/chatluna-model-hub/models.dev.catalog.json"
    );
  }
  static {
    __name(this, "ModelMetadataStore");
  }
  _models = /* @__PURE__ */ new Map();
  _timer;
  path;
  async start() {
    await this.load();
    await this.refresh();
    const interval = Math.max(1, this.options.updateHours ?? 24) * 60 * 60 * 1e3;
    this._timer = setInterval(() => {
      this.refresh().catch((error) => this.ctx.logger("chatluna-model-hub-adapter").warn(error));
    }, interval);
    this.ctx.on("dispose", () => {
      if (this._timer) clearInterval(this._timer);
    });
  }
  async load() {
    try {
      const raw = await readFile(this.path, "utf8");
      this.apply(JSON.parse(raw));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  async refresh() {
    const response = await fetch(
      this.options.url || "https://models.dev/catalog.json"
    );
    if (!response.ok) {
      throw new Error(`Failed to download models.dev catalog: ${response.status}`);
    }
    const catalog = await response.json();
    this.apply(catalog);
    await mkdir(dirname(this.path), { recursive: true });
    await writeFile(this.path, `${JSON.stringify(catalog)}
`, "utf8");
  }
  enhance(provider, model) {
    const metadata = this.find(provider, model.name);
    if (!metadata) return model;
    return {
      ...model,
      maxTokens: model.maxTokens ?? metadata.limit?.context ?? metadata.limit?.input,
      capabilities: model.capabilities ?? capabilitiesFromMetadata(metadata)
    };
  }
  getMaxTokens(provider, model) {
    const metadata = this.find(provider, model);
    return metadata?.limit?.context ?? metadata?.limit?.input;
  }
  apply(catalog) {
    this._models.clear();
    for (const [id, model] of Object.entries(catalog.models ?? {})) {
      this._models.set(normalizeModelId(id), model);
      if (model.id) this._models.set(normalizeModelId(model.id), model);
    }
  }
  find(provider, model) {
    const exact = this._models.get(normalizeModelId(model));
    if (exact) return exact;
    for (const prefix of providerPrefixes(provider)) {
      const prefixed = this._models.get(normalizeModelId(`${prefix}/${model}`));
      if (prefixed) return prefixed;
    }
  }
};
function normalizeModelId(value) {
  return value.trim().toLowerCase();
}
__name(normalizeModelId, "normalizeModelId");
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
    groq: ["groq"],
    together: ["togetherai", "together"],
    openrouter: []
  };
  return map[provider] ?? [provider];
}
__name(providerPrefixes, "providerPrefixes");
function capabilitiesFromMetadata(model) {
  const capabilities = [];
  const input = new Set(model.modalities?.input ?? []);
  const output = new Set(model.modalities?.output ?? []);
  if (model.tool_call) capabilities.push(ModelCapabilities3.ToolCall);
  if (model.reasoning) capabilities.push(ModelCapabilities3.Thinking);
  if (input.has("image")) capabilities.push(ModelCapabilities3.ImageInput);
  if (input.has("audio")) capabilities.push(ModelCapabilities3.AudioInput);
  if (input.has("video")) capabilities.push(ModelCapabilities3.VideoInput);
  if (input.has("pdf")) capabilities.push(ModelCapabilities3.FileInput);
  if (output.has("image")) capabilities.push(ModelCapabilities3.ImageGeneration);
  return capabilities;
}
__name(capabilitiesFromMetadata, "capabilitiesFromMetadata");

// src/settings.ts
import { mkdir as mkdir2, readFile as readFile2, writeFile as writeFile2 } from "fs/promises";
import { dirname as dirname2, isAbsolute, resolve as resolve2 } from "path";
import { ModelCapabilities as ModelCapabilities4 } from "koishi-plugin-chatluna/llm-core/platform/types";
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
  nonStreaming: false
};
var DEFAULT_RESPONSE_BUILTIN_TOOL_SUPPORT_MODELS = [
  "gpt-4o",
  "gpt-4.1",
  "gpt-5",
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
      const raw = await readFile2(this.path, "utf8");
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
    await mkdir2(dirname2(this.path), { recursive: true });
    await writeFile2(
      this.path,
      `${JSON.stringify(normalizeSettings(settings), null, 2)}
`,
      "utf8"
    );
  }
};
function resolveSettingsPath(ctx, settingsPath) {
  const value = (settingsPath || DEFAULT_SETTINGS_PATH).trim();
  return isAbsolute(value) ? value : resolve2(ctx.baseDir, value);
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
  const value = isRecord(input) ? input : {};
  const legacyAdvanced = normalizeProviderAdvanced(value);
  return {
    providers: arrayOf(value.providers).map(
      (entry) => normalizeProvider(entry, previous, legacyAdvanced)
    ),
    additionalModels: arrayOf(value.additionalModels).map(
      normalizeAdditionalModel
    ),
    blacklistModels: arrayOf(value.blacklistModels).map(normalizeFilter)
  };
}
__name(normalizeSettings, "normalizeSettings");
function normalizeProviderAdvanced(input, previous, fallback = DEFAULT_PROVIDER_ADVANCED_SETTINGS) {
  const value = isRecord(input) ? input : {};
  const merged = {
    ...fallback,
    ...previous,
    ...value
  };
  const headerSource = value.customHeaders === void 0 ? previous?.customHeaders ?? fallback.customHeaders : value.customHeaders;
  return {
    customHeaders: arrayOf(headerSource).map(
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
    nonStreaming: merged.nonStreaming === true
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
  const value = isRecord(input) ? input : {};
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
    providerAdvanced.customHeaders = providerAdvanced.customHeaders.filter((header) => targetMatches(header.target, platform, preset.id)).map((header) => ({ ...header, target: "*" }));
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
function normalizeProviderSpecific(input, previous, provider) {
  if (provider === "openai") {
    return {
      responseApi: booleanOrUndefined(input.responseApi) ?? previous?.responseApi ?? false,
      responseBuiltinTools: arrayOf(
        input.responseBuiltinTools ?? previous?.responseBuiltinTools ?? []
      ).filter(isResponseBuiltinTool),
      responseBuiltinToolSupportModel: stringArrayOf(
        input.responseBuiltinToolSupportModel ?? previous?.responseBuiltinToolSupportModel,
        DEFAULT_RESPONSE_BUILTIN_TOOL_SUPPORT_MODELS
      ),
      responseFileSearchVectorStoreIds: stringArrayOf(
        input.responseFileSearchVectorStoreIds ?? previous?.responseFileSearchVectorStoreIds,
        []
      )
    };
  }
  if (provider === "gemini") {
    return {
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
  return {};
}
__name(normalizeProviderSpecific, "normalizeProviderSpecific");
function normalizeAdditionalModel(input) {
  const value = isRecord(input) ? input : {};
  const capabilities = new Set(Object.values(ModelCapabilities4));
  return {
    target: stringOf(value.target, "*"),
    model: stringOf(value.model).trim(),
    modelType: stringOf(value.modelType, "LLM 大语言模型"),
    modelCapabilities: stringArrayOf(value.modelCapabilities, [
      ModelCapabilities4.TextInput,
      ModelCapabilities4.ToolCall
    ]).filter(
      (item) => capabilities.has(item)
    ),
    contextSize: clampNumber(value.contextSize, 128e3, 1)
  };
}
__name(normalizeAdditionalModel, "normalizeAdditionalModel");
function normalizeFilter(input) {
  const value = isRecord(input) ? input : {};
  return {
    target: stringOf(value.target, "*"),
    keyword: stringOf(value.keyword).trim()
  };
}
__name(normalizeFilter, "normalizeFilter");
function normalizeHeader(input, previous) {
  const value = isRecord(input) ? input : {};
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
  if (!isRecord(input)) return null;
  const result = {};
  const providers = arrayOf(input.providers).filter(isMeaningfulLegacyProvider);
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
    "nonStreaming"
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
  return value === "web_search_preview" || value === "image_generation" || value === "code_interpreter" || value === "file_search";
}
__name(isResponseBuiltinTool, "isResponseBuiltinTool");
function booleanOrUndefined(value) {
  return typeof value === "boolean" ? value : void 0;
}
__name(booleanOrUndefined, "booleanOrUndefined");
function isMeaningfulLegacyProvider(input) {
  if (!isRecord(input)) return false;
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
function arrayOf(value) {
  return Array.isArray(value) ? value : [];
}
__name(arrayOf, "arrayOf");
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
function isRecord(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}
__name(isRecord, "isRecord");

// src/index.ts
var logger;
var ModelHubConsoleService = class extends DataService {
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
    const providers = configured.map((entry) => {
      const preset = getProviderPreset(entry.provider);
      const platform = this._platformOf(entry);
      const endpoint = entry.apiEndpoint || preset.defaultEndpoint;
      const readyForLoad = entry.enabled !== false && endpoint.length > 0 && (entry.apiKey.length > 0 || preset.allowEmptyApiKey === true);
      const error = this._runtime.errors.get(platform);
      const loaded = this._runtime.clients.has(platform);
      const models2 = this.ctx.chatluna.platform.listPlatformModels(
        platform,
        ModelType3.all
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
    const targets = platform ? [[platform, this._runtime.clients.get(platform)]] : [...this._runtime.clients.entries()];
    let models = 0;
    for (const [name2, client] of targets) {
      if (!client) continue;
      try {
        const refreshed = await client.reloadModels();
        await this.ctx.chatluna.platform.refreshClient(client, name2);
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
  _modelsFor(runtime) {
    const settings = this._settings;
    const platformModels = this.ctx.chatluna.platform.listPlatformModels(
      runtime.platform,
      ModelType3.all
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
        type: ModelType3[model.type],
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
  logger = createLogger(ctx, "chatluna-model-hub-adapter");
  const koishiConfig = normalizeKoishiConfig(config);
  const settingsStore = new ModelHubSettingsStore(
    ctx,
    koishiConfig.settingsPath
  );
  const metadataStore = new ModelMetadataStore(ctx, {
    url: koishiConfig.metadataUrl,
    cachePath: koishiConfig.metadataCachePath,
    updateHours: koishiConfig.metadataUpdateHours
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
      const plugin = new ChatLunaPlugin(ctx, providerConfig, provider.platform);
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
          concurrentMaxSize: entry.chatConcurrentMaxSize
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
      saveSettings: /* @__PURE__ */ __name(async (next) => {
        settings = normalizeSettings(next, settings);
        await settingsStore.save(settings);
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
    ctx2.console.addEntry({
      dev: resolve3(__dirname, "../client/index.ts"),
      prod: resolve3(__dirname, "../dist")
    });
  });
}
__name(apply, "apply");
var Config = Schema.object({
  webui: Schema.boolean().default(true),
  frontendMode: Schema.union([
    Schema.const("performance").description("性能模式"),
    Schema.const("polished").description("精致模式")
  ]).role("radio").default("performance"),
  iconCdn: Schema.string().default(DEFAULT_ICON_CDN),
  settingsPath: Schema.string().default(DEFAULT_SETTINGS_PATH),
  metadataUrl: Schema.string().default("https://models.dev/catalog.json").description("模型元数据缓存源"),
  metadataCachePath: Schema.string().default("data/chatluna-model-hub/models.dev.catalog.json").description("模型元数据缓存文件"),
  metadataUpdateHours: Schema.number().default(24).min(1).max(168).description("元数据更新间隔（小时）")
}).i18n({
  "zh-CN": require_zh_CN_schema(),
  "en-US": require_en_US_schema()
});
var usage = `
## ChatLuna Model Hub Adapter

统一管理多个模型服务商。Koishi 配置页只保留 WebUI 入口；供应商、请求参数和密钥请在「Model Hub」WebUI 中配置。

OpenAI-compatible 服务商默认只走 Chat Completions（/chat/completions）。OpenAI 本家可在服务商详情里单独启用 Responses API；Gemini 本家可在服务商详情里单独启用 Google Search 等 Gemini 工具。

配置文件默认保存在 \`data/chatluna-model-hub/config.json\`。WebUI 不会把已保存的 API Key 明文回传到浏览器，留空密钥输入框会保留原值。
模型上下文大小优先读取服务商 /models 返回的 context_length / max_context_length / inputTokenLimit。未提供时，再用 models.dev 的本地缓存补全。
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
    metadataUrl: config.metadataUrl || "https://models.dev/catalog.json",
    metadataCachePath: config.metadataCachePath || "data/chatluna-model-hub/models.dev.catalog.json",
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
  runtime.errors.clear();
}
__name(unregisterRuntime, "unregisterRuntime");
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
__name(errorMessage, "errorMessage");
export {
  Config,
  PROVIDER_PRESETS,
  apply,
  inject,
  logger,
  name,
  reusable,
  usage
};
