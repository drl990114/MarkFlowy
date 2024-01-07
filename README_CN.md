<h4 align="right"><strong><a href="https://github.com/drl990114/MarkFlowy">English</a></strong> | 简体中文</h4>

<div align="center">
  <img align="center" src="./public/logo.png" width="120" height="120" />
</div>

<h1 align="center"/>MarkFlowy <sup><em>alpha</em></sup></h1>

<h4 align="center">现代 Markdown 编辑器.(WIP)</h3>

<p align="center">
  <a href="https://github.com/drl990114/MarkFlowy/actions/workflows/nodejs.yml"><img src="https://github.com/drl990114/MarkFlowy/actions/workflows/nodejs.yml/badge.svg?branch=main&color=%23fe7d27" alt="build status"></a>
  <a href="https://github.com/drl990114/MarkFlowy/releases" target="__blank"><img alt="GitHub downloads" src="https://img.shields.io/github/downloads/drl990114/MarkFlowy/total?label=Downloads&color=%23fe7d37"></a>
  <a href="https://github.com/drl990114/MarkFlowy/releases" target="__blank"><img alt="GitHub release (latest by date)" src="https://img.shields.io/github/v/release/drl990114/MarkFlowy?label=Version"></a>
  <a href="https://github.com/drl990114/MarkFlowy" target="__blank"><img alt="GitHub" src="https://img.shields.io/github/commit-activity/w/drl990114/MarkFlowy?color=%2346bd1b"></a>
  <a href="https://www.rust-lang.org/" target="__blank"><img alt="GitHub" src="https://img.shields.io/badge/Rust-1.72.0-dea584"></a>
</p>


## ⚠️ MarkFlowy 目前处于 Alpha 阶段

目前 MarkFlowy还处于alpha阶段，建议在有数据备份的情况下使用。

## Features

- **内置ChatGpt**. 当前支持一键导出笔记，让ChatGPT成为你的智能助手。
- **超轻量**. MarkFlowy 基于 tauri, 拥有小于 10MB 的体积和更好的性能。
- **高可用性**. MarkFlowy 使用 remirror 作为编辑器核心, 不仅扩展性高，编辑体验也很好。并支持多种编辑模式，如`source code`, `wysiwyg`.
- **自定义主题**. MarkFlowy 支持自定义主题，并且你也可以与他人分享你的主题。

## 下载

支持平台 Linux, macOS 和 Windows.

> 请注意：因为苹果安全策略对于没有开发者认证软件的限制，导致 **macOS aarch64** 版本无法直接安装。为了支持**自动更新**，目前 releases 中的 **macOS aarch64** 版本使用的是 **x86** 版本的软件，可能会有一定的兼容性影响（目前没有发现），不影响正常使用。

请看 [releases page](https://github.com/drl990114/MarkFlowy/releases)

## 为什么
在目前，我使用过很多Markdown应用，但没有遇到非常适合我的，我一直希望可以有一款高效、美观、轻量、数据安全并且可以方便的与各种工作流结合的Markdown编辑器，这也是做 MarkFlowy 的初衷。

## 参与

目前 MarkFlowy 仍处于初级阶段，可能会有一些不好的体验或bug。欢迎所有感兴趣或遇到使用问题的合作伙伴提交[issue](https://github.com/drl990114/MarkFlowy/issues/new)或[PR](https://github.com/drl990114/MarkFlowy/compare)参与这个项目。

### 如何贡献

您可以阅读[CONTRIBUTING]（./CONTRIBUTING.md）了解如何启动项目和修改代码，欢迎参与代码贡献。

## 支持

MarkFlowy 是完全永久开源的，如果你想支持 MarkFlowy，你可以`star`这个项目。这会给我们很大的支持和帮助。

## 感谢

- <a href="https://github.com/tauri-apps/tauri" target="_blank">Tauri</a> - 一个用于构建跨平台应用程序的框架，为 MarkFlowy 提供了可靠的基础。
- <a href="https://github.com/facebook/react" target="_blank">React</a> - Web 用户界面框架。
- <a href="https://github.com/remirror/remirror" target="_blank">Remirror</a> - React 的 ProseMirror 工具包，MarkFlowy 编辑器基于此开发。
- <a href="https://github.com/ocavue/rino" target="_blank">Rino</a> - package/editor 有部分初始化代码来源于此。
- <a href="https://github.com/vitejs/vite" target="_blank">Vite</a> - 前端构建工具
- <a href="https://github.com/kimlimjustin/xplorer" target="_blank">Xplorer</a> - 主页主题来自 Xplorer.

另外，感谢所有 MarkFlowy 依赖的开源项目。
