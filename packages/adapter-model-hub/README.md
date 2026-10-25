# koishi-plugin-chatluna-model-hub-adapter

ChatLuna 多模型供应商聚合适配器，提供独立 Model Hub WebUI，用服务商为单位管理 API Key、Endpoint、请求参数、模型刷新和供应商专属能力。

![License](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)
![Koishi](https://img.shields.io/badge/Koishi-4.18%2B-5546ff)
![ChatLuna](https://img.shields.io/badge/ChatLuna-1.4%20stable-green)

## 功能

- 多供应商统一接入：OpenAI、OpenAI-compatible、Gemini、Dify、DeepSeek、Qwen、OpenRouter、Groq、Mistral、Moonshot、智谱、硅基流动、Ollama、LM Studio、vLLM、llama.cpp、Xinference、LocalAI 等。
- 独立 WebUI：Koishi 配置页只保留入口、图标源、配置文件路径和 `models.dev` 缓存设置；供应商参数在 Model Hub 页面里配置。
- 自动获取模型：模型列表来自服务商 `/models` 接口，不展示硬编码内置模型列表。
- 模型浏览：按提供商与平台实例分组，支持搜索、类型/能力筛选、浏览器收藏与最近成功调用；仅折叠明确标记的推理变体，大列表每组按需展开。收藏不会修改服务商配置；最近使用记录当前服务商加载期间最多200个模型，重启或重新加载服务商后清空。刷新失败保留旧列表及上次成功更新时间。
- 元数据补全：优先读取服务商返回的上下文长度与能力字段，未提供时使用本地 `models.dev` 缓存补全；明确的不支持声明优先于名称推断。页面刷新模型会先更新元数据，下载失败仍可使用旧缓存并定时重试。
- 能力修正：模型行的“能力”按钮支持按连接源、Key 与原始上游 ID，分别自动识别、强制启用或强制禁用能力；覆盖保存到后端，刷新和重启后保留，不污染自动目录。
- 模块化适配：每个供应商 preset 独立文件，协议适配器独立在 `src/adapters` 中，后续扩展新格式更容易。
- Provider 专属能力：OpenAI 可选 Responses API；Gemini 可选 Google Search、Code Execution、URL Context、Image Generation、Thinking 和 Agentic Video（目前限定上游支持的 Gemini 3.5–3.8 Flash 型号）；Dify 使用原生 Application API。
- 密钥保护：WebUI 不会把已保存的 API Key 明文回传到浏览器，密钥输入留空会保留原值。

## 环境要求

- Node.js >= 18
- Koishi >= 4.18.9
- `koishi-plugin-chatluna` >= 1.4.0（稳定版）
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
yarn test
```

## 使用

1. 在 Koishi 中启用 `chatluna-model-hub-adapter`。
2. 打开 Koishi 控制台中的 Model Hub 页面。
3. 选择供应商并填写 ChatLuna 平台 ID，在“连接源与密钥”中配置 Endpoint 和 API Key；同一平台可以添加多个连接源，每个源可以配置多个 Key。
4. 保存后刷新模型，ChatLuna 会注册对应平台和模型。

OpenAI-compatible 服务商使用 OpenAI Chat Completions 风格接口，路径会按适配器请求自动拼接到 `chat/completions`、`models` 等资源；请填写服务商 API 根地址，例如 `https://api.deepseek.com` 或兼容服务提供的 `/v1` 根地址。

Dify 服务商使用 Dify Application API，不走 OpenAI-compatible。一个配置的 Dify App 会注册成一个 ChatLuna 模型，模型名使用服务商详情中的 Dify 模型名。

### 多源与多 Key

- 平台 ID 是稳定的对外入口，模型引用仍为 `platform/model`。连接源负责接口模板、API 地址和源级覆盖，每个 Key 有独立身份、认证范围、状态与限额。
- 默认按源优先级主备调度，再在所选源内轮询可用 Key；选择负载均衡模式后按源权重调度，增加 Key 不会增加源权重。共享账户的 Key 可填写相同的共享配额组。
- 不同源的同名模型不会自动合并或互相兜底。需要跨源时，在“显式模型路由”中配置对外模型名、候选源、上游模型名及是否允许备用源。模型能力默认取候选交集；Embedding 跨源必须声明一致的语义空间和版本。
- 每个 Key 分别读取模型目录。局部失败保留该范围上次成功的目录并显示异常；成功返回空目录会清除该范围的旧结果。“刷新此源目录”只刷新指定源。
- 平台、源、Key 与共享配额的限制同时生效。只有明确的鉴权、模型权限或限流拒绝才可能换 Key；已经输出、远端资源请求、网络结果不明或服务端错误不会自动重放。
- 文件、显式缓存和远端会话绑定具体源、Key 与凭据代次。更换 Key 不会继承旧资源；固定缓存、Vector Store 等需要确认资源归属后重新绑定。资源管理必须选择具体源与 Key。
- 保存有版本冲突检查；修改配置不影响已经开始的请求。复制与克隆清除已保存和未保存的 Key、请求头及资源绑定。管理员配置不写入浏览器本地存储。

旧配置会按原有平台拆分规则迁移，保留原 `platform/model` 引用；Dify 每个旧应用迁移为独立源，保留应用名及重名后缀。升级前的 Dify 远端会话缓存不会自动复用到新凭据范围；需要继续使用 Dify 时建议新建会话。

### 修正模型能力

在“模型”页点击模型行的“能力”，选择具体连接后，为文本、工具、图片、思考、图片生成、音频、视频、文件设置三态覆盖。保存后同时影响模型声明和请求处理；取消不写入，“当前连接恢复自动”也需要保存才生效。服务商配置存在未保存修改时，需先保存或重新载入配置。

人工覆盖优先于接口、元数据与名称推断，但不能让上游获得其不支持的功能，也不能绕过适配协议限制、候选能力交集或显式路由契约。编辑推理变体时优先修正基础模型，并传递到自动生成的变体。名称分隔符仅用于识别，实际请求仍使用原始上游 ID；不同源和 Key 的覆盖不会互相移植。

## 配置

Koishi 插件配置页只保留全局运行所需字段：

- `webui`: 是否启用 Model Hub WebUI。
- `frontendMode`: 前端模式，默认性能模式。
- `iconCdn`: 图标 CDN，默认使用 LobeHub Icons CDN。
- `settingsPath`: 配置路径基名，默认 `data/chatluna-model-hub/config.json`。新版配置原子保存为该路径加 `.v2`；迁移时保留原文件及 `.pre-v2.bak` 备份，降级不会覆盖新版唯一副本。连接模型目录与资源归属缓存保存为 `.v2.catalog.json`，不包含 API Key。
- `metadataUrl`: 模型元数据源，默认 `https://models.dev/api.json`。
- `metadataCachePath`: `models.dev` 元数据本地缓存路径，默认 `data/chatluna-model-hub/models.dev.models.json`。
- `metadataUpdateHours`: 元数据定时更新间隔，默认 24 小时。

供应商级配置均在 WebUI 中维护，包括：

- API Key、Endpoint、平台 ID、是否启用、是否拉取模型。
- 自定义请求头、并发、超时、重试、代理、流式开关。
- 上下文比例、温度、presence penalty、frequency penalty。
- OpenAI Responses API 与内置工具。
- Gemini Google Search、Code Execution、URL Context、图片生成、Thinking 参数。
- Dify App 类型、工作流 ID、输出变量、文件上传开关与上下文大小。

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
- `dify`: Dify 原生 Application API；不会请求 `/models`，每个配置的 Dify App 就是一个 ChatLuna 模型；支持 Chat、Agent、Workflow、Completion，启动时通过 `/parameters` 读取输入变量与文件限制，按需使用 `/files/upload` 后再调用 `/chat-messages`、`/completion-messages` 或 `/workflows/run`。

### Dify 与 ChatLuna Character

Dify App 需要在自己的输入变量中引用 ChatLuna 提供的上下文。适配器会把当前 ChatLuna 请求桥接到 Dify `inputs`，常用变量包括：

- `query` / `input` / `prompt`: 本轮用户输入。
- `chatluna_system_prompt`: ChatLuna 已渲染的系统提示，通常包含角色设定、预设和记忆注入后的结果。
- `chatluna_history`: 已裁剪的历史消息 JSON。
- `chatluna_character`、`chatluna_character_name`、`chatluna_persona`: 来自 ChatLuna Character 或兼容变量的角色信息。
- `chatluna_authors_note`、`chatluna_lore_books`: 作者注记和世界书变量。

如果 Dify App 的 `user_input_form` 中定义了同名变量，适配器会自动填入；Workflow 的文件变量会优先绑定到第一个文件类型输入控件。

## 开发结构

```text
src/
  adapters/      # 协议适配器：openai-chat、openai、gemini、dify
  providers/     # 单供应商 preset，每个服务商一个文件
  client.ts      # ChatLuna 平台客户端
  requester.ts   # 请求封装与路径处理
  settings.ts    # WebUI 配置持久化与迁移
  metadata.ts    # models.dev 缓存与元数据补全
client/
  dashboard.vue  # Koishi 控制台 WebUI
```

## 发布

版本号：`1.3.0`

GitHub Actions 会在推送 tag 时发布：

```bash
git tag adapter-model-hub-v1.3.0
git push origin adapter-model-hub-v1.3.0
```

手动发布：

```bash
cd packages/adapter-model-hub
npm publish --access public
```

## 许可证

AGPL-3.0
