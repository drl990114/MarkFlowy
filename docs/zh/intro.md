---
seoTitle: "MarkFlowy：Markdown 编辑与可选 AI"
description: "了解 MarkFlowy 的本地文件工作流、大文档性能、可选 AI，以及桌面版与 Web 版的区别。"
updatedAt: "2026-09-06"
---

# MarkFlowy：Markdown 编辑与可选的 AI 辅助

MarkFlowy 是面向 macOS、Windows 和 Linux 的本地优先 Markdown 编辑器，专注现有文件、大文档编辑与可选的 AI 辅助。无需配置 AI 服务即可编辑，也可以接入云端服务，或通过 Ollama 使用本地模型。

## 适合谁使用？

如果你将笔记、文章或技术文档保存为 Markdown 文件，并希望兼顾源码与可视化编辑，可以尝试 MarkFlowy。文件树、搜索、多标签页、主题和自定义快捷键适合日常围绕文件夹开展的写作。

不同 Markdown 工具的行为可能存在差异。迁移现有文档时，建议先检查有代表性的表格、链接、图片、公式和保存结果。v0.100.0 对编辑器进行了重构，部分编辑交互与旧版不同。

## 性能与大文档

v0.100.0 更新说明记录了**一份 2 MB Markdown 文件在测试中约 1 秒打开**的结果。这是一项测试观察，不代表每个文件、每台设备都能达到相同表现；更新说明未附硬件、完整测试文件、样本分布或 P95。

[大文档性能说明](./Performance/large-markdown-files)介绍了已有证据、适用范围及自行比较文件的方法。MarkFlowy 使用 Tauri 构建；安装包大小随平台、版本和是否内置运行时而异。

## 按需配置 AI

AI 功能包括对话、摘要、翻译与 Copilot 补全。凭据、模型可用性和费用取决于你选择的服务。对话可以使用所选文档上下文；Copilot 单独配置服务商和模型，使用光标周围的文本作为上下文。

本地推理需要选择本机运行的 Ollama 模型和本地服务地址。远程地址或云端模型会将请求发送到对应服务，即使通过 Ollama 接入也一样。具体步骤见 [Ollama 与 Copilot 配置](./Extension/UseCopilotWithOllama)。

## 桌面版、Web App 与 Playground

| 入口 | 适用范围 |
| --- | --- |
| 桌面发行版 | 本地文件与文件夹工作流，以及可配置的 AI。 |
| Web App Beta | 独立的浏览器工作区；连接的远程工作区具有各自的存储和登录行为。 |
| Playground | RME 编辑器的浏览器演示，不能证明桌面版编辑器的性能或 AI 支持。 |

本文介绍的大文档与本地 AI 工作流以桌面发行版为准。[Playground](https://www.markflowy.cc/zh/playground)适合快速体验基础编辑。

## 下载

支持 Windows、macOS 和 Linux，可从 [latest release](https://github.com/drl990114/MarkFlowy/releases/latest) 下载。

### Windows

下载并运行任意一个 x64 安装包：

- `MarkFlowy_v<version>_x64-setup.exe` 或 `MarkFlowy_v<version>_x64.msi` — 安装程序。
- `MarkFlowy_v<version>_offline_installer_x64-setup.exe` / `.msi` — 同上，内置 WebView2 运行时。
- `MarkFlowy_v<version>_x64_portable.zip` — 解压即用，无需安装。

### macOS

下载 `MarkFlowy_v<version>_aarch64.dmg`（Apple silicon）或 `MarkFlowy_v<version>_x64.dmg`（Intel）。

> [!NOTE]
> 因为苹果安全策略对于没有开发者认证软件的限制，导致 **macOS aarch64** 版本无法直接安装。你可以通过以下步骤忽略该限制：
> - 打开终端
> - 进入到 `应用` 的目录下. 例如 `/Applications`.
> - 执行 `xattr -cr MarkFlowy.app` 然后打开 app 即可
> - 请确保下载来源为 `github releases`。

### Linux

目前仅提供 x86_64 版本。

#### Flatpak

已上架 [FlatPark](https://flatpark.org) — [应用页面](https://flatpark.org/apps/io.github.drl990114.MarkFlowy)：

```sh
flatpak remote-add --if-not-exists flatpark https://dl.flatpark.org/flatpark.flatpakrepo
flatpak install flatpark io.github.drl990114.MarkFlowy
```

#### 安装脚本

按发行版安装 `.deb` 或 `.rpm`，无法识别发行版时安装 AppImage：

```sh
curl -fsSL https://raw.githubusercontent.com/drl990114/MarkFlowy/main/scripts/install-linux.sh -o install-linux.sh
sh install-linux.sh
```

没有 `curl` 时可用 `wget -O install-linux.sh <url>`。加 `--appimage` 强制使用 AppImage，加 `--uninstall` 卸载。

## 项目与反馈

查看[源码仓库](https://github.com/drl990114/MarkFlowy)、[更新说明](https://www.markflowy.cc/zh/releases)和[贡献指南](./Community/CONTRIBUTING)。反馈问题时请附应用版本、操作系统和可复现的示例。
