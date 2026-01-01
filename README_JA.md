<div align="center">
  <img align="center" src="./public/logo.png" width="120" height="120" />
</div>

<h2 align="center"/>MarkFlowy <sup><em>beta</em></sup></h2>
<div align='center'>
<br>
<em>Modern and intelligent Markdown editor.</em>
<br>
<br>
</div>

<div align="center">

[![Build Status][build-badge]][build]
[![App Version][version-badge]][release]
[![Downloads][downloads-badge]][release]
<br/>
[![PRs Welcome][prs-welcome-badge]][prs-welcome]
[![MIT License][license-badge]][license]
[![Code of Conduct][coc-badge]][coc]
[![codefactor]](https://www.codefactor.io/repository/github/drl990114/markflowy)
<br/>
[![TypeScript-version-icon]](https://www.typescriptlang.org/)
[![Rust-version-icon]](https://www.rust-lang.org/)
[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fdrl990114%2FMarkFlowy.svg?type=shield)](https://app.fossa.com/projects/git%2Bgithub.com%2Fdrl990114%2FMarkFlowy?ref=badge_shield)
<br/>
[![Commit Activity][commit-badge]][commit]
[![issues-closed]](https://github.com/drl990114/MarkFlowy/issues?q=sort%3Aupdated-desc+is%3Aissue+is%3Aclosed)
</div>

<h4 align="center"><strong>English</strong> | <a href="./README_CN.md">简体中文</a> | <a href="./README_JA.md">日本語</a></h4>

<img src="./public/home-en1.png" alt="screenshot" />

## MarkFlowy はベータ版です ⚠️

現在、MarkFlowy はベータ版であり、データのバックアップを取ることをお勧めします。

## 機能

- **AI搭載:** ダイアログのワンクリックエクスポート、記事のあらゆる言語への翻訳、記事の要約作成に対応しています。`DeepSeek`や`Chatgpt`といった大規模なモデルにも対応しており、インテリジェントなアシスタントとして活躍します。

- **軽量:** MarkFlowyはTauriをベースにしており、20MB未満のサイズと優れたパフォーマンスを誇ります。

- **複数の編集モード:** MarkFlowyはProsemirrorをコアエディターとして採用し、高い拡張性と優れた編集エクスペリエンスを提供します。ソースコードやWYSIWYGなど、複数の編集モードをサポートしています。

- **複数ファイル形式の編集:** Markdownに加えて、`JSON`、`TXT`などのファイル形式の編集もサポートしています。

- **カスタムテーマ:** カスタムテーマをサポートし、作成したテーマを他のユーザーと共有できます。

- **カスタムキーボードショートカット:** 個々のニーズに合わせてカスタムキーボードショートカットを設定できます。

- **画像処理:** MarkFlowyに画像を貼り付ける際、指定したパスに貼り付けるか、`base64`に変換するかを選択できます。

- **ファイル管理**: ドラッグアンドドロップによる移動、グローバル検索、その他の一般的な機能をサポートする強力なファイルツリー。

- **Git管理**: Gitリポジトリを迅速かつ簡単に管理する方法を提供し、Gitをリポジトリ同期ソリューションとして活用しやすくします。

- **多言語サポート：** 中国語、英語、スペイン語、日本語、フランス語を含む複数の言語をサポートします。

## ダウンロード

Linux、macOS、Windows向けに利用可能です。

> [!NOTE]
> Appleのセキュリティポリシーにより、開発者認証のないソフトウェアは**macOS aarch64**版を直接ダウンロードして使用できません。以下の手順で制限を回避できます。
> - terminal を開く
> - `Applications` ディレクトリに移動します。例: `/Applications`。
> - `xattr -cr MarkFlowy.app` を実行し、再度アプリを開きます。
> - `github releases` または [UpgradeLink](https://download.upgrade.toolsetlink.com/download?appKey=xpn68m4j5qU0Y1rfDYFHaA) からダウンロードしてください。

[UpgradeLink ダウンロードページ](https://download.upgrade.toolsetlink.com/download?appKey=xpn68m4j5qU0Y1rfDYFHaA) または [GitHub Release](https://github.com/drl990114/MarkFlowy/releases) からダウンロードできます。

## 動機

**実は、MarkFlowyの最初のインスピレーションは、数年前の友人との何気ない会話から生まれました**。開発者として、私たちは理想的なMarkdownエディタに多くの期待を抱いていました。既存のアプリケーションを数多く試した結果、効率性、美しさ、軽量設計、ワークフロー統合といった点で、私たちの包括的なニーズを完全に満たすことができないと感じました。そこで、私たちは一緒に理想のエディタを思い描きました。その後、別々の道を歩み、連絡も途絶えてしまいましたが、美しいものを作りたいという思いは、常に私の心の中にありました。

この最初の思いが、MarkFlowyを構想から現実へと一歩一歩変えていく原動力となりました。コンテンツを安全かつ確実に処理するだけでなく、AIによって編集効率も向上させる、軽量でインテリジェントなエディタを作りたいと思っています。

MarkFlowyは製品であると同時に、私の人生の証でもあります。継続的な学習と開発を通して、**効率性、インテリジェンス、軽量性**というコンセプトに対する私の答えへと成長しました。 MarkFlowy が皆様にとって便利で楽しいツールになることを願っています。皆様に MarkFlowy を体験していただき、貴重なフィードバックを提供していただければ幸いです。

## Contribute

現在のMarkFlowyはまだ発展途上であり、悪い体験やバグがあるかもしれません。その点についてはお詫び申し上げます。興味のあるパートナーや使用上の問題に直面している方は、[issues](https://github.com/drl990114/MarkFlowy/issues/new)や[PR](https://github.com/drl990114/MarkFlowy/compare)を提出して、このプロジェクトに参加してください。

### How to Contribute

プロジェクトの開始方法やコードの修正方法については [CONTRIBUTING](./docs/en/Community/CONTRIBUTING.md) をご覧ください。コードへの貢献を歓迎します。

## サポート

MarkFlowyは完全にオープンソースであり、MarkFlowyをサポートしたい場合は、このプロジェクトに`star`を付けることができます。特別なサポートが必要な場合は、[email](mailto:drl990114@gmail.com)で私に連絡してください。

<!-- また、WeChatやAlipayを通じて私を支援することもでき、これは私にとって大きな励みになります。そして、それはサーバー、ドメインなどのプロジェクトの今後の開発に使用されます。

[Sponsor](https://drl990114.github.io/sponsor)

| WeChat appreciates | Alipay appreciates |
| :-: | :-: |
| <img src="https://drl990114.github.io/images/wxpay.png" alt="WeChat QRcode" width=200> <br><small>Let's have a bottle of wine~</small> | <img src="https://drl990114.github.io/images/alipay.png" alt="Wechat QRcode" width=200> <br><small>Have a cup of coffee~</small> | -->

## Sponsors

<a href="https://www.toolsetlink.com">
  <img height="54" alt="UpgradeLink" src="./public/sponsors/UpgradeLink_1.png" />
</a>

## Contributors

**MarkFlowy** の開発は、これらの貢献者なしには成し得ませんでした。彼らは **MarkFlowy** に多くの能力を提供してくれました。ぜひ彼らをフォローしてください！ ❤️

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
