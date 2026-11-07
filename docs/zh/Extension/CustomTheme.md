---
seoTitle: '自定义 MarkFlowy 主题'
description: '使用 JSON 主题与 CSS 片段自定义 MarkFlowy，提供模板、选择器说明和实时预览。'
updatedAt: '2026-11-06'
---

# 自定义主题

主题由 JSON 数据组成，不需要 Node、npm 包或 JavaScript 构建。打开 **设置 → 主题商店**，选择“创建主题”或“复制并编辑”。

## 使用 AI Agent 辅助开发

仓库提供 [MarkFlowy Dev](https://github.com/drl990114/MarkFlowy/tree/main/skills/markflowy-dev) 开发辅助 Skill，目前覆盖自定义主题与 CSS，附带浅色/深色模板，以及校验、导入和分享指南。将 `skills/markflowy-dev` 整个目录复制到所用 Agent 的 Skill 目录即可安装，例如 Codex 的 `~/.agents/skills/markflowy-dev`。

可以这样提问：`使用 $markflowy-dev 创建一个暖纸色的 MarkFlowy 主题，包含浅色和深色变体，并说明如何导入和校验。` 没有源码仓库也可以通过应用主题编辑器完成开发。

局部样式可以直接请求个人片段：`使用 $markflowy-dev 为 MarkFlowy 已完成任务添加删除线，输出独立 CSS 片段，保留我当前的主题。` Skill 会区分整套主题、独立 CSS 片段和明确随主题变体切换的 CSS。解释选择器不需要生成新主题；勾选任务或修改正文格式属于普通文档编辑。

## 可视化编辑

预览中包含应用控件和编辑器。选择“检查预览元素”或在预览中右键，可定位该元素对应的 token。右侧支持搜索、只看修改项、颜色透明度、字体、排版和语法色。

每个 token 可以设置具体值，也可以关联同类型的另一个 token。恢复默认会删除覆盖，重新使用默认值或关联；引用循环和错误值会显示错误。一次取色拖动可以整体撤销。高级区可编辑 JSON 和主题 CSS。

每个主题在当前窗口中分别保存草稿，包括活动变体和未应用的 JSON。应用或丢弃 JSON 修改后，才能继续可视化编辑和导出。“保存并应用”会更新主题库、应用外观和其他窗口。关闭编辑页后可恢复或丢弃草稿；内置主题的修改保存为个人副本。

预览展示主题本身。应用时，个人强调色偏好仍优先；主题页的“使用个人字体、字号与行高”控制排版来源。关闭它即可使用主题排版，个人设置仍会保留。强调色可以在外观设置中切换为跟随主题。

## JSON 格式

```json
{
  "version": 1,
  "id": "my-theme",
  "name": "My Theme",
  "author": "Your name",
  "variants": [
    {
      "id": "light",
      "name": "My Theme Light",
      "mode": "light",
      "tokens": {
        "surface.canvas": "#fffdf6",
        "surface.panel": "#f2eee3",
        "text.primary": "#34312a",
        "text.secondary": "#746e62",
        "border.default": "#d9d2c3",
        "accent.background": "#526f52",
        "editor.link": { "ref": "accent.background" }
      },
      "css": ""
    }
  ]
}
```

`id` 是稳定身份，长度为 1–80 个字符，只能使用小写字母、数字、点、下划线和连字符，且以字母或数字开头；名称可以随时修改。一个文件可包含多个浅色或深色变体。`tokens` 可省略，缺失字段使用该模式的默认值。导出任一内置主题即可获取完整的 JSON 示例；主题页也可以导出与当前版本一致的 JSON Schema。

常用语义域：

- `surface.*`：内容、面板、浮层背景。
- `text.*`：主要、次要、禁用文字。
- `accent.*`、`focus.ring`：强调背景、其前景色、柔和背景、键盘焦点。
- `interaction.*`：悬停、按下和选中状态。
- `status.*`：危险、警告、成功状态。
- `editor.*`：正文、代码块、光标、选区、链接。
- `syntax.*`：代码语法色。
- `font.*`、`radius.*`：字体、排版、圆角。

颜色接受 Color 支持的 CSS 颜色，解析后统一为带透明度的十六进制。长度使用 `0` 或非负 `px`、`rem`、`em`、`ch`、`%`；行高是十进制正数。字体接受 CSS 字体列表，例如 `"Open Sans", sans-serif`。不在 token 中执行 CSS 表达式；更复杂的样式放在 CSS 中。

未覆盖的 `accent.subtle` 和 `accent.foreground` 会根据 `accent.background` 派生。其他 token 可以引用派生结果；经过派生默认值的引用循环同样会报错。

## CSS 与存储

主题的 `css` 随变体切换。个人 CSS 片段独立保存，可单独启停、排序、编辑和全部停用；导入后默认停用。启用片段按列表顺序作为独立样式表在主题 CSS 后加载，一个片段的解析错误不会吞掉下一个片段。仍遵循选择器优先级和 `!important` 的正常规则。导出主题不包含个人片段。

主题库和 CSS 片段保存在应用数据目录的 `themes-v1.json`。旧 JS 主题、旧自动加载 CSS 不会执行或迁移，原文件不会删除。缺失或失效的主题会暂时回退内置主题，同时保留已选身份，修复后会恢复；主动删除主题才会重置相应选择。

语义 CSS 变量使用 `--mf-theme-` 前缀，点和驼峰转换为连字符，例如 `--mf-theme-surface-canvas`、`--mf-theme-font-editor-line-height`。推荐通过 JSON token 统一调整应用和编辑区的颜色与排版，再用 CSS 补充局部样式。

## 个人 CSS 模板与预览

打开 **设置 → 外观 → 字体与 CSS → 个人 CSS 片段**，新建或编辑片段。“插入模板”会在草稿末尾追加已完成任务删除线、标题分隔线、紧凑表格或引用强调样式，不会覆盖已有内容。“选择器参考”可打开元素速查。

实时预览同时展示当前草稿和其他已启用片段。编辑草稿只影响预览；“保存片段”写入片段库，“保存后启用”决定是否应用到实际界面。导入的片段仍默认停用，需要单独启用。取消编辑会保留原来保存的 CSS。预览示例包含已完成、未完成与嵌套任务，以及标题、引用、代码和表格，可先检查再应用到自己的文档。

### 编辑器选择器速查 {#editor-css-selectors}

正文样式使用 **`.mf-editor-content`** 作为作用域。这个公开根节点同时用于正文编辑器和主题/CSS 预览，可以避免样式影响设置控件。它从提供片段模板与预览的版本开始可用，较早的应用版本可能没有该节点。CSS 不会被自动限定作用域，规则中需要自己带上前缀；下面示例进一步使用 `[data-cap-content]` 定位其中的 Capricorn 渲染区域。

以下内部选择器核对自 **Capricorn 0.5.12**，适用于安装该运行时后的实时编辑与阅读模式。内部类名可能随编辑器升级调整；Markdown 源码模式、PDF/打印使用其他渲染结构，不保证同一条规则在这些模式中生效。

| 元素 | `.mf-editor-content [data-cap-content]` 内的选择器 |
| --- | --- |
| 标题 | `h1` 至 `h6` |
| 列表项 | `.capricorn-markdown-list-item` |
| 任务项 | `.capricorn-markdown-list-item[data-markdown-task]` |
| 任务复选框 | `.capricorn-markdown-task-checkbox` |
| 列表项文字 | `.capricorn-markdown-list-content` |
| 普通引用 | `blockquote.capricorn-markdown-blockquote` |
| 引用内的其他块 | `.capricorn-markdown-quoted-block` |
| 表格行 | `.capricorn-markdown-table-row` |
| 表头行 | `.capricorn-markdown-table-row[data-markdown-table-header='true']` |
| 表格单元格 | `.capricorn-markdown-table-cell`、`.capricorn-markdown-inline-table-cell` |
| 代码块内的代码编辑器 | `.cm-editor` |

列表项和表格单元格不一定使用 `<li>`、`<td>`，代码块也可能包含 CodeMirror 编辑器。避免改变这些组件的布局和编辑行为。不要依赖文档索引、生成的节点 ID 或虚拟滚动占位元素编写样式；虚拟表格的 DOM 行顺序也不能保证 `nth-child` 始终对应原文档的奇偶行。

### 已完成任务删除线

```css
.mf-editor-content [data-cap-content] .capricorn-markdown-list-item:has(
  > .capricorn-markdown-task-prefix > .capricorn-markdown-task-checkbox:checked
) > .capricorn-markdown-list-content {
  text-decoration: line-through;
}
```

这里通过直接子级关系检查当前任务自己的复选框，只对该项文字应用样式。修改时保留这些关系；宽泛的后代选择器可能同时匹配嵌套列表的其他内容。检查“父任务完成、子任务未完成”和“父任务未完成、子任务完成”两种情况。

### 其他常用示例

```css
/* 标题分隔线 */
.mf-editor-content [data-cap-content] :is(h1, h2) {
  border-bottom: 1px solid var(--mf-theme-border-default);
  padding-bottom: 0.3em;
}

/* 紧凑表格 */
.mf-editor-content [data-cap-content] :is(
  .capricorn-markdown-table-cell,
  .capricorn-markdown-inline-table-cell
) {
  padding: 2px 8px;
}

/* 引用强调，保留嵌套引用的层级线 */
.mf-editor-content [data-cap-content] :is(
  blockquote.capricorn-markdown-blockquote,
  .capricorn-markdown-quoted-block
) {
  background-image: repeating-linear-gradient(
    to right,
    var(--mf-theme-accent-background) 0,
    var(--mf-theme-accent-background) 2px,
    transparent 2px,
    transparent 1em
  );
}
```

引用竖线由背景绘制，仅修改 `border-color` 不会改变它的颜色。示例使用语义变量跟随当前主题。预览样例不能覆盖所有文档结构，应用后仍需检查实际文档和所用的浅色/深色模式，尤其是在编辑器升级之后。

## 旧主题迁移

旧 JS/npm 主题需要转换为 JSON 后重新导入。

1. 将 JS/npm 主题注册改为一个 JSON 文件，为主题和变体设置稳定 ID。把旧 styled token 名转换为语义角色，再通过主题商店导入并校验。
2. 随变体切换的 CSS 放进该变体的 `css`；个人 CSS 作为独立片段导入，检查后逐个启用。原来的旧文件保留在磁盘上，但不会自动加载。
3. 使用 JSON 语义 token 设置配色与排版，避免依赖旧版内部样式名。检查浅色和深色变体，以及选中文字、光标、链接、代码配色与弹层。

主题文件的 `version` 填写 `1`。

## 分享主题

导出 JSON，托管到公开 HTTPS 地址，然后向仓库根目录 `community-themes.json` 提交条目：

```json
{
  "id": "my-theme",
  "name": "My Theme",
  "author": "Your name",
  "version": "1.0.0",
  "url": "https://example.com/my-theme.json"
}
```

索引 ID 必须与下载文件 ID 一致。已有同 ID 主题时，可以替换或另存副本。旧 npm 主题需要由作者转换后重新提交。
