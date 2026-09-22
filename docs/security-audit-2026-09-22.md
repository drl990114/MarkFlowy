# GitHub 安全告警修复记录（2026-09-22）

本轮在 `v1` 分支进行。先将原有主题预览修改本地提交为 `98875862`（`fix: preview themes only after explicit navigation`），再以该提交为依赖基线开展安全修复。安全修复尚未推送。

## 审计口径与结果

从 [MarkFlowy Dependabot](https://github.com/drl990114/MarkFlowy/security/dependabot) API 获取全部开放告警，按告警对应的 manifest、包名和受影响版本范围，对比基线与当前 `yarn.lock` / `Cargo.lock`。GitHub 的逗号分隔版本条件按交集处理；同一个包可能对应多条告警。

| 严重程度 | GitHub 开放告警 / 基线匹配 | 当前本地仍匹配 | 本地减少 |
| --- | ---: | ---: | ---: |
| Critical | 9 | 0 | 9 |
| High | 113 | 2 | 111 |
| Medium | 107 | 5 | 102 |
| Low | 23 | 1 | 22 |
| 合计 | 252 | 8 | 244 |

这是依赖版本比对结果，不等同于漏洞可达性证明，也不是 GitHub 已关闭告警的数量。远端默认分支为 `main`，目前仍有 252 条开放告警；修复进入默认分支并由 GitHub 重新分析后，才能确认远端关闭结果。

另执行 `yarn npm audit --all --recursive --json`：剩余 **7 条 npm 安全告警**（2 High、4 Moderate、1 Low），与上表的 npm 部分一致；另有 24 条弃用提示，未把它们计入漏洞数。Rust 的 `glib` 为第 8 条剩余告警。Code scanning API 返回 0 条开放告警；secret scanning 当前未启用，不能据此声称已经完成密钥扫描。

## 已实施的修复

- 更新 Web 的 Next.js 至 `16.3.5`，Desktop 的 React Router 至 `7.18.4`；更新 DOMPurify `3.4.15`、Mermaid `11.17.2`、Markdown-it `14.3.2`、Lodash `4.18.1` 等实际锁定版本。
- 更新 Rollup、esbuild、PostCSS、Vitest、Happy DOM、Less、ESLint 及受影响的传递依赖。当前 esbuild 统一为 `0.28.2`，Happy DOM 为 `20.14.5`，Vitest 为 `4.1.11`。
- Zens 的旧 `gulp-cssnano` 链改为 `gulp-postcss` + cssnano 7，复用现有 PostCSS 能力，并保持不重排 z-index、不重命名动画标识的约束。
- RME playground 使用 esbuild 原生 Markdown 文本 loader，移除带入旧 Marked 的 `esbuild-plugin-markdown`，同步更新文本导入和声明。三个示例文件内容保持一致。
- 移除经调用搜索确认未使用的 `webdriverio` 和 `@rollup/plugin-terser` 直接依赖。
- Rust 更新 `openssl`、`openssl-sys`、`quinn-proto`、`rand` 和 `tokio`。文件搜索剪贴板复用项目已采用的 `arboard`，移除旧 `clipboard → x11-clipboard → xcb` 链，初始化失败时报告错误而非 panic。
- Happy DOM 20 把普通 Alt 错报为 AltGraph。新增局部测试事件助手，按 `modifierAltGraph` 显式区分两者，并保留真正 AltGraph 的用例；生产快捷键逻辑没有因测试环境问题而改变。

### 需要保留兼容性依据的 resolutions

优先更新父依赖与原有主版本；仅对已经检查过调用方式的旧依赖添加定向 resolution。后续升级父包时应重新评估并移除不再需要的条目。

| 定向处理 | 兼容性依据与验证 |
| --- | --- |
| `@tauri-release/cli → @actions/github 6.0.1` | 保留 CommonJS 和现有 `context`、`getOctokit`、`rest.repos` 调用；构造检查通过，原有 patch-package 补丁仍可应用。未执行发布请求。 |
| Undici 5 的三个旧范围 → `6.28.1` | 保留现有 `Agent` / `fetch` 调用形式；检查自定义 lookup 的 Agent 构造及关闭。 |
| `remark-mdx-frontmatter → toml 4.3.0` | 保留 `parse()`；实际 MDX frontmatter 编译、深度限制、原型键隔离回归通过。 |
| `external-editor → tmp 0.2.7` | 临时文件创建、读写、清理检查通过。 |
| `@umijs/plugin-run → tsx 4.23.15` | 通过 Umi 自身的 `getBinPath()` 找到新 CLI，执行带类型语法及参数的脚本通过。 |
| `@utoo/pack → send 0.19.2` | 保留 0.x 文件服务 API；本地 HTTP 回归覆盖完整文件、Range 响应及带有特殊字符和恶意查询参数的目录重定向响应。 |
| `html2sketch` / `mdx-bundler → uuid 11.1.1` | 两个调用者只使用 `v4()`；通过各自 CommonJS 解析路径生成并验证 UUID v4。避免强制迁移到仅 ESM 的后续主版本。 |
| Umi 旧 React Router 6.3 → `6.30.6` | 先消除旧 6.x 可兼容修复的告警；需要 7.x 的两条告警仍明确保留在下表。 |
| 其他精确旧版本选择器 | Babel runtime、Lodash、Less、PostCSS、Nano ID、qs、YAML、path-to-regexp、cross-spawn、xmldom 等更新到修补版本，避免跨无关主版本统一覆盖。 |

## 尚未解决的 8 条告警

没有 dismiss 或隐藏这些告警。剩余链条需要上游适配或专门的迁移验证，不能把单独改锁文件视作完成修复。

| 告警 | 等级 | 本地包 / 版本 | 来源与下一步 |
| --- | --- | --- | --- |
| [#416](https://github.com/drl990114/MarkFlowy/security/dependabot/416) | High | `@opentelemetry/propagator-jaeger 1.30.1` | `contentlayer2 → @contentlayer2/utils → sdk-trace-node`。修复要求 2.9.0；需迁移 Contentlayer 的整套 OpenTelemetry SDK 或采用经过验证的上游回补。 |
| [#21](https://github.com/drl990114/MarkFlowy/security/dependabot/21) | High | `nth-check 1.0.2` | `zens → dumi → html2sketch → svgo-browser → css-select 2`。修复要求 2.0.1；新版 nth-check 的 CommonJS 导出形式与旧调用者不同，应升级 SVG/CSS 解析链并验证转换行为。 |
| [#364](https://github.com/drl990114/MarkFlowy/security/dependabot/364) | Medium | `@opentelemetry/core 1.30.1` | 同一 Contentlayer 链，修复要求 2.8.0。现有代码仍使用 `new Resource(...)` 等旧接口，不单独强制替换核心包。 |
| [#501](https://github.com/drl990114/MarkFlowy/security/dependabot/501) | Medium | `decode-uri-component 0.2.2` | `dumi → html2sketch → css → source-map-resolve`。修复要求 0.5.0；旧父包使用 CommonJS，补丁版为 ESM，应随解析链迁移处理。 |
| [#452](https://github.com/drl990114/MarkFlowy/security/dependabot/452)、[#449](https://github.com/drl990114/MarkFlowy/security/dependabot/449) | Medium × 2 | `react-router 6.30.6` | dumi/Umi 文档工具链仍依赖 Router 6；补丁要求 7.18.0。Desktop 的直接 Router 7 已修复；文档工具链需要完整验证后迁移。 |
| [#83](https://github.com/drl990114/MarkFlowy/security/dependabot/83) | Medium | `glib 0.18.5` | Tauri / Wry 的 Linux GTK3 链；补丁要求 0.20.0。需要兼容的 Tauri/GTK 上游升级或回补，不能跨 GTK 公共类型体系强制替换。 |
| [#339](https://github.com/drl990114/MarkFlowy/security/dependabot/339) | Low | `elliptic 6.6.1` | Umi/Webpack 的 `node-libs-browser → crypto-browserify` 链。公告没有修补版本，需要上游替换旧密码学 polyfill 链。 |

应优先处理上述两条 High，并验证真实 Contentlayer 内容处理和 SVG 转换流程。这里记录的是依赖链归属；未完成逐条生产漏洞可达性分析，不能仅凭“文档工具链”就认定没有风险。

## 验证结果与边界

以下命令均在本地执行，JavaScript 命令使用 Node 24（`fnm exec --using=24`）。按本次要求，未执行应用打包 build。

| 验证 | 结果 |
| --- | --- |
| `yarn install --immutable --mode=skip-build` | 通过；保留现有 peer dependency 警告。 |
| `yarn postinstall` | `@tauri-release/cli@0.2.5` 补丁应用通过。 |
| `yarn workspace @markflowy/desktop test` | 222 个文件、1331 项通过。 |
| `yarn workspace rme test` | 40 个文件、341 项通过。 |
| `yarn workspace @markflowy/web test` | 23 项通过。 |
| `yarn test:dev-desktop` | 6 项通过。 |
| `yarn test:security-dependencies` | 新增的 9 项依赖兼容性和安全回归通过。 |
| `cargo test -p mf_file_search --lib` | 3 项通过。 |
| `cargo test -p markflowy --lib` | 107 项通过、1 项忽略。 |
| Desktop / Web `build:types` | 均通过；脚本仅执行 `tsc --noEmit`。 |
| RME 修改的 playground 文件独立 `tsc --noEmit` | 通过。 |
| 修改的 10 个 TS / TSX 文件 ESLint 8 | 0 错误；原有 `contentMap` 索引签名样式警告 1 条。 |
| Zens 实际 Less → PostCSS → cssnano stream 冒烟 | 通过；内存中验证压缩、z-index 与 keyframe 名称，无生成输出文件。 |
| `git diff --check` | 通过。 |

ESLint 的旧配置须使用同一 ESLint 8 工具链的插件，避免被根目录 ESLint 9 的规则实现干扰。本轮使用：

```sh
node node_modules/@umijs/fabric/node_modules/eslint/bin/eslint.js \
  --resolve-plugins-relative-to node_modules/@umijs/fabric \
  <本轮修改的 TS / TSX 文件>
```

RME **全量** `tsc --noEmit` 未通过，有 36 条诊断，涉及 Remirror 类型来源、既有空值处理、主题类型、i18n 类型及隐式 any。在隔离目录中取出 `98875862` 的 RME 源码、使用同一升级后的依赖运行相同检查，诊断逐条一致。本次源码修改未增加诊断，但这个对照不是升级前依赖环境的完整验证，不能把 RME 全量类型检查写成通过。

未执行应用构建、真实 Tauri/WebView 交互、Linux GTK 实机、真实剪贴板操作、生产部署或发布验证。当前证据限于上面列出的类型、单元测试和局部兼容性检查。

## 上游依据

- [Next.js 安全公告](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4)：用于确认 Web 更新应覆盖的安全修补线。
- [gulp-postcss](https://github.com/postcss/gulp-postcss)、[cssnano 配置](https://cssnano.github.io/cssnano/docs/config-file/)：用于替换旧压缩链并保留配置意图。
- [arboard Clipboard](https://docs.rs/arboard/latest/arboard/struct.Clipboard.html)：复用现有跨平台剪贴板接口。
- [TOML 解析器](https://github.com/BinaryMuse/toml-node)：确认新版解析接口与安全边界。
- [send 变更记录](https://github.com/pillarjs/send/blob/master/HISTORY.md)、[UUID 安全公告](https://github.com/advisories/GHSA-w5hq-g745-h8pq)：用于选择保留调用接口的修补版本。
- [W3C EventModifierInit](https://w3c.github.io/uievents/#dom-eventmodifierinit-modifieraltgraph)：测试事件应显式区分 Alt 与 AltGraph。
