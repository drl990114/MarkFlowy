---
seoTitle: "参与 MarkFlowy 开发"
description: "了解如何配置 MarkFlowy 开发环境并向项目贡献改进。"
updatedAt: "2026-09-27"
---

# 为 MarkFlowy 做贡献

欢迎，并感谢你对 MarkFlowy 的关注与贡献！

## 如何贡献代码

### 前置条件

为下载必要工具、克隆仓库并通过 yarn 安装依赖，你需要可用的网络环境。

你需要准备以下工具：

- [Git](https://git-scm.com/)
- [Node.js](https://nodejs.org/en) 24，与 `.node-version` 一致。
- [Yarn](https://yarnpkg.com/) 4.8.0，由 Corepack 按根目录 `packageManager` 字段选择。
- [Rust](https://www.rust-lang.org/) 1.96，由 rustup 按 `rust-toolchain.toml` 选择。
- 所在系统的 [Tauri 开发依赖](https://v2.tauri.app/start/prerequisites/)。

### 目录

- [为 MarkFlowy 做贡献](#为-markflowy-做贡献)
  - [如何贡献代码](#如何贡献代码)
    - [前置条件](#前置条件)
    - [目录](#目录)
    - [多语言翻译贡献步骤](#多语言翻译贡献步骤)
      - [Fork](#fork)
      - [翻译文件](#翻译文件)
    - [开发工作步骤](#开发工作步骤)
      - [Fork](#fork-1)
      - [安装依赖](#安装依赖)
      - [启动 MarkFlowy](#启动-markflowy)
- [致谢](#致谢)

### 多语言翻译贡献步骤

对于不想跑完整开发环境、仅希望参与翻译的同学，可以参考以下步骤。

#### Fork

Fork [MarkFlowy](https://github.com/drl990114/MarkFlowy) 并执行 `git clone`。

#### 翻译文件

##### 新增一种语言

桌面端翻译位于根目录 `locales`，共享编辑器翻译位于 `locales/editor`，网站翻译位于 `locales/web`。请参考对应界面的英文资源；新增语言还需在对应的语言列表中注册。修改后运行 `yarn translate:check`，这项检查不需要私有运行时。

##### 修改现有语言

修改现有语言可能不太容易找到对应的键。如果在 `locales` 文件中找不到，你可以提 issue，我会帮助你找到相应的修改位置。

### 开发工作步骤

#### Fork

Fork [MarkFlowy](https://github.com/drl990114/MarkFlowy) 并执行 `git clone`。

#### 安装依赖

执行以下命令安装相关依赖：

```bash
corepack enable
yarn install --immutable
```

公开依赖安装不需要 GitHub Packages token。请保留仓库锁文件，以及 `postinstall` 应用的依赖源码补丁。

#### 启动 MarkFlowy

首次启动前，先准备桌面端依赖的工作区产物，再运行开发启动脚本：

```bash
yarn turbo run build --filter='@markflowy/desktop^...' --concurrency=2
yarn dev:desktop
```

启动脚本会检查 Rust 工具链，启动依赖监听，等待产物就绪后启动 Tauri。这些命令会编译开发代码，是环境搭建说明，不代表某次修改已完成原生构建验证。启动当前检出不需要执行 `cargo install`。

### 公开仓库与尚未开源的 Capricorn

Capricorn 编辑器目前尚未开源，其源码仓库和运行时包均不包含在 MarkFlowy 的公开仓库中。克隆 MarkFlowy 不会获得 Capricorn 源码或私有包的访问权限。

未安装 Capricorn 时，公开检出支持 Markdown 源码和阅读模式。实时编辑模式需要私有包 `@drl990114/capricorn-runtime`，其包清单标记为 `UNLICENSED`。`packages/editor` 仍保留 RME 及 ProseMirror/CodeMirror 集成；Capricorn 是独立运行时，并非 RME 源码更新。

具有包访问权限的维护者，可以通过本地环境或根目录已忽略的 `.env` 提供 `GITHUB_PACKAGES_TOKEN` 或 `NODE_AUTH_TOKEN`，再运行：

```bash
yarn install:capricorn-runtime
```

安装器使用 `scripts/install-capricorn-runtime.mjs` 固定的版本和 tarball SHA-256，将包写入已忽略的 `.private-runtime`，并校验包身份。安装后重启开发服务。请勿提交 token、运行时文件或生成的类型声明。Fork PR 不会获得私有包凭据。

### 提交 PR 前的验证

公开仓库贡献者应针对修改行为运行相关单测，并执行桌面端的 `build:types`（实际为 `tsc --noEmit`，同时检查 `src` 和 `tests`）。普通 `test` 不要求安装 Capricorn 私有运行时。RME 仍用于源码模式、预览与导出，其测试继续保留在 `packages/editor`。

涉及 Capricorn 接入的修改，由具备私有包访问权限的维护者安装固定版本运行时后执行 `test:capricorn-published`，验证 MarkFlowy 与真实运行时之间的宿主契约。这是发布流程的必需检查，与普通 `test` 的测试集合互斥，CI 各执行一次。公开检出的回退模式无法证明私有运行时的行为一致。

`test:capricorn-source` 仅供具备 Capricorn 私有源码仓库访问权限的维护者本地联调，使用相同的宿主契约对接相邻的源码检出。私有包访问权限不等于源码访问权限。编辑器内部行为的回归测试由维护者在 Capricorn 私有仓库中维护，不属于公开仓库贡献者的验证要求。

```bash
yarn workspace @markflowy/desktop build:types
yarn workspace @markflowy/desktop test <path-to-test>
# 仅供具备私有包访问权限并已安装固定版本运行时的维护者：
yarn workspace @markflowy/desktop test:capricorn-published
```

仅对修改的 TypeScript 文件使用现有 ESLint 8 工具链，不加 `--fix`：

```bash
node node_modules/@umijs/fabric/node_modules/eslint/bin/eslint.js \
  --resolve-plugins-relative-to node_modules/@umijs/fabric <changed-files>
```

修改原生代码时运行相关 Rust 单测。交接时说明已通过的检查和未执行的原生场景；单测不能证明系统输入法、安装包签名或升级行为已通过验收。

## 如何提交主题到主题商店

MarkFlowy 内置了主题商店功能，用户可以浏览、下载和安装社区创建的主题。如果你想将自己的主题提交到主题商店供其他用户使用，请参考 [自定义主题文档](https://www.markflowy.cc/zh/docs/Extension/CustomTheme) 中的"分享你的主题"部分，该文档详细介绍了主题创建的完整流程和提交到主题商店的具体步骤。

# 致谢

无论大小，你对开源项目的贡献都会让它变得更好。感谢你抽出时间为 MarkFlowy 做出贡献！

