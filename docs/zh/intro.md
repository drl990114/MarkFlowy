# MarkFlowy

## MarkFlowy 目前处于 Beta 阶段 ⚠️

目前 MarkFlowy 处于 beta 阶段，建议在有数据备份的情况下使用。

## 功能特性

- **内置 AI**。目前支持一键导出对话、文章翻译成任意语言、获取文章摘要等功能。还支持 `DeepSeek` 和 `Chatgpt` 等大模型，让它们成为你的智能助手。
- **超轻量级**。MarkFlowy 基于 tauri 构建，体积小于 10MB，性能更佳。
- **高可用性**。MarkFlowy 使用 remirror 编辑器，不仅提供高扩展性，还拥有出色的编辑体验。此外，MarkFlowy 支持多种编辑模式，如 `源代码`、`所见即所得`。
- **自定义主题**。MarkFlowy 支持自定义主题，你还可以与他人分享你的主题。

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

## 为什么

目前，我已经使用过很多 Markdown 应用，但没有遇到一个非常适合我的。我一直希望能有一个高效、美观、轻量级、数据安全且能轻松与各种工作流结合的 Markdown 编辑器。这也是做 MarkFlowy 的初衷。

## 贡献

目前的 MarkFlowy 还处于起步阶段，可能会有一些不好的体验或 bug，对此我深表歉意。所有感兴趣或遇到使用问题的伙伴都欢迎提交 [issues](https://github.com/drl990114/MarkFlowy/issues/new) 或 [PR](https://github.com/drl990114/MarkFlowy/compare) 来参与这个项目。

### 如何贡献

你可以阅读 [CONTRIBUTING](./Community/CONTRIBUTING) 来了解如何启动项目和修改代码，欢迎参与代码贡献。

## 支持

MarkFlowy 完全且永久开源，如果你想支持 MarkFlowy，可以给这个项目 `star`。这将给我很大的支持和帮助，爱你。
