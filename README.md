# koishi-plugin-chatluna-adapter

ChatLuna 多模型供应商适配器工作区。目前主要包为 `koishi-plugin-chatluna-model-hub-adapter`，用于在 Koishi / ChatLuna 中统一接入多个模型服务商，并提供独立的 Model Hub WebUI 管理供应商配置。

## 包

- `packages/adapter-model-hub`: ChatLuna Model Hub Adapter，支持 OpenAI、OpenAI-compatible、Gemini、DeepSeek、Qwen、OpenRouter、Groq、Mistral、本地 OpenAI-like 服务等供应商。

## 特性

- 使用服务商作为配置单位，在独立 WebUI 中新增、编辑、刷新模型。
- 模型列表优先从服务商 `/models` 接口自动获取，不显示内置模型列表。
- 模型上下文长度优先使用接口返回的 `context_length`、`max_context_length`、`inputTokenLimit` 等字段，未提供时再使用本地缓存的 `models.dev` 元数据补全。
- OpenAI-compatible 使用 Chat Completions 协议，不启用 OpenAI Responses 工具。
- OpenAI 本家可在服务商配置中按需启用 Responses API。
- Gemini 本家可在服务商配置中按需启用 Google Search、Code Execution、URL Context 等工具。

## 开发

```bash
yarn install
yarn build
```

## 发布

发布工作流位于 `.github/workflows/publish-npm.yml`。推送形如 `adapter-model-hub-v1.0.0` 的 tag 后，GitHub Actions 会构建并发布 `packages/adapter-model-hub`。

手动发布可在包目录执行：

```bash
cd packages/adapter-model-hub
npm publish --access public
```

## 许可证

AGPL-3.0
