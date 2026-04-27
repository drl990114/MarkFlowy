<!--@nrg.languages=en,zh,ja-->
<!--@nrg.defaultLanguage=en-->
<!--@nrg.fileNamePattern.zh=README_CN.md-->
<!--@nrg.fileNamePattern.ja=README_JA.md-->

<!--@screenshot=./public/show-en.png-->
<!--@screenshot.zh=./public/show-zh.png-->
<!--@screenshot.ja=./public/home-en1.png-->
<div align="center">
  <img align="center" src="./public/logo.png" width="120" height="120" />
</div>

<h2 align="center"/>MarkFlowy <sup><em>beta</em></sup></h2>
<!--zh-->
<div align='center'>
<br>
<em>${en:'Modern and intelligent Markdown editor.', zh:'现代化与智能化的 Markdown 编辑器。', ja:'Modern and intelligent Markdown editor.'}</em>
<br>
<br>
</div>

<!--zh--><!--ja-->
<div align="center">

[![GitHub Repo stars](https://img.shields.io/github/stars/drl990114/MarkFlowy)](https://github.com/drl990114/MarkFlowy)
[![G-Star](https://atomgit.com/drl990114/MarkFlowy/star/badge.svg)](https://atomgit.com/drl990114/MarkFlowy)
[![App Version][version-badge]][release]
[![Downloads][downloads-badge]][release]
<br/>
[![Build Status][build-badge]][build]
[![Code of Conduct][coc-badge]][coc]
[![Commit Activity][commit-badge]][commit]
[![issues-closed]](https://github.com/drl990114/MarkFlowy/issues?q=sort%3Aupdated-desc+is%3Aissue+is%3Aclosed)
<br/>
[![PRs Welcome][prs-welcome-badge]][prs-welcome]
[![TypeScript-version-icon]](https://www.typescriptlang.org/)
[![Rust-version-icon]](https://www.rust-lang.org/)
[![License][license-badge]][license]
[![codefactor]](https://www.codefactor.io/repository/github/drl990114/markflowy)
<!--en-->

<br/>
</div>

<h4 align="center"><strong>English</strong> | <a href="./README_CN.md">简体中文</a> | <a href="./README_JA.md">日本語</a></h4><!--en-->
<h4 align="center"> <a href="https://github.com/drl990114/MarkFlowy">English</a> | <strong>简体中文</strong> | <a href="./README_JA.md">日本語</a></h4><!--zh-->
<h4 align="center"><strong>English</strong> | <a href="./README_CN.md">简体中文</a> | <a href="./README_JA.md">日本語</a></h4><!--ja-->

<img src="${screenshot}" alt="screenshot" />

## ${en:'MarkFlowy is in the reconstruction phase ⚠️', zh:'MarkFlowy 目前处于 Beta 阶段 ⚠️', ja:'MarkFlowy はベータ版です ⚠️'}

At present, MarkFlowy needs about 3 - 6 months to perform reconstruction, which will bring an exciting new version. If there is no major bug in the three months, the new version will not be released.<!--en-->
目前 MarkFlowy 处于 beta 阶段，建议在有数据备份的情况下使用。<!--zh-->
現在、MarkFlowy はベータ版であり、データのバックアップを取ることをお勧めします。<!--ja-->

## ${en:'Features', zh:'功能特性', ja:'機能'}

- **Built-in AI:** Currently supports Copilot, one-click export of dialogues, translation of articles to any language, and article summaries. It supports large models like `DeepSeek` and `Chatgpt`, making them your intelligent assistant.<!--en-->
<!--en-->
- **lightweight:** MarkFlowy is based on Tauri, boasting a size of less than 20MB and improved performance.<!--en-->
<!--en-->
- **Multiple Editing Modes:** MarkFlowy uses Prosemirror as its core editor, offering high extensibility and a superior editing experience. It supports multiple editing modes, such as source code and wysiwyg.<!--en-->
<!--en-->
- **Editing Multiple File Types:** In addition to Markdown, it supports editing `JSON`, `TXT`, and other file types.<!--en-->
<!--en-->
- **Custom Themes:** Supports custom themes, and you can share your themes with others.<!--en-->
<!--en-->
- **Custom Keyboard Shortcuts:** Supports custom keyboard shortcuts to meet individual needs.<!--en-->
<!--en-->
- **Image Processing:** When pasting images into MarkFlowy, you can choose to paste them to a specified path or convert them to `base64`.<!--en-->
<!--en-->
- **File Management**: A powerful file tree that supports drag-and-drop movement, global search, and other common functions.<!--en-->
<!--en-->
- **Multi-language support:** Supports multiple languages ​​including Chinese, English, Spanish, Japanese, and French.<!--en-->
- **内置 AI**：当前支持Copilot、一键导出对话、翻译文章到任何语言以及获取文章摘要，支持`DeepSeek`、`Chatgpt`等大模型让他们成为你的智能助手。<!--zh-->
- **超轻量**：MarkFlowy 基于 tauri, 拥有小于 20MB 的体积和更好的性能。<!--zh-->
- **多编辑模式**：MarkFlowy 使用 prosemirror 作为编辑器核心, 不仅扩展性高，编辑体验也很好。并支持多种编辑模式，如`source code`, `wysiwyg`。<!--zh-->
- **编辑多种文件**：除了 Markdown，还支持编辑 `json`、`txt` 等文件类型。<!--zh-->
- **自定义主题**：支持自定义主题，并且你也可以与他人分享你的主题。<!--zh-->
- **自定义快捷键**：支持自定义快捷键，满足个性化需求。<!--zh-->
- **图片处理**：当你粘贴图片到 MarkFlowy，可以选择粘贴到指定的路径，或者转为 `base64`。<!--zh-->
- **文件管理**：功能强大的文件树，支持拖拽移动、全局搜索等常用功能。<!--zh-->
- **多语言支持**：支持中文、英文、西班牙语、日语、法语等多种语言。<!--zh-->
- **AI搭載:** 現在はCopilot、ワンタッチで会話をエクスポートし、文章を任意の言語に翻訳し、記事の要約を取得することをサポートしており、「DeepSeek `」、「Chatgpt」などの大きなモデルをサポートして、彼らをスマートアシスタントにしています。<!--ja-->
<!--ja-->
- **軽量:** MarkFlowyはTauriをベースにしており、20MB未満のサイズと優れたパフォーマンスを誇ります。<!--ja-->
<!--ja-->
- **複数の編集モード:** MarkFlowyはProsemirrorをコアエディターとして採用し、高い拡張性と優れた編集エクスペリエンスを提供します。ソースコードやWYSIWYGなど、複数の編集モードをサポートしています。<!--ja-->
<!--ja-->
- **複数ファイル形式の編集:** Markdownに加えて、`JSON`、`TXT`などのファイル形式の編集もサポートしています。<!--ja-->
<!--ja-->
- **カスタムテーマ:** カスタムテーマをサポートし、作成したテーマを他のユーザーと共有できます。<!--ja-->
<!--ja-->
- **カスタムキーボードショートカット:** 個々のニーズに合わせてカスタムキーボードショートカットを設定できます。<!--ja-->
<!--ja-->
- **画像処理:** MarkFlowyに画像を貼り付ける際、指定したパスに貼り付けるか、`base64`に変換するかを選択できます。<!--ja-->
<!--ja-->
- **ファイル管理**: ドラッグアンドドロップによる移動、グローバル検索、その他の一般的な機能をサポートする強力なファイルツリー。<!--ja-->
<!--ja-->
- **多言語サポート：** 中国語、英語、スペイン語、日本語、フランス語を含む複数の言語をサポートします。<!--ja-->

## ${en:'Download', zh:'下载', ja:'ダウンロード'}

Available for Linux, macOS and Windows.<!--en-->
支持平台 Linux, macOS 和 Windows.<!--zh-->
Linux、macOS、Windows向けに利用可能です。<!--ja-->

> [!NOTE]
> Because of Apple’s security policy restrictions on software without developer certification, the **macOS aarch64** version cannot be downloaded and used directly. You can ignore the limit by doing the following:<!--en-->
> - Open your terminal<!--en-->
> - Go to the `Applications` directory. .e.g `/Applications`.<!--en-->
> - Run `xattr -cr MarkFlowy.app` and open the app again<!--en-->
> - Please make sure you download from `github releases` or [UpgradeLink](https://download.upgrade.toolsetlink.com/download?appKey=xpn68m4j5qU0Y1rfDYFHaA).<!--en-->
> 因为苹果安全策略对于没有开发者认证软件的限制，导致 **macOS aarch64** 版本无法直接安装. 你可以通过一下步骤忽略该限制:<!--zh-->
> - 打开终端<!--zh-->
> - 进入到 `应用` 的目录下. 例如 `/Applications`.<!--zh-->
> - 执行 `xattr -cr MarkFlowy.app` 然后打开 app 即可<!--zh-->
> - 请确保下载来源: `github releases` 或 [UpgradeLink](https://download.upgrade.toolsetlink.com/download?appKey=xpn68m4j5qU0Y1rfDYFHaA).<!--zh-->
> Appleのセキュリティポリシーにより、開発者認証のないソフトウェアは**macOS aarch64**版を直接ダウンロードして使用できません。以下の手順で制限を回避できます。<!--ja-->
> - terminal を開く<!--ja-->
> - `Applications` ディレクトリに移動します。例: `/Applications`。<!--ja-->
> - `xattr -cr MarkFlowy.app` を実行し、再度アプリを開きます。<!--ja-->
> - `github releases` または [UpgradeLink](https://download.upgrade.toolsetlink.com/download?appKey=xpn68m4j5qU0Y1rfDYFHaA) からダウンロードしてください。<!--ja-->

You can download it from the [UpgradeLink download page](https://download.upgrade.toolsetlink.com/download?appKey=xpn68m4j5qU0Y1rfDYFHaA) or [GitHub Release](https://github.com/drl990114/MarkFlowy/releases)<!--en-->
你可以通过 [UpgradeLink 下载页面](https://download.upgrade.toolsetlink.com/download?appKey=xpn68m4j5qU0Y1rfDYFHaA) 或 [GitHub Release](https://github.com/drl990114/MarkFlowy/releases) 下载.<!--zh-->
[UpgradeLink ダウンロードページ](https://download.upgrade.toolsetlink.com/download?appKey=xpn68m4j5qU0Y1rfDYFHaA) または [GitHub Release](https://github.com/drl990114/MarkFlowy/releases) からダウンロードできます。<!--ja-->

## ${en:'Why', zh:'为什么开发', ja:'動機'}

**Actually, the initial inspiration for MarkFlowy stemmed from a casual conversation with a friend a few years ago**. As developers, we shared many expectations for an ideal Markdown editor. After trying many existing applications, I felt they couldn't fully meet our comprehensive needs in terms of efficiency, aesthetics, lightweight design, and workflow integration. We envisioned our ideal editor together. Although we later went our separate ways and lost touch, that seed of desire to create something beautiful has always remained in my heart.<!--en-->
其实，**创作 MarkFlowy 的最初灵感，源于几年前和一位朋友一次闲聊**，作为开发者，我们对一款理想 Markdown 编辑器有很多的期待。在尝试过许多现有应用后，我感到它们难以完全满足在高效、美观、轻量与工作流融合上的综合需求。我们共同畅想了一款理想中编辑器的模样。尽管后来我们各自奔赴不同的人生，联系渐少，但那颗渴望创造美好的种子，一直在我心里。<!--zh-->
**実は、MarkFlowyの最初のインスピレーションは、数年前の友人との何気ない会話から生まれました**。開発者として、私たちは理想的なMarkdownエディタに多くの期待を抱いていました。既存のアプリケーションを数多く試した結果、効率性、美しさ、軽量設計、ワークフロー統合といった点で、私たちの包括的なニーズを完全に満たすことができないと感じました。そこで、私たちは一緒に理想のエディタを思い描きました。その後、別々の道を歩み、連絡も途絶えてしまいましたが、美しいものを作りたいという思いは、常に私の心の中にありました。<!--ja-->

It was this initial aspiration that propelled me step by step to transform MarkFlowy from a concept into reality. I hope to create a lightweight, intelligent editor that not only handles content securely and reliably but also improves editing efficiency through AI.<!--en-->
最初的念想，推动着我一步步将 MarkFlowy 从构想变为现实。我希望能打造一款轻量、智能的编辑器，让它不仅能安全可靠地处理内容，还能通过 AI 来提高编辑工作的效率。<!--zh-->
この最初の思いが、MarkFlowyを構想から現実へと一歩一歩変えていく原動力となりました。コンテンツを安全かつ確実に処理するだけでなく、AIによって編集効率も向上させる、軽量でインテリジェントなエディタを作りたいと思っています。<!--ja-->

MarkFlowy is a product, and also a testament to a life journey. Through continuous learning and development, it has grown into my response to the concepts of **efficiency, intelligence, and lightweight**. I hope MarkFlowy will become a tool that everyone finds convenient and enjoyable, and I welcome everyone to experience it and provide valuable feedback.<!--en-->
MarkFlowy 是一个产品，也是一段人生旅程的见证。并在一路的学习与构建中，成长为我对**高效、智能、轻量**这些理念的回应，希望 MarkFlowy 能成为一个让大家感到趁手和愉悦的工具，也欢迎大家能来体验，并提出宝贵的意见。<!--zh-->
MarkFlowyは製品であると同時に、私の人生の証でもあります。継続的な学習と開発を通して、**効率性、インテリジェンス、軽量性**というコンセプトに対する私の答えへと成長しました。 MarkFlowy が皆様にとって便利で楽しいツールになることを願っています。皆様に MarkFlowy を体験していただき、貴重なフィードバックを提供していただければ幸いです。<!--ja-->

## ${en:'Contribute', zh:'参与', ja:'Contribute'}

The current MarkFlowy is still in its infancy, and there may be some bad experiences or bugs, for which I am sorry. All partners who are interested or encounter usage problems are welcome to submit [issues](https://github.com/drl990114/MarkFlowy/issues/new) or [PR](https://github.com/drl990114/MarkFlowy/compare) to participate in this project.<!--en-->
目前 MarkFlowy 仍处于初级阶段，可能会有一些不好的体验或bug。欢迎所有感兴趣或遇到使用问题的合作伙伴提交[issue](https://github.com/drl990114/MarkFlowy/issues/new)或[PR](https://github.com/drl990114/MarkFlowy/compare)参与这个项目。<!--zh-->
現在のMarkFlowyはまだ発展途上であり、悪い体験やバグがあるかもしれません。その点についてはお詫び申し上げます。興味のあるパートナーや使用上の問題に直面している方は、[issues](https://github.com/drl990114/MarkFlowy/issues/new)や[PR](https://github.com/drl990114/MarkFlowy/compare)を提出して、このプロジェクトに参加してください。<!--ja-->

### ${en:'How to Contribute', zh:'如何贡献', ja:'How to Contribute'}

You can read [CONTRIBUTING](./docs/en/Community/CONTRIBUTING.md) to know how to start the project and modify the code, Welcome to participate in code contribution.<!--en-->
您可以阅读 [CONTRIBUTING](./docs/en/Community/CONTRIBUTING.md) 来了解如何启动项目和修改代码，欢迎参与代码贡献。<!--zh-->
プロジェクトの開始方法やコードの修正方法については [CONTRIBUTING](./docs/en/Community/CONTRIBUTING.md) をご覧ください。コードへの貢献を歓迎します。<!--ja-->

## ${en:'Support', zh:'支持', ja:'サポート'}

MarkFlowy is completely and permanently open source, if you want to support MarkFlowy, you can `star` this project. For special support, please contact me via [email](mailto:drl990114@gmail.com).<!--en-->
MarkFlowy 是完全永久开源的，如果你想支持 MarkFlowy，你可以`star`这个项目。特殊赞助可以通过 [邮箱](mailto:drl990114@gmail.com) 联系我。<!--zh-->
<!--ja-->
MarkFlowyは完全にオープンソースであり、MarkFlowyをサポートしたい場合は、このプロジェクトに`star`を付けることができます。特別なサポートが必要な場合は、[email](mailto:drl990114@gmail.com)で私に連絡してください。<!--ja-->
<!--ja-->
<!-- <!--en-->
In addition, you can sponsor me through WeChat or Alipay, which will greatly encourage me. And it will also be used for the subsequent development of the project, such as expenses for servers, domains, etc<!--en-->
<!--en-->
[Sponsor](https://drl990114.github.io/sponsor)<!--en-->
<!--en-->
| WeChat appreciates | Alipay appreciates |<!--en-->
| :-: | :-: |<!--en-->
| <img src="https://drl990114.github.io/images/wxpay.png" alt="WeChat QRcode" width=200> <br><small>Let's have a bottle of wine~</small> | <img src="https://drl990114.github.io/images/alipay.png" alt="Wechat QRcode" width=200> <br><small>Have a cup of coffee~</small> | --><!--en-->
<!-- <!--zh-->
另外你还可以通过微信或支付宝对我进行赞助，这会给我极大地鼓励。并且也会用于项目后续的发展，如服务器、域名等支出。<!--zh-->
<!--zh-->
[赞助列表](https://drl990114.github.io/sponsor)<!--zh-->
<!--zh-->
| 微信赞助 | 支付宝赞助 |<!--zh-->
| :-: | :-: |<!--zh-->
| <img src="https://drl990114.github.io/images/wxpay.png" alt="WeChat QRcode" width=200> <br><small>来瓶酒~</small> | <img src="https://drl990114.github.io/images/alipay.png" alt="Wechat QRcode" width=200> <br><small>来杯咖啡~</small> | --><!--zh-->
<!-- また、WeChatやAlipayを通じて私を支援することもでき、これは私にとって大きな励みになります。そして、それはサーバー、ドメインなどのプロジェクトの今後の開発に使用されます。<!--ja-->
<!--ja-->
[Sponsor](https://drl990114.github.io/sponsor)<!--ja-->
<!--ja-->
| WeChat appreciates | Alipay appreciates |<!--ja-->
| :-: | :-: |<!--ja-->
| <img src="https://drl990114.github.io/images/wxpay.png" alt="WeChat QRcode" width=200> <br><small>Let's have a bottle of wine~</small> | <img src="https://drl990114.github.io/images/alipay.png" alt="Wechat QRcode" width=200> <br><small>Have a cup of coffee~</small> | --><!--ja-->

## ${en:'Sponsors', zh:'赞助商', ja:'Sponsors'}

<a href="https://www.toolsetlink.com">
  <img height="54" alt="UpgradeLink" src="./public/sponsors/UpgradeLink_1.png" />
</a>

## Contributors<!--en--><!--ja-->
<!--en--><!--ja-->
The development of **MarkFlowy** cannot be separated from these contributors. They have contributed a lot of abilities to **MarkFlowy**. Meanwhile, welcome to follow them! ❤️<!--en-->
**MarkFlowy** の開発は、これらの貢献者なしには成し得ませんでした。彼らは **MarkFlowy** に多くの能力を提供してくれました。ぜひ彼らをフォローしてください！ ❤️<!--ja-->
<!--en--><!--ja-->
<!--nrg.freeze id="contributors"--><!--en-->
<!-- readme: contributors -start --><!--en-->
<!-- This block is auto-maintained by akhilmhdh/contributors-readme-action --><!--en-->
<!-- readme: contributors -end --><!--en-->
<!--/nrg.freeze--><!--en-->
<!--en--><!--ja-->
<!-- badges -->
[build-badge]: https://img.shields.io/github/actions/workflow/status/drl990114/MarkFlowy/nodejs.yml.svg?style=flat-square&labelColor=black
[build]: https://github.com/drl990114/MarkFlowy/actions/workflows/nodejs.yml?labelColor=black
[downloads-badge]:  https://img.shields.io/github/downloads/drl990114/MarkFlowy/total?label=downloads&style=flat-square&labelColor=black
[license-badge]: https://img.shields.io/badge/license-AGPL-purple.svg?style=flat-square&labelColor=black
[license]: https://opensource.org/licenses/AGPL-3.0?labelColor=black
[release]: https://github.com/drl990114/MarkFlowy/releases?labelColor=black
[prs-welcome-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square&labelColor=black&color=%23dd5c13
[prs-welcome]: https://github.com/drl990114/MarkFlowy/blob/main/CONTRIBUTING.md?labelColor=black
[coc-badge]: https://img.shields.io/badge/code%20of-conduct-ff69b4.svg?style=flat-square&labelColor=black
[coc]: https://github.com/drl990114/MarkFlowy/blob/main/CODE_OF_CONDUCT.md?labelColor=black
[commit-badge]: https://img.shields.io/github/commit-activity/m/drl990114/MarkFlowy?color=%23ff9900&style=flat-square&labelColor=black
[commit]: https://github.com/drl990114/MarkFlowy?labelColor=black
[version-badge]: https://img.shields.io/github/v/release/drl990114/MarkFlowy?color=%239accfe&label=version&style=flat-square&labelColor=black
[rust-version-icon]: https://img.shields.io/badge/Rust-1.85.0-dea584?style=flat-square&labelColor=black
[typescript-version-icon]: https://img.shields.io/github/package-json/dependency-version/drl990114/MarkFlowy/dev/typescript?label=TypeScript&style=flat-square&labelColor=black
[issues-closed]: https://img.shields.io/github/issues-closed/drl990114/MarkFlowy.svg?style=flat-square&labelColor=black
[codefactor]: https://www.codefactor.io/repository/github/drl990114/markflowy/badge/main?style=flat-square&labelColor=black

## License
[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fdrl990114%2FMarkFlowy.svg?type=large)](https://app.fossa.com/projects/git%2Bgithub.com%2Fdrl990114%2FMarkFlowy?ref=badge_large)
