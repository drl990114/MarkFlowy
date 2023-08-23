<h4 align="right"><strong><a href="https://github.com/linebyline-group/linebyline">English</a></strong> | 简体中文</h4>

<div align="center">
  <img align="center" src="./public/logo.svg" width="120" height="130" />
</div>

<h1 align="center"/>LineByLine <sup><em>alpha</em></sup></h1>

<h4 align="center">现代 Markdown 编辑器.(WIP)</h3>

<p align="center">
  <a href="https://github.com/vitejs/vite/actions/workflows/ci.yml"><img src="https://github.com/linebyline-group/linebyline/actions/workflows/nodejs.yml/badge.svg?branch=main&color=%23fe7d27" alt="build status"></a>
  <a href="https://github.com/linebyline-group/linebyline/releases" target="__blank"><img alt="GitHub downloads" src="https://img.shields.io/github/downloads/linebyline-group/linebyline/total?label=Downloads&color=%23fe7d37"></a>
  <a href="https://github.com/linebyline-group/linebyline/releases" target="__blank"><img alt="GitHub release (latest by date)" src="https://img.shields.io/github/v/release/linebyline-group/linebyline?label=Version"></a>
  <a href="https://github.com/linebyline-group/linebyline" target="__blank"><img alt="GitHub" src="https://img.shields.io/github/commit-activity/w/linebyline-group/linebyline?color=%2346bd1b"></a>
  <a href="https://www.rust-lang.org/" target="__blank"><img alt="GitHub" src="https://img.shields.io/badge/Rust-1.70.0-dea584"></a>
</p>

## ⚠️ LineByLine 目前处于 Alpha 阶段

目前 LineByLine还处于alpha阶段，建议在有数据备份的情况下使用。

## Feature

- **内置ChatGpt**. 当前支持一键导出笔记，让ChatGPT成为你的智能助手。
- **超轻量**. linebyline 基于 tauri, 拥有小于 10MB 的体积和更好的性能。
- **高可用性**. linebyline 使用 remirror 作为编辑器核心, 不仅扩展性高，编辑体验也很好。并支持多种编辑模式，如`dual`, `wysiyg`.

## 下载

支持平台 Linux, macOS 和 Windows.

请看 [releases page](https://github.com/linebyline-group/linebyline/releases)

## 为什么
在目前，我使用过很多Markdown应用，但没有遇到非常适合我的，我一直希望可以有一款高效、美观、轻量、数据安全并且可以方便的与各种工作流结合的Markdown编辑器，这也是做linebyline的初衷。

## 参与

目前 linebyline 仍处于初级阶段，可能会有一些不好的体验或bug。欢迎所有感兴趣或遇到使用问题的合作伙伴提交[issue](https://github.com/linebyline-group/linebyline/issues/new)或[PR](https://github.com/linebyline-group/linebyline/compare)参与这个项目。

### 如何贡献

您可以阅读[CONTRIBUTING]（./CONTRIBUTING.md）了解如何启动项目和修改代码，欢迎参与代码贡献。

## 支持

linebyline是完全永久开源的，如果你想支持linebyline，你可以`star`这个项目。这会给我们很大的支持和帮助。

## 感谢

- <a href="https://github.com/tauri-apps/tauri" target="_blank">Tauri</a> - 一个用于构建跨平台应用程序的框架，为 linebyline 提供了可靠的基础。
- <a href="https://github.com/facebook/react" target="_blank">React</a> - Web 用户界面框架。
- <a href="https://github.com/remirror/remirror" target="_blank">Remirror</a> - React 的 ProseMirror 工具包，linebyline 编辑器基于此开发。
- <a href="https://github.com/ocavue/rino" target="_blank">Rino</a> - package/editor 有部分初始化代码来源于此。
- <a href="https://github.com/vitejs/vite" target="_blank">Vite</a> - 前端构建工具

## 截图

### 首页

![index](./public/screenshots/index.png)

### 暗黑模式

![dark mode](./public/screenshots/darkmode.png)

### 双屏模式

![dual mode](./public/screenshots/dualmode.png)

### 一键导出 ChatGPT 记录

![chatgpt](./public/screenshots/chatgpt.png)
