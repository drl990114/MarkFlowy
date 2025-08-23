# 为 MarkFlowy 做贡献

欢迎，并感谢你对 MarkFlowy 的关注与贡献！

## 如何贡献代码

### 前置条件

为下载必要工具、克隆仓库并通过 yarn 安装依赖，你需要可用的网络环境。

你需要准备以下工具：

- [Git](https://git-scm.com/)
- [Node.js](https://nodejs.org/en) >= 20.x
- [yarn](https://yarnpkg.com/) >= 4.0.0
- [Rust](https://www.rust-lang.org/) >= 1.79.0

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

为方便大家参与，项目根目录的 `locales` 中存放了翻译文件。如果你想新增一种语言，可以直接参考 `en.json` 进行翻译。

### 开发工作步骤

#### Fork

Fork [MarkFlowy](https://github.com/drl990114/MarkFlowy) 并执行 `git clone`。

#### 安装依赖

执行以下命令安装相关依赖：

```bash
yarn install --immutable

cargo install --locked --path apps/desktop/src-tauri
```

#### 启动 MarkFlowy

注意：首次启动前，需要执行 `yarn build` 来编译工作区里的包。

执行以下命令即可启动 MarkFlowy：

```bash
yarn dev:desktop
```

# 致谢

无论大小，你对开源项目的贡献都会让它变得更好。感谢你抽出时间为 MarkFlowy 做出贡献！



