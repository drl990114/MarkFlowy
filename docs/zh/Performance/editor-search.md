# 编辑器搜索与源码定位

本轮覆盖 Capricorn 所见即所得、Source Code，以及代码、Mermaid、HTML、公式的实时预览。独立只读 Preview 不在此范围。当前修复已随 **Capricorn 0.1.24** 发布，MarkFlowy 已更新版本和 SHA 锁定，并安装对应正式私有运行时。

## 宿主与编辑器的分工

宿主在 window 捕获阶段处理配置中的文档查找快捷键，关闭 Capricorn 内置的同名默认绑定。重复调用只聚焦现有输入框，保留查询；组合输入时不执行查找。入口使用活动文件和活动分栏对应的已注册实例。

查找栏位于活动分栏的 editor tabs 下方。分栏切换保留关键词并交接查找所有权；焦点请求只消费一次，重新挂载查找栏不会抢走正文焦点。

`editorSearchStore` 只保存临时查找状态。文档查找与全局结果定位共用 `useEditorSearchController`，以来源、文件、分栏、实例及请求序号区分操作。每次操作持有 AbortController；跨文件、模式切换、实例替换、关闭查找和加载失败会取消旧操作。实例上的所有权凭据防止旧 React 组件清理新的查找。

定位去重同时校验请求序号和实际 find API。释放实例会清除它的已定位记录；同一文件更换实例或暂时撤销后重新注册时，仍有效的全局请求会重新生成高亮。

全局搜索保存实际执行的关键词和大小写选项。结果列表序号只用于显示；点击时发送原行文本及坐标：行从 1 开始，列为 UTF-16、从 0 开始的半开区间。文件打开后，由现有实例注册通知继续定位，不再从点击事件与 effect 各执行一次查找。

搜索结果可能来自尚未展开的目录。点击先复用文件缓存或文件树中的身份；缺失时使用现有 `createFile` 注册元数据，再由 `TextEditor` 读取内容。缓存缺失不会被误判为内容过期，后续目录加载沿用相同文件 ID。Windows 路径写法差异复用已有身份，不覆盖未保存内容。

Source Code 直接使用已有 CodeMirror Text 文档树计算和选择位置。Capricorn 将源码位置映射到模型范围；隐藏链接地址和语法定位到所属块，实时预览命中展开源码。位置或原行上下文不能可靠对应时返回过期状态，不回退到另一个同名词。

源码位置映射不能把保存时生成的 Markdown 当作原始输入：保存 codec 会转义普通标点。原行与模型语义校验通过后，优先在当前源码游标逐字对应 Text，保留 UTF-16 偏移；不向后搜索另一份同名文本。这样带链接的列表中 `-`、逗号、句号不会让未编辑内容被误报过期，也不改变保存的转义规则。

`TextEditor.tsx` 继续独占 Markdown、保存、缓存、同步和 dirty 状态。新增索引不读取或发布另一份宿主 Markdown。

## 查询和导航成本

参考 [CodeMirror 搜索实现](https://github.com/codemirror/search/blob/main/src/search.ts)，复用现有 CodeMirror、虚拟化和 UI，没有新增依赖。

- 输入即时更新，查询防抖 100ms；查询约每 8ms 让出主线程，并在块之间、文本投影和超长单块扫描中检查取消状态。仅发布完整且仍有效的一次结果。
- 同一文档、关键词与大小写条件复用命中集合。换查询时复用已有块文本投影，编辑后按不可变块身份复用未变部分。缓存成本与当前文档投影及命中数有关。
- `find.searchAsync`、`find.navigateTo`、`find.revealSourceMatch` 为新增接口；同步接口继续保留。查找快照共享冻结的命中数组，焦点、显隐和活动序号不复制全部结果。
- 导航只刷新旧命中、目标块及可见区域。超长 Text 复用现有分窗，二分查找窗口内的命中，仅生成窗口内高亮。高亮没有改变节点结构时复用节点路径表，避免重建整篇文档的索引。
- Markdown codec 记录原行与语义上下文。源码映射缓存按块身份复用；初次按行建立索引可分片取消。定位只校验目标块，不序列化全文。编辑后的不确定映射会保守地报告过期。

8ms 是协作式任务分片目标，单次底层字符串操作、React 渲染或首次索引初始化仍可能超过它；它不是端到端延迟保证。

## 本地源码联调

默认目录布局为同级的 `markflowy` 和 `capricorn`，两仓依赖已安装。使用 Node 24：

```sh
# 在 MarkFlowy 根目录运行：联调测试自身也执行类型检查。
yarn workspace @markflowy/desktop test:capricorn-source

# 使用同一组用例检查当前锁定、实际安装的私有包。
yarn workspace @markflowy/desktop test:capricorn-published

# 非同级目录时指定 Capricorn 源码目录。
CAPRICORN_SOURCE_ROOT=/absolute/path/to/capricorn yarn workspace @markflowy/desktop test:capricorn-source
```

独立 `vitest.capricorn-source.config.ts` 仅在这个命令中把虚拟运行时模块指向邻仓 `src/release/index.tsx`，并统一 React、React DOM 及 hooks shim 的解析。生产运行时解析、私有包安装、版本和 SHA 校验不变。旧运行时缺少源码定位 API 时，宿主明确提示升级。

Desktop 的 Vitest 配置还让实际 RME 包使用现有主题的 ESM 入口，防止 Node 测试混用 CommonJS/ESM 两套 CodeMirror 类。这一调整只作用于测试，不替换真实编辑器或搜索实现。

`capricornSearch.publishedRuntime.test.tsx` 将同一组搜索用例接入 Desktop 常规 Vitest。独立的 `test:capricorn-published` 命令保留生产解析器，且在锁定包缺失时直接报错，避免把未执行的验证误记为通过。

## 回归与证据范围

宿主测试覆盖捕获快捷键、自定义与禁用绑定、IME、重复打开、StrictMode、活动分栏、跨文件快速点击、实例就绪和销毁、加载失败、所有权交接、Source Code 原生坐标、替换与撤销。全局结果测试覆盖实际查询与大小写、中文/emoji、CRLF 和同一行的重复词。

源码联调直接运行邻仓 release 入口，覆盖可见文本、隐藏地址、代码及 Mermaid/HTML/公式源码、替换与撤销、10,000 块尾部定位、50,000 个密集命中的文本分窗。模型测试覆盖 2 MiB、10 MiB、100,000 块、扫描边界、取消和编辑后的过期结果；断言连续导航共享命中集合、复用块投影及路径表。

下面记录模型脚本的冷暖查询与导航数据。导航测试中的虚拟化流程使用替身；实际挂载范围另由 DOM 联调断言。结果不代表真实 Tauri/WebView、原生输入法或用户 P95 性能。

2026-09-06，本机 macOS、Node 24.14.1，独立运行 `tests/test-find-source.mjs` 的一次记录：

| 样本与操作 | 冷路径 | 后续路径 |
| --- | --- | --- |
| 100,000 块查询 | 168.9ms | 相同查询缓存命中 0.015ms |
| 100,000 块导航 | 333.46ms | 后续 12 次中位数 0.55ms，最大 0.95ms |
| 2 MiB 单块查询 | 0.5ms | 0.3、0.2、0.2、0.2ms |
| 10 MiB 单块查询 | 2.2ms | 1.2、1.1、1.1、1.0ms |

单块样本为 ASCII 文本，末尾有两处 `needle`；后续查询交替搜索 `absent` 和 `needle`，复用投影但重新扫描。冷导航包含模型路径索引等首次初始化成本。这里没有把多次运行汇总成 P95，也没有用稀疏命中数据推断密集命中的延迟。

源码实现阶段验证结果：Desktop 相关 Vitest 516 项通过，原有可选源码入口测试 2 项跳过；新增独立跨仓源码联调 11 项全部通过。Capricorn 全套 112 组运行时/契约测试及 10 个 TypeScript 测试文件通过。两仓类型检查、翻译检查和改动文件 lint 通过；Desktop lint 保留 TextEditor 原有的 8 条警告，已与 HEAD 基线逐项比较。

## 0.1.22 发布与集成

发布标签为 `capricorn-v0.1.22`，提交 `e80014b6fa7080a79c9e876d55e62745fc505cca`。[发布 CI](https://github.com/drl990114/capricorn/actions/runs/34042050162) 的完整检查、私有包打包审计和发布均通过。CI 清单的源码指纹已与该提交的本地发布输入一致性校验通过。

- 包：`@drl990114/capricorn-runtime@0.1.22`
- tarball SHA-256：`dfd7e33a385ac6755063da8fe9f8a7f9b4eb4f744d45eec2707a06e429e98ab0`
- 源码指纹：`fdbba1babca65c8ccc7248dd3f36aa0f24808ab60b8544cb49e797b35ef792e4`
- 已安装入口 SHA-256：`98be79ad0fe1b64f989a70c995f3acf7e3cf4935f3add37aacfaa856f817ea39`

正式包集成验证：Desktop 相关测试 554 项通过（包含正式包搜索回归 11 项），原有可选源码入口测试 2 项跳过。独立 `test:capricorn-published` 再次通过全部 11 项；同组源码联调 11 项也通过。Desktop 类型检查、安装脚本语法检查、本次发布集成修改文件的非修复 lint 和 diff 检查均通过。

2026-09-07 宿主回归修复：新增未展开目录结果点击到 Source Code 实际选区、后续目录加载复用 ID、Windows 路径身份与未保存内容，以及 StrictMode 分栏查找位置、焦点和命令交接测试。搜索及正式包集成测试 27 项、文件打开与布局等相关测试 55 项通过；Desktop 类型检查及本轮修改文件的非修复 lint 通过。文件打开测试输出 React 生命周期卸载和 `flushSync` 提示，用例通过。本次未修改 Capricorn，未执行 build 或原生 Tauri 手动联调。

同日修复跨文件实例交接后的高亮丢失：原逻辑只按请求号去重，新实例被误认为已经定位。新增 3 项回归在修复前失败（实例替换、同一实例重新注册、正式包文件 B 可见高亮），修复后全部通过。本次查找控制器与正式包集成 24 项、宿主导航/分栏/Source Code 10 项通过；Desktop 与联调 TypeScript 检查、修改文件非修复 lint 通过。临时浏览器页面使用真实 Editor、TextEditor、虚拟化滚动容器和 0.1.22 私有包，验证 A → B 及 B 实例重建后的高亮 DOM、非透明背景和可见尺寸。文件样本与 Tauri 窗口接口使用替身，此验证不代表原生 Tauri；临时页面已移除，未执行 build。

后续按用户截图中的 `desk` 与带链接的列表内容复现：0.1.22 把普通标点转义后的文本用来匹配原行，导致未编辑的列表返回 `stale`，没有生成 `desk` 的命中范围。之前的纯 `foo` 样本没有覆盖此问题。新增源码坐标回归覆盖截图原行、多行列表、中文/emoji 与重复词；Desktop 同组源码/正式包用例覆盖第 138 行在首屏之外、虚拟化开关及 A → B → A → B。两项 Desktop 回归与 Capricorn 原行回归在旧实现失败，源码修复后 14 项跨仓联调全部通过。

2026-09-07，Node 24.14.1 独立模型脚本的本次记录：100,000 块冷查询 185.6ms、缓存查询 0.026ms、冷导航 350.85ms、12 次暖导航中位数 0.86ms / 最大 4.84ms；2 MiB 单块冷/后续查询为 0.6ms / 0.3、0.3、0.3、0.2ms；10 MiB 为 2.7ms / 1.2、1.1、1.1、1.1ms。样本与上表相同，仍是模型测试数据，不代表 Tauri 或 P95。

## 0.1.23 列表高亮修复发布与集成

修复提交 `9794c5b`，发布标签 `capricorn-v0.1.23`，发布提交 `636953bdf2b50af47b48f5b17b795045f0aac07b`。[发布 CI](https://github.com/drl990114/capricorn/actions/runs/34131584006) 的完整检查、私有包打包审计、上传和验证清单留存全部通过；本地源码指纹与 CI 产物清单一致。

- 包：`@drl990114/capricorn-runtime@0.1.23`
- tarball SHA-256：`8d56f1d62c131182e0d535571373b7495e7df8575f61d3e6b7dbfd18bca240ce`
- 源码指纹：`36cf30f059d2b97c4774f8dff6332a79799086c11949fd17b8f8c3faa629585d`
- 已安装入口 SHA-256：`edce2ecf52caedff2d5c61e69ee8a393d9706172c586793aee92bd1046aa0057`

通过项目的 `yarn install:capricorn-runtime` 安装，保留包身份、精确版本和 tarball SHA 校验。Desktop 14 项正式包搜索联调与同组源码联调均通过；另运行 549 项 EditorArea、全局搜索、快捷键、布局/文件状态及解析器相关测试，2 项原有可选源码入口测试跳过。Desktop 和联调 TypeScript 检查、修改文件非修复 lint、安装脚本语法检查通过。Capricorn 本地发布检查及发布提交 CI 均通过全套 112 组运行时/契约测试、10 个 TypeScript 测试文件、类型检查与 lint。

浏览器对照使用真实 EditorAreaContent、Editor、TextEditor、虚拟化滚动容器及未带保存转义的第 138 行列表样本。0.1.22 返回 `stale` 且目标文件无命中 DOM；0.1.23 返回 `exact`，`desk` 高亮有非透明背景及约 35 × 19px 的可见尺寸，A → B → A → B 后仍存在。该样本没有覆盖实际文件保存后的转义形式，且直接发起定位请求，未经过全局搜索结果按钮；因此这次验证不足以代表用户截图中的实际文件。Tauri 窗口接口和文件输入为本地联调替身，此结果不代表原生 Tauri 手动验收。临时页面和测试服务已清理；应用 build 按约定未执行，私有包由既有发布 CI 打包审计。

MarkFlowy 本轮改动限于版本/校验锁定、相关回归及本文。集成前记录的 39 个其他已修改文件内容保持一致，包括 `Cargo.lock`；现有工作未提交到 Capricorn，也未被安装流程覆盖。

## 保存转义和首次打开后的布局变化

本轮使用实际文件内容的本地副本，经过真实 SearchView 的查询和结果按钮、EditorAreaContent、TextEditor 及 Capricorn 运行时复现。仅文件输入和 Tauri 后端搜索响应使用替身。实际第 138 行是：

```markdown
- [tauri](https://tauri.app/) \- Build smaller\, faster\, and more secure desktop apps with a web frontend\.
```

0.1.23 将这行退回到所属块定位，查找快照没有文字命中，页面中也没有命中 DOM。源码列 74–78 对应模型列 42–46；跳过转义反斜杠后才能高亮正文中的 `desk`。

修复参考当前 markdown-it 15 的[转义规则实现](https://github.com/markdown-it/markdown-it/blob/master/lib/rules_inline/escape.mjs)，按当前位置严格核对文本，保留 UTF-16 列与行内代码中的反斜杠。连续字符合并为范围，不按字符创建索引；投影按不变块缓存，范围查询使用二分查找。超长转义块分片执行并检查取消，未完成投影不进入缓存。没有修改 Markdown 持久化流程。

完整文件还复现了首次打开时的晚到布局变化：命中 DOM 已生成，但 HTML 预览及虚拟化占位测量会把它推到视口外。最终滚动现在检查真实命中的几何范围，等待一个滚动节流周期内位置稳定；复用已找到的命中 DOM，仅在失效后重新查找。整个过程有界且沿用请求取消信号，取消后不再校正滚动。

新增回归覆盖全部 ASCII 标点转义、非 ASCII 转义、中文/emoji、重复词、行内代码、表格、真实 codec 保存后重新打开、密集转义投影取消与缓存复用，以及延迟布局和取消后的滚动。Desktop 同组联调新增已打开/首次打开文件 B 的真实结果按钮 A → B → A → B，以及带转义行的虚拟化开关，共 18 项。

在仍安装 0.1.23 时运行新增的正式包联调，原有 14 项通过、新增 4 项全部失败；同组源码联调 18 项通过。这确认回归用例覆盖了正式包中的实际缺口。浏览器用完整文件副本复现后，源码修复使第一次点击和首次打开的高亮保持在正文滚动容器内，命中尺寸约 35 × 19px，目标文件只挂载约 20 个块。

2026-09-07，Node 24.14.1 独立模型脚本一次记录：含 200,000 个转义符的块，冷投影 66.6ms（协作分片），缓存定位 0.09ms；100,000 块冷查询 183.8ms、缓存查询 0.014ms、冷导航 353.86ms、暖导航中位数 0.79ms / 最大 0.98ms；2 MiB 单块冷查询 0.6ms，10 MiB 为 2.7ms。这些是模型数据，不代表真实 Tauri 或 P95。

## 0.1.24 发布与正式包复核

修复提交 `b2e7b2d`，发布标签 `capricorn-v0.1.24`，发布提交 `90827bec23aeeb6e1be775d3adce04f136e1ada1`。[发布 CI](https://github.com/drl990114/capricorn/actions/runs/34136959092) 的完整检查、打包审计、上传及验证清单留存全部通过。源码指纹与本地发布提交一致。

- 包：`@drl990114/capricorn-runtime@0.1.24`
- tarball SHA-256：`059384b34090572a4334e5deb95026a5b083cd8a3f02329f4fb20090091c4152`
- 源码指纹：`8f3db1db838bb37c5bc2cb8889a8d0577c9b1bc43651c844632d89506bc7af86`
- 已安装入口 SHA-256：`5b689938659ac9a44b2e20edcd9b7b8fed2e166c1411ab3a089767394115080e`

通过 `yarn install:capricorn-runtime` 使用项目配置的凭据安装，保留包身份、版本和 SHA 校验。发布提交源码联调 18 项、正式包同组联调 18 项通过；Desktop、联调以及 Capricorn 类型检查、修改文件非修复 lint 和安装脚本语法检查通过。Capricorn 本地发布检查及该发布提交 CI 均通过 112 组运行时/契约测试和 10 个 TypeScript 测试文件。

浏览器使用正式包、完整文件副本及真实全局搜索按钮，检查快照明确为 `0.1.24`。首次打开第 138 行返回 `exact`，`desk` 的 35 × 19px 高亮位于正文滚动容器内；随后重复 A → B → A → B 仍可见。Tauri 后端搜索响应和窗口接口为替身；原生窗口缺少工具控制权限，未将此结果记为原生 Tauri 验收。

正式包另通过 550 项 Desktop 相关回归（2 项原有可选源码测试跳过），加上独立搜索联调共 568 项通过。首次同时运行类型检查和两个测试进程时，原有剪切回归超出 5 秒限制；未修改用例，独立复跑该文件 5 项通过，再以 `--maxWorkers 2` 运行上述 550 项，全部通过。

临时浏览器页面、完整文件副本与测试服务已移除。集成前记录的 39 个其他已修改文件及暂存区保持原样，Capricorn 工作区干净。没有执行应用 build；私有包由发布 CI 生成并审计。已打开的开发窗口需要重新加载新运行时，可保存后重启 `yarn dev:desktop`。

验证命令：

```sh
# MarkFlowy
yarn workspace @markflowy/desktop build:types
yarn workspace @markflowy/desktop exec vitest run capricornRuntimeResolver.test.ts src/components/EditorArea src/extensions/search src/helper/findShortcut.test.ts src/stores/useEditorStore.test.ts --exclude '**/capricornSearch.publishedRuntime.test.tsx' --maxWorkers 2
yarn workspace @markflowy/desktop test:capricorn-source
yarn workspace @markflowy/desktop test:capricorn-published
yarn translate:check

# Capricorn
fnm exec --using=24 npm run typecheck
fnm exec --using=24 npm test
fnm exec --using=24 node tests/test-find-source.mjs
```

两仓另外对本次修改的 TypeScript/TSX（Capricorn 还包括测试脚本）执行非修复模式 ESLint。源码实现阶段未执行 build；发布阶段由既有 CI 生成并审计 Capricorn 包。MarkFlowy 集成仅运行类型检查、相关单测和 lint，按约定未执行应用 build。
