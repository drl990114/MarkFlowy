<div align="center">
  <img align="center" src="./public/logo.png" width="120" height="120" />
</div>

<h1 align="center"/>MarkFlowy <sup><em>alpha</em></sup></h1>

<h4 align="center"><strong><a href="https://github.com/drl990114/MarkFlowy">English</a></strong> | 简体中文</h4>

<div align="center">

[![Build Status][build-badge]][build]
[![App Version][version-badge]][release]
[![Downloads][downloads-badge]][release]
[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fdrl990114%2FMarkFlowy.svg?type=shield)](https://app.fossa.com/projects/git%2Bgithub.com%2Fdrl990114%2FMarkFlowy?ref=badge_shield)
<br/>
[![MIT License][license-badge]][license]
[![Code of Conduct][coc-badge]][coc]
[![Commit Activity][commit-badge]][commit]
<br/>
[![TypeScript-version-icon]](https://www.typescriptlang.org/)
[![Rust-version-icon]](https://www.rust-lang.org/)
[![PRs Welcome][prs-welcome-badge]][prs-welcome]
<br/>
[![codefactor]](https://www.codefactor.io/repository/github/drl990114/markflowy)
[![issues-closed]](https://github.com/drl990114/MarkFlowy/issues?q=sort%3Aupdated-desc+is%3Aissue+is%3Aclosed)
</div>

## ⚠️ MarkFlowy 目前处于 Alpha 阶段

目前 MarkFlowy还处于alpha阶段，建议在有数据备份的情况下使用。

## Features

- **内置 AI**. 当前支持一键导出对话、翻译文章到任何语言以及获取文章摘要，支持`DeepSeek`、`Chatgpt`等大模型让他们成为你的智能助手。
- **超轻量**. MarkFlowy 基于 tauri, 拥有小于 10MB 的体积和更好的性能。
- **高可用性**. MarkFlowy 使用 remirror 作为编辑器核心, 不仅扩展性高，编辑体验也很好。并支持多种编辑模式，如`source code`, `wysiwyg`.
- **自定义主题**. MarkFlowy 支持自定义主题，并且你也可以与他人分享你的主题。

## 下载

支持平台 Linux, macOS 和 Windows.

> [!NOTE]
> 因为苹果安全策略对于没有开发者认证软件的限制，导致 **macOS aarch64** 版本无法直接安装. 你可以通过一下步骤忽略该限制:
> - 打开终端
> - 进入到 `应用` 的目录下. 例如 `/Applications`.
> - 执行 `xattr -cr MarkFlowy.app` 然后打开 app 即可
> - 请确保下载来源: `github releases`.

请看 [releases page](https://github.com/drl990114/MarkFlowy/releases)

## 为什么
在目前，我使用过很多Markdown应用，但没有遇到非常适合我的，我一直希望可以有一款高效、美观、轻量、数据安全并且可以方便的与各种工作流结合的Markdown编辑器，这也是做 MarkFlowy 的初衷。

## 参与

目前 MarkFlowy 仍处于初级阶段，可能会有一些不好的体验或bug。欢迎所有感兴趣或遇到使用问题的合作伙伴提交[issue](https://github.com/drl990114/MarkFlowy/issues/new)或[PR](https://github.com/drl990114/MarkFlowy/compare)参与这个项目。

### 如何贡献

您可以阅读 [CONTRIBUTING](./docs/Community/CONTRIBUTING.md) 来了解如何启动项目和修改代码，欢迎参与代码贡献。

## 支持

MarkFlowy 是完全永久开源的，如果你想支持 MarkFlowy，你可以`star`这个项目。这会给我们很大的支持和帮助。

另外你还可以通过微信或支付宝对我进行赞助，这会给我极大地鼓励。并且也会用于项目后续的发展，如服务器、域名等支出。

[赞助列表](https://drl990114.github.io/sponsor)

| 微信赞助 | 支付宝赞助 |
| :-: | :-: |
| <img src="https://drl990114.github.io/images/wxpay.png" alt="WeChat QRcode" width=200> <br><small>来瓶酒~</small> | <img src="https://drl990114.github.io/images/alipay.png" alt="Wechat QRcode" width=200> <br><small>来杯咖啡~</small> |

## 感谢

- <a href="https://github.com/tauri-apps/tauri" target="_blank">Tauri</a> - 一个用于构建跨平台应用程序的框架，为 MarkFlowy 提供了可靠的基础。
- <a href="https://github.com/facebook/react" target="_blank">React</a> - Web 用户界面框架。
- <a href="https://github.com/remirror/remirror" target="_blank">Remirror</a> - React 的 ProseMirror 工具包，MarkFlowy 编辑器基于此开发。
- <a href="https://github.com/ocavue/rino" target="_blank">Rino</a> - package/editor 有部分初始化代码来源于此。
- <a href="https://github.com/vitejs/vite" target="_blank">Vite</a> - 前端构建工具

另外，感谢所有 MarkFlowy 依赖的开源项目。

<!-- badges -->
[build-badge]: https://img.shields.io/github/actions/workflow/status/drl990114/MarkFlowy/nodejs.yml.svg?style=flat-square
[build]: https://github.com/drl990114/MarkFlowy/actions/workflows/nodejs.yml
[downloads-badge]:  https://img.shields.io/github/downloads/drl990114/MarkFlowy/total?label=downloads&style=flat-square
[license-badge]: https://img.shields.io/badge/license-AGPL-purple.svg?style=flat-square
[license]: https://opensource.org/licenses/AGPL-3.0
[release]: https://github.com/drl990114/MarkFlowy/releases
[prs-welcome-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square
[prs-welcome]: https://github.com/drl990114/MarkFlowy/blob/main/CONTRIBUTING.md
[coc-badge]: https://img.shields.io/badge/code%20of-conduct-ff69b4.svg?style=flat-square
[coc]: https://github.com/drl990114/MarkFlowy/blob/main/CODE_OF_CONDUCT.md
[commit-badge]: https://img.shields.io/github/commit-activity/m/drl990114/MarkFlowy?color=%23ff9900&style=flat-square
[commit]: https://github.com/drl990114/MarkFlowy
[version-badge]: https://img.shields.io/github/v/release/drl990114/MarkFlowy?color=%239accfe&label=version&style=flat-square
[rust-version-icon]: https://img.shields.io/badge/Rust-1.85.0-dea584?style=flat-square
[typescript-version-icon]: https://img.shields.io/github/package-json/dependency-version/drl990114/MarkFlowy/dev/typescript?label=TypeScript&style=flat-square
[codefactor]: https://www.codefactor.io/repository/github/drl990114/markflowy/badge/main?style=flat-square
[issues-closed]: https://img.shields.io/github/issues-closed/drl990114/MarkFlowy.svg?style=flat-square


## License
[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fdrl990114%2FMarkFlowy.svg?type=large)](https://app.fossa.com/projects/git%2Bgithub.com%2Fdrl990114%2FMarkFlowy?ref=badge_large)
