<div align="center">
  <img align="center" src="./public/logo.png" width="120" height="120" />
</div>

<h2 align="center"/>MarkFlowy <sup><em>alpha</em></sup></h2>

<h4 align="center"><strong>English</strong> | <a href="./README_CN.md">简体中文</a></h4>

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
[![PRs Welcome][prs-welcome-badge]][prs-welcome]
[![TypeScript-version-icon]](https://www.typescriptlang.org/)
[![Rust-version-icon]](https://www.rust-lang.org/)
<br/>
[![codefactor]](https://www.codefactor.io/repository/github/drl990114/markflowy)
[![issues-closed]](https://github.com/drl990114/MarkFlowy/issues?q=sort%3Aupdated-desc+is%3Aissue+is%3Aclosed)
</div>

## MarkFlowy is in Alpha

Currently, MarkFlowy is still in the alpha phase,This means there may be incompatible version updates, and it is recommended to use it when there is data backup available. 

## Features

- **Built-in AI**. Currently, it supports one click export of conversations, translation of articles to any language, and obtaining article abstracts. It also supports large models such as `DeepSeek` and `Chatgpt` to make them your intelligent assistants.
- **Super lightweight**. The MarkFlowy is based on tauri and has a volume of less than 10MB and better performance.
- **High availability**. MarkFlowy uses the remirror editor, which not only provides high scalability, but also has a great editing experience. And, MarkFlowy supports multiple editing modes, such as `source code`, `wysiwyg`.
- **Custom Theme**. MarkFlowy supports custom themes, and you can also share your themes with others.

## Download

Available for Linux, macOS and Windows.

> [!NOTE]
> Because of Apple’s security policy restrictions on software without developer certification, the **macOS aarch64** version cannot be downloaded and used directly. You can ignore the limit by doing the following:
> - Open your terminal
> - Go to the `Applications` directory. .e.g `/Applications`.
> - Run `xattr -cr MarkFlowy.app` and open the app again
> - Please make sure you download from `github releases`.

Please look [releases page](https://github.com/drl990114/MarkFlowy/releases)

## Why
At present, I have used many Markdown applications, but I have not encountered one that is very suitable for me. I have always hoped to have a Markdown editor that is efficient, beautiful, lightweight, data-safe, and can be easily combined with various workflows. This It is also the original intention of doing MarkFlowy.

## Contribute

The current MarkFlowy is still in its infancy, and there may be some bad experiences or bugs, for which I am sorry. All partners who are interested or encounter usage problems are welcome to submit [issues](https://github.com/drl990114/MarkFlowy/issues/new) or [PR](https://github.com/drl990114/MarkFlowy/compare) to participate in this project.

### How to Contribute

You can read [CONTRIBUTING](./Community/CONTRIBUTING.md) to know how to start the project and modify the code, Welcome to participate in code contribution.

## Support

MarkFlowy is completely and permanently open source, if you want to support MarkFlowy, you can `star` this project. This will give me great support and help, love you.

In addition, you can sponsor me through WeChat or Alipay, which will greatly encourage me. And it will also be used for the subsequent development of the project, such as expenses for servers, domains, etc

[Sponsor](https://drl990114.github.io/sponsor)

| WeChat appreciates | Alipay appreciates |
| :-: | :-: |
| <img src="https://drl990114.github.io/images/wxpay.png" alt="WeChat QRcode" width=200> <br><small>Let's have a bottle of wine~</small> | <img src="https://drl990114.github.io/images/alipay.png" alt="Wechat QRcode" width=200> <br><small>Have a cup of coffee~</small> |

## Thanks

- <a href="https://github.com/tauri-apps/tauri" target="_blank">Tauri</a> - A framework for building cross-platform applications that provides MarkFlowy with a solid foundation.
- <a href="https://github.com/facebook/react" target="_blank">React</a> - Web user interface framework.
- <a href="https://github.com/remirror/remirror" target="_blank">Remirror</a> - The ProseMirror toolkit for React, on which the MarkFlowy editor is based.
- <a href="https://github.com/ocavue/rino" target="_blank">Rino</a> - Some initialization codes of package/editor come from here.
- <a href="https://github.com/vitejs/vite" target="_blank">Vite</a> - front-end build tool.

And, thanks to all the open source projects that MarkFlowy depends on.

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
