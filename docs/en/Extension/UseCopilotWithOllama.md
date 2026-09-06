---
seoTitle: "Use Ollama and Copilot in MarkFlowy"
description: "Configure local Ollama models for MarkFlowy Desktop chat and Copilot, understand document context, and troubleshoot connection or model issues."
updatedAt: "2026-09-06"
---

# Use Ollama and Copilot in MarkFlowy

MarkFlowy Desktop can connect to Ollama for AI chat and Copilot completion. Local inference requires both a local endpoint and a downloaded local model. A cloud model or remote endpoint changes where requests are processed.

This guide describes the desktop configuration in v0.100.1. It was checked against the application source and Ollama documentation on September 6, 2026; it is not a new end-to-end test on all three operating systems. The browser Playground is a separate editor demonstration.

## 1. Start Ollama and check a model

Install Ollama using its [official instructions](https://docs.ollama.com/quickstart). Start the application or service, download a local text-generation model suitable for your hardware, and confirm that it responds in Ollama before configuring MarkFlowy.

```sh
ollama list
```

Keep the exact model name shown in the list, including its tag. Use the same name in MarkFlowy. Speed and memory use depend on your hardware, model, and context size; try a smaller model for short completions and compare its suggestions on your own writing.

The default local host is `http://localhost:11434`. MarkFlowy accepts this host or an address ending in `/api` and normalizes the request URL. Check the model list endpoint:

```sh
curl http://localhost:11434/api/tags
```

## 2. Configure AI chat

1. Open MarkFlowy Desktop settings and find the Ollama configuration in the AI section.
2. Use the default local address, or enter your own Ollama endpoint. Standard local Ollama does not require a cloud provider API key; an authenticated remote gateway may require custom request headers.
3. Open AI chat and select Ollama and a text-generation model. MarkFlowy discovers models from Ollama; you can also explicitly configure model names if discovery is unavailable.
4. Send a short prompt without document context first, then add a small document as context and try a summary.

For example, prepare a sample document with three meeting decisions and ask: “Summarize these decisions as three Markdown bullets. Preserve the owners and dates.” Check the response against the document before using it.

## 3. Configure Copilot separately

Enable Copilot in settings, then choose its provider and model. The chat selection does not replace Copilot's own configuration. You can use Ollama for both or choose different configurations.

Write a few sentences in a Markdown paragraph and pause at the end of the text. Copilot uses text before and after the cursor and neighboring paragraphs to request a short continuation. Start with a small example to distinguish a configuration failure from a slow model.

If chat works but completion does not, check Copilot's enabled state, provider, exact model name, and the model's text-generation capability.

## What is sent to the model?

Chat uses the conversation and document context you select. Copilot requests include surrounding paragraph text. Treat both as document content when choosing an endpoint.

Local processing requires both a local model and a local endpoint. Ollama also supports cloud features; its [FAQ explains how to disable them](https://docs.ollama.com/faq#how-do-i-disable-ollama-cloud-features). Cloud providers and remote Ollama servers have their own data handling and usage costs.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Ollama is unavailable | Check that the service is running and `/api/tags` responds at the configured address. |
| The model is missing | Compare the exact name with `ollama list`; check discovery and text-generation capability. |
| Chat works but Copilot does not | Check Copilot's separate provider, model, and enabled state. |
| A remote service returns 401 or 403 | Check the address and required authentication headers. |
| Replies are slow | Try a shorter context and smaller local model; compare the same prompt directly in Ollama. |

Current desktop AI requests and model discovery use Tauri's native HTTP client. Do not begin troubleshooting by setting `OLLAMA_ORIGINS=*` or exposing Ollama on all network interfaces. If an older browser-based client reports a cross-origin error, follow Ollama's [origin configuration guidance](https://docs.ollama.com/faq#how-can-i-allow-additional-web-origins-to-access-ollama) for that client. Connecting to another machine is a separate network configuration, not a requirement for local use.

See the [product introduction](../intro), [performance notes](../Performance/large-markdown-files), and [current desktop release](https://github.com/drl990114/MarkFlowy/releases/latest).
