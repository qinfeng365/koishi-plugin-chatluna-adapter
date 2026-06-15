# koishi-plugin-chatluna-model-hub-adapter

ChatLuna 多模型供应商聚合适配器，提供独立 Model Hub WebUI，用服务商为单位管理 API Key、Endpoint、请求参数、模型刷新和供应商专属能力。

![License](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)
![Koishi](https://img.shields.io/badge/Koishi-4.18%2B-5546ff)
![ChatLuna](https://img.shields.io/badge/ChatLuna-1.4%20alpha-orange)

## 功能

- 多供应商统一接入：OpenAI、OpenAI-compatible、Gemini、DeepSeek、Qwen、OpenRouter、Groq、Mistral、Moonshot、智谱、硅基流动、Ollama、LM Studio、vLLM、llama.cpp、Xinference、LocalAI 等。
- 独立 WebUI：Koishi 配置页只保留入口、图标源、配置文件路径和 `models.dev` 缓存设置；供应商参数在 Model Hub 页面里配置。
- 自动获取模型：模型列表来自服务商 `/models` 接口，不展示硬编码内置模型列表。
- 上下文长度补全：优先读取服务商返回的 `context_length`、`max_context_length`、`inputTokenLimit`、`limit.context` 等字段，未提供时使用本地 `models.dev` 缓存补全。
- 模块化适配：每个供应商 preset 独立文件，协议适配器独立在 `src/adapters` 中，后续扩展新格式更容易。
- Provider 专属能力：OpenAI 可选 Responses API；Gemini 可选 Google Search、Code Execution、URL Context、Image Generation、Thinking 相关参数。
- 密钥保护：WebUI 不会把已保存的 API Key 明文回传到浏览器，密钥输入留空会保留原值。

## 环境要求

- Node.js >= 18
- Koishi >= 4.18.9
- `koishi-plugin-chatluna` >= 1.4.0-alpha.23
- 推荐安装 `@koishijs/plugin-console`，用于打开 Model Hub WebUI
- `koishi-plugin-chatluna-storage-service` 为可选依赖

## 安装

发布到 npm 后，可在 Koishi 项目中安装：

```bash
npm install koishi-plugin-chatluna-model-hub-adapter
```

本仓库开发构建：

```bash
yarn install
yarn build
```

## 使用

1. 在 Koishi 中启用 `chatluna-model-hub-adapter`。
2. 打开 Koishi 控制台中的 Model Hub 页面。
3. 选择供应商，填写 API Key、Endpoint、ChatLuna 平台 ID。
4. 保存后刷新模型，ChatLuna 会注册对应平台和模型。

OpenAI-compatible 服务商使用 OpenAI Chat Completions 风格接口，路径会按适配器请求自动拼接到 `chat/completions`、`models` 等资源；请填写服务商 API 根地址，例如 `https://api.deepseek.com` 或兼容服务提供的 `/v1` 根地址。

## 配置

Koishi 插件配置页只保留全局运行所需字段：

- `webui`: 是否启用 Model Hub WebUI。
- `frontendMode`: 前端模式，默认性能模式。
- `iconCdn`: 图标 CDN，默认使用 LobeHub Icons CDN。
- `settingsPath`: Model Hub 供应商配置保存路径，默认 `data/chatluna-model-hub/config.json`。
- `metadataUrl`: 模型元数据源，默认 `https://models.dev/catalog.json`。
- `metadataCachePath`: `models.dev` 元数据本地缓存路径，默认 `data/chatluna-model-hub/models.dev.catalog.json`。
- `metadataUpdateHours`: 元数据定时更新间隔，默认 24 小时。

供应商级配置均在 WebUI 中维护，包括：

- API Key、Endpoint、平台 ID、是否启用、是否拉取模型。
- 自定义请求头、并发、超时、重试、代理、流式开关。
- 上下文比例、温度、presence penalty、frequency penalty。
- OpenAI Responses API 与内置工具。
- Gemini Google Search、Code Execution、URL Context、图片生成、Thinking 参数。

## 模型与上下文

本插件不会把内置模型列表当作可选模型来源。模型来源顺序为：

1. 服务商 `/models` 接口返回的模型。
2. WebUI 中手动追加的模型。

上下文大小解析顺序为：

1. 服务商接口字段，例如 `context_length`、`max_context_length`、`inputTokenLimit`、`input_token_limit`、`limit.context`。
2. 本地缓存的 `models.dev` 元数据。
3. ChatLuna 共享适配器的保守推断值。

`models.dev` 只用于补全模型元数据，不会作为模型列表来源。

## 适配器说明

- `openai-chat`: OpenAI-compatible / OpenAI-like 协议，使用 `/chat/completions`，不启用 OpenAI Responses 工具。
- `openai`: OpenAI 本家协议，默认仍使用 Chat Completions；只有在服务商详情中启用 Responses API 后才走 Responses。
- `gemini`: Gemini 原生协议，支持 Gemini 工具与函数名清洗，避免不合法工具名导致 400 错误。

## 开发结构

```text
src/
  adapters/      # 协议适配器：openai-chat、openai、gemini
  providers/     # 单供应商 preset，每个服务商一个文件
  client.ts      # ChatLuna 平台客户端
  requester.ts   # 请求封装与路径处理
  settings.ts    # WebUI 配置持久化与迁移
  metadata.ts    # models.dev 缓存与元数据补全
client/
  dashboard.vue  # Koishi 控制台 WebUI
```

## 发布

版本号：`1.0.0`

GitHub Actions 会在推送 tag 时发布：

```bash
git tag adapter-model-hub-v1.0.0
git push origin adapter-model-hub-v1.0.0
```

手动发布：

```bash
cd packages/adapter-model-hub
npm publish --access public
```

## 许可证

AGPL-3.0
