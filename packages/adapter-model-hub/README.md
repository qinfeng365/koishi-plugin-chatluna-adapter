# chatluna-model-hub-adapter

Multi-provider model hub adapter for ChatLuna.

Each enabled provider is registered as an independent ChatLuna platform, for
example `hub-openai/gpt-4o`, `hub-deepseek/deepseek-chat`, or
`hub-ollama/llama3.1`.

## Features

- Built-in provider presets plus a custom OpenAI-compatible entry.
- OpenAI-compatible providers use Chat Completions (`/chat/completions`).
- OpenAI uses Chat Completions by default and can optionally enable the
  Responses API per provider entry.
- Gemini uses the native Gemini API and exposes Gemini-only tools such as Google
  Search per provider entry.
- Provider configuration is managed in the independent Koishi console WebUI.
- Provider cards open into a detail form; display name and ChatLuna platform ID
  are separate fields.
- LLM, embeddings, and reranker model registration.
- Optional `/models` discovery per provider.
- LobeHub icon CDN support.

## Configuration

The Koishi plugin config only keeps the WebUI switch, icon CDN, and settings file
path. Provider keys, endpoints, models, headers, blacklist rules, and request
parameters are stored in:

```text
data/chatluna-model-hub/config.json
```

Use the `Model Hub` WebUI page to add or edit providers.

OpenAI-compatible providers are chat-only. Provider-specific capabilities such
as OpenAI Responses API or Gemini Google Search are only available on those
providers and are configured inside that provider's WebUI detail page.
