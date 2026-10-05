---
seoTitle: "MarkFlowy 桌面版：入门与写作指南"
description: "了解 MarkFlowy 桌面版的本地文件、所见即所得与源码编辑、搜索、本地历史、主题、可选 AI 和导出。"
updatedAt: "2026-09-27"
---

# 用 MarkFlowy 写作

MarkFlowy 是面向 macOS、Windows 和 Linux 的本地优先 Markdown 编辑器。打开已有的文件与文件夹，用所见即所得或 Markdown 源码模式写作，需要时再接入 AI。本地编辑无需登录，也无需配置 AI 服务。

![MarkFlowy 桌面版的本地文件树、所见即所得编辑器和文档目录](/screenshots/home.png)

## 打开第一份文档

1. 从 [GitHub Releases](https://github.com/drl990114/MarkFlowy/releases/latest) 安装适合操作系统的版本。
2. 选择**打开文件**编辑单个文档，或**打开文件夹**创建工作区。标题栏的文件夹按钮还可查看最近打开的文件和工作区，并在新窗口打开文件夹。
3. 在文件树中选择文件，或新建 Markdown 文件。TXT、JSON 等文本文件也可编辑。
4. 输入内容后按 **Cmd/Ctrl + S** 保存；在**设置 → 通用**中配置自动保存与保存间隔。

工作区使用普通文件。你可以自行选择备份与同步工具；本地编辑不会把所有文档上传到 MarkFlowy 云端账户。

## 选择编辑模式

在编辑器工具栏打开**更多 → 视图**。

| 模式 | 适用场景 |
| --- | --- |
| 所见即所得 | 直接编辑格式化的标题、列表和表格，使用上下文块操作。 |
| 源码 | 编辑 Markdown 原文，包括语法和空白。 |
| 预览 | 阅读渲染后的文档，不修改内容。 |

编辑器获得焦点时，按 **Cmd/Ctrl + Shift + M** 切换所见即所得与源码模式。检查特殊语法或在不同 Markdown 工具间迁移时，可以用源码模式确认保存内容。

在所见即所得模式输入 `/` 插入块；选择文本使用浮动格式工具栏，或通过块操作按钮的**转换为**菜单（**Cmd/Ctrl + Shift + X**）转换支持的块类型。代码、公式与 Mermaid 块可复用[片段库](./Extension/Snippets)中的内容。

![Markdown 源码编辑](/screenshots/sourcecode.png)

## 在工作区中导航

- **快速打开**：按 **Cmd/Ctrl + P**，输入部分文件名或相对路径，用方向键和 Enter 打开结果。
- **命令面板**：按 **Cmd/Ctrl + Shift + P** 查找操作，包括本地历史和编辑命令。
- **搜索**：打开搜索面板查找工作区内容；在当前编辑器按 **Cmd/Ctrl + F** 查找和替换。
- **目录与书签**：从状态栏打开目录或书签面板；文件树的**定位当前文件**可展开并定位当前文档。
- **标签与分屏**：拖动标签调整顺序，或移到另一编辑器分组；点击分屏按钮向右拆分，按住 Alt 向下拆分。
- **专注写作**：按 **Cmd/Ctrl + Shift + F** 开关 Zen 模式；拖动侧栏分隔线调整宽度。

## 保存、本地历史与外部修改

通过**更多 → 本地历史**查看早期版本，比较修改后再选择恢复。**设置 → 本地历史**可配置保留策略与存储。本地历史存放在应用端，仍建议保留独立备份。

正常退出应用或刷新窗口后，已保存的草稿可恢复未命名文档和未保存修改；重新打开对应工作区即可恢复。仍请及时保存文件，并保留独立备份。

其他应用修改了当前文件时，未编辑的文档会自动重新载入。若编辑器和磁盘都有修改，会提示冲突：**更新**载入磁盘内容，**覆盖**将编辑器内容写入磁盘。操作前确认要保留哪一份。

## 外观与写作偏好

在**设置 → 外观**选择主题模式；在**主题商店**创建、复制、编辑、导入或导出 JSON 主题。[主题指南](./Extension/CustomTheme)包含旧版 JS/npm 主题的迁移步骤，旧格式不再自动加载。

编辑器设置包含字体排版、全宽布局、代码块换行和光标动效。正文方向可选**自动**、**从左到右**或**从右到左**，也可在**更多 → 文本方向**单独设置当前文档。正文方向不改变 Markdown 源码和代码的从左到右显示。

![MarkFlowy 桌面版深色主题](/screenshots/darkmode.png)

## 按需配置 AI

在**设置 → AI**中配置服务商，然后打开右侧的 **Chat AI**。现有接入包括 OpenAI 兼容服务、DeepSeek、Google 和 Ollama。选择模型与文档上下文后，可以对话、获取摘要或翻译；写作补全需要单独启用与配置 **Copilot**。

所选服务商会收到对话与附加的上下文，Copilot 会使用光标周围的文本。本地推理需要同时使用本地 Ollama 地址和已下载的本地模型；云端模型或远程地址会把请求发送到对应服务。详细步骤见 [Ollama 与 Copilot 配置](./Extension/UseCopilotWithOllama)。

错误报告是独立的偏好设置，位于**设置 → 通用**，默认关闭。

## 导出与分享

| 目标格式 | 操作入口 |
| --- | --- |
| HTML、图片 | Markdown 文档的**更多 → 导出**。 |
| PDF | **更多 → 导出 → PDF**，随后使用系统打印对话框。 |
| DOCX、ODT、EPUB | 安装 Pandoc，在**设置 → 导出**配置后，选择**通过 Pandoc 导出**。 |
| 本地自动化 | 使用 [CLI 与官方 Skill](https://github.com/drl990114/MarkFlowy/blob/main/docs/CLI.md)进行本地文件操作和导出。 |

可用导出项取决于文件类型和编辑模式。导出 PDF 时，在系统打印对话框中选择保存为 PDF。

## 常用默认快捷键

| 操作 | macOS | Windows / Linux |
| --- | --- | --- |
| 快速打开 | Cmd + P | Ctrl + P |
| 命令面板 | Cmd + Shift + P | Ctrl + Shift + P |
| 打开文件夹 | Cmd + Shift + O | Ctrl + Shift + O |
| 保存 | Cmd + S | Ctrl + S |
| 当前编辑器查找 | Cmd + F | Ctrl + F |
| 所见即所得 / 源码 | Cmd + Shift + M | Ctrl + Shift + M |
| Zen 模式 | Cmd + Shift + F | Ctrl + Shift + F |
| 设置 | Cmd + , | Ctrl + , |

在**设置 → 快捷键**中搜索命令、录制按键、移除绑定或恢复默认。自定义绑定会替代上表中的默认按键。

## 桌面版、Web 与性能

**Web App Beta** 是独立的浏览器工作区，具有自己的存储与登录行为。本文的本地文件、系统导出和截图示例均面向桌面版。

MarkFlowy 针对大文档优化加载与渲染，让长篇 Markdown 的打开、滚动和编辑更流畅。

MarkFlowy 使用 Tauri 与系统 WebView，安装包大小随平台和安装方式变化；Windows 离线包包含 WebView2。

## 升级与反馈

从旧版本迁移文档时，先备份并检查有代表性的表格、链接、图片、公式和保存结果。0.100 系列重构过编辑器，主题也改为声明式 JSON；旧主题请参考[主题迁移指南](./Extension/CustomTheme)。

查看[更新日志](https://www.markflowy.cc/zh/releases)、[贡献指南](./Community/CONTRIBUTING)和 [Issue 列表](https://github.com/drl990114/MarkFlowy/issues)。报告问题时请附应用版本、操作系统、编辑模式和最小复现示例。

## 下载

支持 Windows、macOS 和 Linux，可从 [latest release](https://github.com/drl990114/MarkFlowy/releases/latest) 下载。

### Windows

下载并运行任意一个 x64 安装包：

- `MarkFlowy_v<version>_x64-setup.exe` 或 `MarkFlowy_v<version>_x64.msi` — 安装程序。
- `MarkFlowy_v<version>_offline_installer_x64-setup.exe` / `.msi` — 同上，内置 WebView2 运行时。
- `MarkFlowy_v<version>_x64_portable.zip` — 解压即用，无需安装。

### macOS

下载 `MarkFlowy_v<version>_aarch64.dmg`（Apple silicon）或 `MarkFlowy_v<version>_x64.dmg`（Intel）。

> 若 macOS 拦截了从官方 Release 页面下载的可信应用，可按 Apple 的[“仍要打开”说明](https://support.apple.com/zh-cn/102445)，在**系统设置 → 隐私与安全性**中操作。

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
