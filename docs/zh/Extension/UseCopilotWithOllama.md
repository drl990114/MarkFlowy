---
seoTitle: "在 MarkFlowy 中使用 Ollama 与 Copilot"
description: "为 MarkFlowy 桌面版配置本地 Ollama 对话与 Copilot，了解文档上下文，并排查连接和模型问题。"
updatedAt: "2026-09-06"
---

# 在 MarkFlowy 中使用 Ollama 与 Copilot

MarkFlowy 桌面版可以连接 Ollama，进行 AI 对话和 Copilot 补全。本地推理需要同时使用本地服务地址和已下载的本地模型；选择云端模型或远程地址时，请求会由对应服务处理。

本文面向 v0.100.1 桌面版的配置方式，于 2026 年 9 月 6 日根据应用源码与 Ollama 文档核对，不代表新增了一次覆盖三个操作系统的端到端实测。浏览器 Playground 是独立的编辑器演示。

## 1. 启动 Ollama 并检查模型

按照 [Ollama 官方说明](https://docs.ollama.com/quickstart)完成安装，启动应用或服务，下载适合当前硬件的本地文本生成模型。先确认模型在 Ollama 中能够正常回答，再配置 MarkFlowy。

```sh
ollama list
```

记录列表中的完整模型名称，包括标签；在 MarkFlowy 中使用相同名称。速度和内存使用取决于硬件、模型及上下文长度。短补全可以先尝试较小的模型，再用自己的文本比较建议质量。

本地默认地址为 `http://localhost:11434`。MarkFlowy 接受这个地址，也接受以 `/api` 结尾的地址，会统一处理请求路径。可检查模型列表接口：

```sh
curl http://localhost:11434/api/tags
```

## 2. 配置 AI 对话

1. 打开 MarkFlowy 桌面版设置，在 AI 部分找到 Ollama 配置。
2. 使用默认本地地址，或填写自己的服务地址。普通本地 Ollama 不需要云端服务商的 API Key；有鉴权的远程网关可能需要请求头。
3. 打开 AI 对话，选择 Ollama 和文本生成模型。MarkFlowy 会发现 Ollama 中的模型；发现不可用时，也可显式配置模型名称。
4. 先发送一条不带文档上下文的短问题，再加入一份小文档，尝试生成摘要。

例如，准备一份包含三项会议决定的示例文档，然后提问：“请将这些决定总结成三个 Markdown 列表项，保留负责人和日期。”使用回答前，与原文核对。

## 3. 单独配置 Copilot

在设置中启用 Copilot，然后选择它自己的服务商和模型。对话中的模型选择不会替代 Copilot 配置；两者可以都使用 Ollama，也可以分别配置。

在 Markdown 段落中写几句话，将光标停在文本末尾。Copilot 会使用光标前后的文本和相邻段落，向模型请求简短续写。初次尝试使用较短文本，便于区分配置失败与模型响应较慢。

如果对话正常而补全没有反应，请检查 Copilot 是否启用、服务商是否正确、模型全名是否一致，以及模型是否具备文本生成能力。

## 哪些内容会发送给模型？

对话使用当前会话和你选择的文档上下文；Copilot 请求包含光标周围的段落文本。选择服务地址时，应将这些内容视为文档数据。

本地处理需要同时满足“本地模型”和“本地地址”。Ollama 也提供云端功能，其 [FAQ 说明了关闭方法](https://docs.ollama.com/faq#how-do-i-disable-ollama-cloud-features)。云端服务商和远程 Ollama 服务各自具有不同的数据处理方式及费用。

## 常见问题

| 现象 | 检查方法 |
| --- | --- |
| Ollama 不可用 | 确认服务正在运行，并检查所配置地址的 `/api/tags` 是否响应。 |
| 找不到模型 | 与 `ollama list` 的完整名称核对，检查模型发现和文本生成能力。 |
| 对话正常，Copilot 无响应 | 检查 Copilot 单独的服务商、模型和启用状态。 |
| 远程服务返回 401 或 403 | 检查地址和服务要求的鉴权请求头。 |
| 回答很慢 | 缩短上下文、尝试较小模型，并在 Ollama 中直接比较同一问题。 |

当前桌面版的 AI 请求和模型发现使用 Tauri 原生 HTTP 客户端，无需先将 `OLLAMA_ORIGINS` 设为 `*` 或将 Ollama 暴露到所有网络接口。如果使用旧版浏览器客户端，且日志明确显示跨域错误，再按 Ollama 的[来源配置说明](https://docs.ollama.com/faq#how-can-i-allow-additional-web-origins-to-access-ollama)为该客户端配置。连接另一台机器上的 Ollama 属于独立网络配置，不是本地使用的前置步骤。

继续阅读[产品介绍](../intro)、[性能说明](../Performance/large-markdown-files)，或下载[当前桌面发行版](https://github.com/drl990114/MarkFlowy/releases/latest)。
