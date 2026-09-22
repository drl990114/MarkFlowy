# 文本编码与 Markdown 源码保真设计

状态：MarkFlowy 文件编码与 RME 源码模式部分已实施；Capricorn 部分保留为后续设计。2026-09-22。

按本次“开始修复，先不改 Capricorn”的范围，完成严格编解码、编码/BOM 选择、原格式保存、历史与草稿格式记录，以及 RME 源码模式的混合换行桥接。本次没有修改 Capricorn 或 runtime pin；**富文本编辑、富文本与源码切换后的整体 Markdown 保真尚未完成，不能关闭整个 P0**。统一换行操作也未新增。

验证覆盖源代码、DOM 单测和 Rust 临时文件读写。按用户要求未执行应用/编辑器包 build；当前 `rme` 入口指向 `dist/index.mjs`，源码桥接通过单测，但未生成新产物或验证真实 Tauri 消费。

参考本机 Zed checkout `f4178619ac`（2026-08-20），不是对最新版 Zed 的评估；MarkFlowy 分支为 `v1`。前轮设计基于 Capricorn 源码 `513ee6d`，MarkFlowy 安装的 Capricorn runtime 为 `0.2.6`。本文保留现有编辑模式、文件保存协调器、历史保护及虚拟化体系；Capricorn 设计需要在后续实施时重新核对其当前源码。

## 1. 从 Zed 采用哪些设计

| Zed 的实现 | 对应决定 |
| --- | --- |
| [DecodedText 同时返回 text、encoding、has_bom](/Users/dongruilin/Desktop/repo/opensource/zed/crates/language/src/file_content.rs:7) | 编码与 BOM 是每份文档的状态，跟随打开、重载、保存和恢复。 |
| [保存前捕获 text、line_ending、encoding、has_bom、version](/Users/dongruilin/Desktop/repo/opensource/zed/crates/project/src/buffer_store.rs:393)，[完成后确认捕获的 version](/Users/dongruilin/Desktop/repo/opensource/zed/crates/project/src/buffer_store.rs:437) | 保存使用不可变快照；旧保存完成不能清除新编辑、新格式选择的 dirty 状态。 |
| [UTF-8 无 BOM 使用快速路径，其他编码在后台转换](/Users/dongruilin/Desktop/repo/opensource/zed/crates/worktree/src/worktree.rs:1850) | 编解码放在 Rust 后台；UTF-8 常见路径不经过探测器，不在每次输入时做整篇转码。 |
| [重新打开检查基准版本，并记录旧编码/BOM供事务恢复](/Users/dongruilin/Desktop/repo/opensource/zed/crates/language/src/buffer.rs:1643) | 重新解码属于完整文档替换，必须检查操作期间是否出现新编辑，且保留旧稿与原格式。 |
| [编码选择器执行 reload_with_encoding](/Users/dongruilin/Desktop/repo/opensource/zed/crates/encoding_selector/src/encoding_selector.rs:294) | UI 明确区分重新解码与转换保存；不能让一个模糊的“选择编码”同时做两件事。 |

需要比参考实现更严格的地方：

- Zed 的 [decode/encode 调用丢弃错误标记](/Users/dongruilin/Desktop/repo/opensource/zed/crates/language/src/file_content.rs:13)，不能用于“禁止静默丢字”的保存契约。MarkFlowy 必须使用严格解码及无替换编码。
- Zed 的 [LineEnding 只有 LF/CRLF，明确不支持混合换行](/Users/dongruilin/Desktop/repo/opensource/zed/crates/text/src/text.rs:3581)。MarkFlowy 需要保留 LF、CRLF、CR 混合出现的原文。
- Zed 是直接编辑文本；它的方案不能解决富文本树重新生成 Markdown 时的链接、HTML 实体、空白变化。这部分由 Capricorn 实现。
- Zed 的 [UTF-8 保存路径直接创建目标文件](/Users/dongruilin/Desktop/repo/opensource/zed/crates/fs/src/fs.rs:972)。这里仅借鉴后台处理和快照捕获，不替换 MarkFlowy 现有 revision 检查、历史备份与链接文件处理。

## 2. 完整 P0 的验收契约

以下包括尚未实施的 Capricorn 契约；本次通过的检查见第 11 节。

1. 打开后未修改，普通保存不改写文件；磁盘字节、BOM、换行及末尾空白保持一致。
2. 只修改一处文字，不改变其余源码，包括同一段中未修改的链接、引用式语法、HTML 实体、属性、注释、空白。
3. 原编码无法表示新增字符、字节无法严格解码或源码映射失效时，原文件不被覆盖；编辑内容继续受草稿保护。
4. 编码/BOM 转换、统一换行是显式操作。普通保存、自动保存、模式切换不得附带格式化。
5. 撤销/重做恢复相应的文本与源码映射；外部完整替换不能套用旧映射。
6. 在保存期间继续输入，只确认已写入的版本，新内容仍保持 dirty。
7. HTML 预览继续安全过滤；保存原始源码与执行 HTML 是两个独立行为。

## 3. 职责与数据流

| 层 | 负责内容 |
| --- | --- |
| Rust 文件层 | 稳定原始字节快照、编码检测/严格解码、BOM、严格编码、字节 revision、受保护写入。 |
| MarkFlowy 文档状态 | 原始及目标文件格式、dirty、保存队列、外部冲突、草稿/历史、多窗口、编码 UI。 |
| Capricorn | Markdown 原文与编辑模型的映射、局部序列化、结构变化、文本撤销/重做、Worker 传输、HTML 安全展示。 |
| RME SourceEditor | CodeMirror 的文本改动与原文换行之间的映射；不决定磁盘编码。 |

```mermaid
flowchart LR
  A[磁盘字节] --> B[Rust 严格解码]
  B --> C[内容与文件格式快照]
  C --> D[Capricorn 富文本或 RME 源码编辑]
  D --> E[保留原有语法与换行的文本]
  E --> F[宿主捕获内容 格式 版本]
  F --> G[Rust 严格编码]
  G --> H[revision 检查 历史保护 写入]
  H --> I[确认已保存版本]
```

不新增另一套 dirty、autosave 或文件缓存。扩展现有 `TextEditor`、`FileSaveCoordinator` 与文件快照结构。Capricorn 不接受 GBK、路径、BOM、磁盘 revision 或保存回执。

## 4. MarkFlowy 的数据契约

以下为已实现边界的核心字段，详见 [textFileFormat.ts](/Users/dongruilin/Desktop/repo/me/markflowy/apps/desktop/src/components/EditorArea/textFileFormat.ts:1) 与 [fileSaveCoordinator.ts](/Users/dongruilin/Desktop/repo/me/markflowy/apps/desktop/src/components/EditorArea/fileSaveCoordinator.ts:1)：

```ts
type TextEncoding = 'utf-8' | 'utf-16le' | 'utf-16be' | 'gbk' | 'gb18030'
type LineEnding = 'lf' | 'crlf' | 'cr'

interface TextFileFormat {
  encoding: TextEncoding
  bom: 'none' | 'utf8' | 'utf16le' | 'utf16be'
}

interface TextFileMetadata {
  format: TextFileFormat
  lineEndings: Record<LineEnding, number>
  decoding: {
    source: 'bom' | 'utf8' | 'heuristic' | 'user' | 'unknown'
    needsConfirmation: boolean
    byteRoundTrip: boolean
  }
}

interface StableTextFileSnapshot {
  status: 'success'
  content: string
  revision: string // 原始磁盘字节与现有文件身份/代次
  text: TextFileMetadata
}

interface TextWriteOptions {
  format: TextFileFormat
  originalFormat?: TextFileFormat
  encodingConfirmed: boolean
}

interface FileSaveSnapshot {
  content: string | undefined
  revision: number // 内容或目标格式改变均递增
  textOptions: TextWriteOptions
}
```

编码和 BOM 的组合由 Rust 校验：GBK/GB18030 不能附加 UTF-8 BOM，UTF-16 大小端必须匹配。文件开头的一个签名 BOM 与正文中的 U+FEFF 分开处理，不能全局删除 U+FEFF。

`lineEndings` 是统计与新增行策略，不是保存时全局替换文本的指令。换行原样存在于 `content` 与编辑器源码映射中，Rust 编码器不再做换行归一化。文末无换行、一个换行或多个空行均由原文完整表达，不能用单个布尔值重建。

保存协调器同时持有“最后落盘快照”和“当前编辑快照”。目标格式变化递增版本并置 dirty；保存完成只能确认捕获的版本。当前输入仍沿用宿主的保守 dirty 策略，不在每次按键或撤销时新增整篇比较；未修改保存由 Rust 对正文与格式共同检查，跳过实际写入。

## 5. 解码与保存算法

### 5.1 打开

沿用当前双次稳定读取及原字节 revision；格式信息与正文必须来自同一份稳定样本。

1. 用户明确指定编码时，使用该编码严格解码；BOM 冲突作为显式选择处理，禁止库静默切换到别的编码。
2. 自动模式先识别 BOM。UTF-32 签名要先于 UTF-16 前缀判断；P0 不支持 UTF-32 时返回明确的不支持状态。
3. 复用二进制识别；无 BOM 的 UTF-16 可参考 Zed 的 NUL 分布及字符合理性检查，但最终必须完整严格解码。
4. 普通文本先做严格 UTF-8 快速判断，再进入 `chardetng` 候选探测。P0 保存编码限定为上述五种，其余候选返回可解释的不支持状态。
5. 对探测候选完整严格解码，并检查重新编码能否还原原字节；字节可往返只证明机械可逆，不证明文字解释正确。
6. GBK 与 GB18030 的共同子集无法确定原始标签。合法四字节序列不能被当作纯 GBK 保存；歧义情况显示候选并在首次覆盖原文件前确认目标编码。纯 ASCII 默认 UTF-8，界面不声称识别出原始标签。

不虚构探测置信度百分比。明确记录“由 BOM 确定”“用户指定”“推测”等状态。解码错误不能转成正常可写文档；如果展示替换字符供查看，必须是独立的只读诊断内容。

`encoding_rs::GBK` 的解码器接受 GB18030 内容，因此仅“GBK 解码成功”不是 GBK 判定条件。GB18030 使用库的 WHATWG 映射，私用区及历史映射差异纳入固定字节样例，不承诺所有版本映射完全等价。

### 5.2 保存

1. 刷新现有待发布编辑快照。IME 候选未确认、文档替换未完成或外部冲突未解决时，沿用现有保存阻断。
2. 在保存队列实际执行本次尝试时，一次性捕获内容、目标格式、宿主版本和最新已知磁盘 revision。
3. 若内容及格式与已保存基线相同，跳过写入；存在外部版本变化时先走冲突/重载处理，不能用本地相等掩盖磁盘变化。
4. Rust 后台完整生成目标字节：UTF-8 无 BOM 走直接路径；UTF-16 显式按端序编码；旧编码使用无替换 API。失败时报告字符及位置，不先截断文件。
5. 对非规范旧编码字节映射，P0 不承诺局部字节拼接。未修改时保留原文件；修改后若无法确保原映射保真，要求显式转换或另存副本，禁止偷偷规范化原文件。
6. 编码成功后进入现有 revision 检查、历史备份、再次检查、写入流程。错误类型区分冲突、不可编码、格式非法、源码保真失败和 I/O 错误。
7. 保存成功更新本次快照的磁盘基线。当前版本更新时继续保留 dirty，队列使用新基线保存后续版本。取消或过期结果不能写入另一个文件会话的状态。

UTF-8 快速路径、旧编码路径必须共享相同的冲突与历史保护。现有文件为保留 inode/硬链接等采用原位写入，本方案不把它描述为跨进程或断电级原子写入。完整编码在写入前完成；进一步改变提交策略需独立评估文件身份与链接语义。

新增共享 crate [mf_text_encoding](/Users/dongruilin/Desktop/repo/me/markflowy/crates/text_encoding/src/lib.rs:1)，由 Desktop 文件层与本地历史复用；直接依赖锁定的 `encoding_rs 0.8.35`，新增 `chardetng 1.0.0` 仅作候选探测。无替换编码的行为见 [官方 Encoder 文档](https://docs.rs/encoding_rs/latest/encoding_rs/struct.Encoder.html#method.encode_from_utf8_without_replacement)。

## 6. Capricorn 联合设计（后续实施）

### 6.1 在现有模型上附加来源记录

保留现有不可变 Document、Controller、operation、history 和虚拟化布局。新增内部 `MarkdownSourceDocument`，保存一次原始字符串及片段索引；编辑模型节点引用来源记录，避免每个节点复制整段/整篇原文。

原文不是另一个可以独立接受编辑的文档。来源记录与 Document 通过同一编辑事务更新；只用于验证和生成当前模型对应的 Markdown。磁盘是否保存不参与这套机制，保存成功也不能重置来源或文本撤销历史。

复用 [source-provenance.ts](/Users/dongruilin/Desktop/repo/me/capricorn/src/plugins/markdown/source-provenance.ts:1) 的语义比较思路、[link-source.ts](/Users/dongruilin/Desktop/repo/me/capricorn/src/plugins/markdown/link-source.ts:1) 的局部链接源码，以及 [changeSummary.ts](/Users/dongruilin/Desktop/repo/me/capricorn/src/core/changeSummary.ts:8) 的变更范围。

现有 `searchSource.line` 是历史来源行号，不是实时 offset，也不包含完整片段。不能直接拿它切割保存内容；搜索 provenance 与持久化 provenance 应明确分开。

### 6.2 片段与位置

- 原始字符串中的位置统一为 UTF-16 code unit 的半开区间，明确区别于 Rust 字节位置和归一化文本位置。
- 解析器内部可继续使用 LF；构造原文与解析投影之间的换行位置映射，处理 CRLF、CR、emoji 和组合字符，不做 Unicode NFC/NFKC 归一化。
- 顶层记录是可安全独立序列化的语法单元：普通段落，完整列表/表格/围栏/HTML 容器，以及隐藏的引用定义。一个单元可以覆盖多个现有虚拟化节点。
- 单元之间的空白、文首文末空白采用独立 gap 记录。不能重新统一 `join('\n\n')`，也不能把同一空白同时归属前后两个单元。
- 改字且相邻单元关系不变时原样复用 gap；删除、移动、插入改变的连接处采用确定的最小合法分隔。该处及受语法影响的范围属于此次修改，其他 gap 保持原样。
- 单元内部保留链接、引用标签、图片、HTML 标签/实体/注释等来源范围与语义快照。嵌套范围按树表达；输出遍历父子关系，避免重叠 patch。

### 6.3 局部输出及失效范围

1. 原模型与上下文均未变化的单元直接输出原片段。
2. 改变单元中的普通文字，复用未改 inline 片段，重新生成实际改变的部分。
3. 来源校验包含文本、链接 href/title、引用标签、marks、子节点结构和影响语法的容器上下文；不能只看 node ID 或显示文字。
4. 从 `changedTopLevelIds` 开始，按 `topologyChanged` 和分组关系扩展至最小合法语法单元。普通改字不全量遍历、散列、深比较整篇模型。
5. 列表拆分、移动块、改围栏边界可能改变邻接解析；扩大验证范围直到边界稳定。不能假设“未改节点”一定“语义未受影响”。
6. 引用定义保留原顺序、大小写、空白、重复及未使用定义。维护标准化标签到定义/引用的依赖；定义变更重新解析受影响的引用，输出仍保留未改源码。
7. 修改单个引用链接目标默认只改变这个链接，必要时转为行内链接；显式修改引用定义才影响所有使用者。修改折叠/快捷引用的显示文字时，可为维持目标补完整引用标签，这是被编辑链接的变化。
8. HTML 的大小写、属性引号、实体及注释保持原样；安全处理只用于展示副本。无法结构化编辑的语法仍作为原文节点保存。

全篇文本 diff 只适合诊断，不能作为修改后的富文本到原文映射方案；重新序列化后产生的规范化变化会污染 diff。更换 Markdown parser 或将整个 Capricorn 改为纯文本编辑器的成本过高，P0 沿用现有 `markdown-it` 及源码扩展。

对新建节点、从无来源 JSON 创建的内容，使用现有规则生成 Markdown，这是合法的新内容。对已打开文档若应有来源记录却损坏，返回明确的保真错误，不静默退回整篇规范化保存。此时普通 Markdown 快照可能已经无法生成，异常恢复包必须保存最后可靠原文、当前不可变模型的 JSON 和诊断状态，必要时附上明确标记为候选的规范化文本；候选文本不得自动覆盖原文件。正常编辑仍只持久化准确原文，不在每次输入时复制整个模型。

### 6.4 Undo、Worker 与内存

- 来源片段的修改及逆变更加入现有 history batch；文本与来源一起 undo/redo。不能创建独立的“源码撤销栈”，也不能依赖 WeakMap 中碰巧仍存在的旧 Document。
- 可以用 WeakMap 缓存结果，但来源恢复所需的信息必须随现有 undo 事务/节点元数据存活。Merge/Split/Remove/Move 的逆操作必须恢复来源关联。
- 全量 `setMarkdown`/`setMarkdownAsync` 创建新的 source epoch；旧异步解析、旧定位及旧快照不能挂到新 epoch。切换 edit/preview 与保存成功不重建来源。
- 解析、来源记录、Markdown 缓存基线与模型一起安装；首次 `getMarkdown()` 返回输入原文，初始化及只读模式切换不制造文档修改。新来源未准备成功前，保留完整的旧会话状态。
- 同步解析、Worker 解析及 hydrate 使用相同来源 schema。原字符串由主线程按当前请求持有；Worker 返回区间与来源结构，不在每个节点重复传输整篇字符串。
- 主线程校验来源 epoch、边界、长度、重叠及分组完整性后挂载。升级内部 preparation protocol，保持取消、背压和分批传输；不能只实现同步小文档路径。
- 释放 session 或裁剪历史时释放不再引用的来源片段。完整字符串输出仍有 O(N) 下界；高频输入只做局部失效，按实际快照需求输出，保留当前快照合并策略。

### 6.5 对宿主暴露最小 API

```ts
interface CapricornMarkdownSnapshot {
  readonly revision: number
  readonly sourceEpoch: number
  readonly markdown: string
  readonly composing: boolean
  readonly pending: boolean
}

interface CapricornEditorSession {
  getMarkdownSnapshot(): CapricornMarkdownSnapshot
  getMarkdown(): string
}
```

这是在现有 Session 上添加方法，不是替换整个接口。快照正文与版本来自同一份当前模型，不能先读版本、等待后再读文本。`pending` 沿用当前“普通输入可立即读取、稍后提交不重复递增版本”的契约；IME 未确认候选不进入保存文本，宿主在 composing 时等待。

`getMarkdown()` 与 `export('markdown')` 复用保真输出。原规范化 serializer 留作新内容生成及明确的规范化用途。`subscribeDocumentChange` 继续轻量通知，禁止为每次输入主动序列化全文。

宿主复用现有 editor instance 身份，再结合 sourceEpoch/revision 检查快照。Capricorn 不提供 `markSaved`、磁盘 patch 或编码选择 API，保存基线继续由 MarkFlowy 管理。

## 7. 源码模式也必须保留换行

原先 CodeMirror 编辑后直接通过 `doc.toString()` 输出，库级探针确认 CRLF、CR、混合换行会归一化成 LF。本次新增 [raw-text.ts](/Users/dongruilin/Desktop/repo/me/markflowy/packages/editor/src/editor/codemirror/raw-text.ts:1)，仅在 RME SourceEditor 启用原文与规范化坐标的映射。

使用 `Transaction.changes` 的范围把 CodeMirror 坐标映射到原文，未编辑的换行原样保留，输入与普通粘贴新增的换行沿用邻近格式。完整原文替换通过 effect 同步新映射；全 LF 原文不建立逐行映射数组。仅设置一个 `EditorState.lineSeparator` 无法支持混合换行。

已映射 selection、搜索定位及 PM ↔ CodeMirror 更新的坐标；PM 保存准确原文。结合宿主直接调用 CodeMirror undo/redo 的现状，保留现有 CodeMirror history，通过 `invertedEffects` 记录被删除换行的原样式，在撤销/重做时恢复；不另建撤销栈，也不改成由 PM 接管源码撤销。保留 CodeMirror 原有多光标输入/粘贴行为。

Capricorn 内部的代码块、Front Matter 等 CodeMirror 编辑入口同样遵守来源映射规则，不能成为整组换行归一化的旁路。CodeMirror 文本分隔与位置模型参考 [官方 state 源码](https://raw.githubusercontent.com/codemirror/state/main/src/state.ts)。

## 8. 生命周期、历史与产品行为

| 场景 | 行为 |
| --- | --- |
| 状态栏 | 显示 `GB18030 · CRLF`，混合文件显示“混合换行”；推测编码有可见提示。复用 Desktop 的菜单、选择器、对话框封装。 |
| 以编码重新打开 | 先严格解码预览，不写磁盘；应用时用独立 writer 持久化旧稿及旧格式，再检查路径、宿主版本、输入状态和磁盘 revision。保护失败或预览过期则保留当前文档。 |
| 以编码保存 / BOM 更改 | 更新目标格式并递增宿主版本；按同一保存队列写入。格式变化本身计入 dirty；失败继续保留内容与待保存格式。 |
| 统一换行 | 本次未新增；今后应为明确的文本转换操作。普通保存保留现有原文中的混合换行。 |
| 文内 Undo/Redo | Capricorn/RME 恢复文本及其来源。编码/BOM 是宿主格式状态，通过状态栏改回或历史恢复；P0 不在两个编辑器之间另建统一 undo 引擎。 |
| 重新打开后的恢复 | 原稿和格式作为一个可恢复快照保存。完整重载建立新 epoch；不通过旧编辑事务把旧内容与新文件格式拼接。 |
| watcher 正文相同、格式不同 | 干净文档更新正文及格式基线；存在本地文字/格式更改则进入冲突处理，不能仅因字符串相等就清除 dirty。 |
| 多窗口 / 多编辑组 | 同步正文和格式；原字节 revision 继续仲裁写入。同一文件的手动编码选择绑定文件基线，外部替换后重新核验。 |
| 另存为 | 默认继承当前文档格式；覆盖现有目标时使用目标的 revision 做冲突检查，不能无声继承目标文件编码。 |
| 新建文件 | 默认 UTF-8 无 BOM；默认新增换行 LF，可由明确的文档/工作区设置覆盖。 |

历史层已在 schema 2 中新增 `text_snapshots` 引用表，[text_snapshot.rs](/Users/dongruilin/Desktop/repo/me/markflowy/crates/local_history/src/text_snapshot.rs:1) 区分磁盘字节与 Unicode 草稿，避免对新草稿重新猜编码：

- 复用现有 `objects` 内容寻址 BLOB；新增版本化 snapshot envelope，记录 `disk-bytes` / `unicode-source`、对象哈希和文件格式。相同字节可以关联不同的用户编码选择，格式不能直接写死在 objects 上。
- entries、writes、baselines、drafts 通过新增关联引用相应 envelope；before 与 after 分别保存格式，保持既有字节哈希含义。
- 草稿仍以完整 Unicode 原文持久化，即使它暂时无法编码成 GBK，也能恢复。恢复格式为草稿记录的目标格式，随后仍需严格编码校验。
- Capricorn 后续：映射异常的恢复包使用独立的 `editor-recovery` 类型，记录模型 schema/runtime 版本，不能被当作磁盘文本自动解码或保存。本次未新增此类型。
- schema 迁移以事务进行；旧记录无法确定格式时标记 unknown，优先恢复为草稿，不把推测结果静默写回文件。
- CLI 区分原字节磁盘 revision 与解码文本哈希，现有 `content_applied` / `export_completed` 含义不变；编码错误返回结构化错误，不能返回成功回执。

## 9. 文件改动范围与交付顺序

| 批次 | 主要改动 | 独立验收 |
| --- | --- | --- |
| A：文件安全与格式状态（已实施） | 新增 `crates/text_encoding`；扩展 `fc.rs`、`fileSnapshot.ts`、`conditionalFileWrite.ts`、`fileSaveCoordinator.ts`、`TextEditor.tsx`；历史 envelope 迁移及恢复；watcher 格式冲突。 | UTF-8/UTF-16/GBK/GB18030 读取、严格保存、BOM、不可编码字符、保存竞争、历史恢复。编码安全已覆盖单测，不宣称整体源码保真完成。 |
| B：Capricorn 保真核心 | `codec-parse.ts`、`codec-serialize.ts`、`link-source.ts`、HTML/源码编辑入口；新增内部来源文档/输出器；接入 change summary、history、markdownCache、Session 快照和 preparation protocol。 | 未修改原文相等；同段/跨段局部编辑；结构编辑；undo/redo；同步与 Worker 路径一致。 |
| C：源码模式和宿主接入（部分实施） | RME SourceEditor 坐标/换行桥接、编码/BOM UI 已实施。Capricorn 新快照消费及完整模式切换保真待 B 完成。 | 本次覆盖源码局部修改、撤销、坐标、宿主保存及恢复单测；全模式保真仍待验收。 |
| D：发布产物接入 | Capricorn 产物通过独立发布流程后，更新 MarkFlowy runtime 安装脚本、resolver 与对应测试的版本/哈希约束。 | 用实际消费产物跑同一回归，不能只凭相邻源码仓库通过就认定 Desktop 已修复。 |

本次仅调整 Rust 编码相关依赖，未修改 Capricorn runtime pin。按用户要求使用类型检查、单元测试、改动文件 lint，未执行产品 build 或包发布。

## 10. 回归矩阵与实施门槛

- 编码：UTF-8 有/无 BOM，UTF-16 LE/BE 有/无 BOM，GBK 常用字/欧元符号，GB18030 四字节/emoji/生僻字，非法字节、截断序列、孤立代理项和已知二进制头。
- 原字节：未改保存、取消转换、编码失败，原文件 SHA-256 不变；同内容不同 BOM/编码不能只用文本哈希去重。
- 换行：LF、CRLF、CR、混合换行；无末尾换行、多末尾空行、空文件与仅 BOM 文件；正文中的 U+FEFF 不被删除。
- Markdown：角括号/裸路径/百分号转义/不同引号的链接，完整/折叠/快捷引用，多行/重复/未使用定义，HTML 大小写/属性/实体/注释/未知标签，列表/表格/围栏/Front Matter。
- 编辑：修改旁边段落、修改同段普通文字、只改 href/title、移动/复制/删除块、列表合并拆分、跨块粘贴、实体边界修改、撤销/重做。
- 模式：富文本 → 源码 → 富文本、预览、源码模式改字及替换全篇，CodeMirror 选择/搜索位置在 CRLF 与 emoji 附近正确。
- 生命周期：IME 提交/取消、延迟输入提交、异步重载被新编辑取消、保存中继续改字/切编码、另存为路径碰撞、窗口关闭、历史恢复后首次保存。
- 外部变化：只改编码/BOM、正文相同字节不同、dirty 时外部替换、非规范旧编码字节；不能被内容相等分支误清 dirty。
- 性能：对照当前 2 MiB 和大型文档样例记录加载时间、输入长尾、序列化次数、来源记录/undo 内存；普通编辑不新增整篇深比较或反复重编码。未采样前不承诺 P95 数值。

优先建立可以复用到源码与发布产物的失败样例，再实现。额外做 property-based 测试覆盖 parse → serialize 恒等、局部操作后模型/源码语义一致、undo 恢复原文，以及同步/Worker 结果一致；复用 Capricorn 已有 `fast-check`。

本次采用 Desktop `build:types`（仅 tsc --noEmit）、相关 Vitest、RME 相关单测及类型基线对照、Rust 编解码/历史/快照单测、改动 TS/TSX 文件的既有 ESLint 8 runner。未测试或修改并行演进中的 Capricorn checkout。Rust 单测编译测试目标，不等同于打包 Desktop。真实 Tauri 的 OS watcher、IME 与跨窗口行为单独验收，不能用 DOM/单测替代。

## 11. 本次实施与验证证据

Zed 的结论来自本机源码调研，没有运行 Zed 应用。实施回归如下，Node 检查均通过 `fnm exec --using=24` 执行：

| 检查 | 结果 |
| --- | --- |
| `yarn workspace @markflowy/desktop build:types` | 通过，仅类型检查。 |
| Desktop 定向 Vitest（打开、保存、格式、watcher、历史、恢复、复制、编码 UI，共 14 个文件） | 129 项通过。 |
| RME `raw-text`、`raw-source-bridge`、`codemirror-extension` Vitest | 24 项通过，覆盖混合换行、引用链接/HTML 原文、坐标、多范围输入、分组及连续撤销。 |
| RME 全量 TypeScript 与 HEAD 的只读基线对照 | 当前 36 个错误，HEAD 同为 36 个，没有新增；完整 RME 类型检查仍未通过。 |
| `cargo test --locked -p mf_text_encoding -p mf_local_history` | 编码 6 项、历史 31 项通过。 |
| `cargo test --locked -p markflowy --lib fc:: -- --test-threads=1` | 38 项通过；1 个既有手动性能基准未运行。含临时文件实际字节/BOM/端序、编码失败不写入、无改动不改 revision、过期写入拒绝。 |
| ESLint 8，仅本次改动 TS/TSX，插件从已有 `@umijs/fabric` 目录解析 | 0 错误、8 个既有警告；未使用 `--fix`。 |
| `git diff --check`（本次范围） | 通过。 |

前一轮在 Capricorn 源码及安装的 0.2.6 DOM 环境中诊断过富文本规范化问题；本次按要求未修复该层。剩余验收包括重新生成 RME 消费产物后的集成、真实 Tauri 编码 UI 与 OS watcher/IME/多窗口、故障退出恢复，以及 Capricorn 全模式源码保真。没有运行应用 build，没有声称取得这些证据。
