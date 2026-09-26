---
seoTitle: '自定义 MarkFlowy 主题'
description: '使用可视化编辑器和 JSON 创建、编辑、分享 MarkFlowy 主题。'
---

# 自定义主题

主题由 JSON 数据组成，不需要 Node、npm 包或 JavaScript 构建。打开 **设置 → 主题商店**，选择“创建主题”或“复制并编辑”。

## 可视化编辑

预览中包含应用控件和真实的 Capricorn 编辑器。选择“检查预览元素”或在预览中右键，可定位该元素对应的 token。右侧支持搜索、只看修改项、颜色透明度、字体、排版和语法色。

每个 token 可以设置具体值，也可以关联同类型的另一个 token。恢复默认会删除覆盖，重新使用默认值或关联；引用循环和错误值会显示错误。一次取色拖动可以整体撤销。高级区可编辑 JSON 和主题 CSS。

每个主题在当前窗口中分别保存草稿，包括活动变体和未应用的 JSON。应用或丢弃 JSON 修改后，才能继续可视化编辑和导出。“保存并应用”会更新主题库、应用外观和其他窗口。关闭编辑页后可恢复或丢弃草稿；内置主题的修改保存为个人副本。交互预览在独立的 iframe 文档中运行，编辑器输入和弹层也位于预览内部。

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

`id` 是稳定身份，长度为 1–80 个字符，只能使用小写字母、数字、点、下划线和连字符，且以字母或数字开头；名称可以随时修改。一个文件可包含多个浅色或深色变体。`tokens` 可省略，缺失字段使用该模式的默认值。示例见 [Paper](../../themes/paper.json)。主题页可以导出与当前版本一致的 JSON Schema。

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

主题库和片段保存在应用数据目录的 `themes-v1.json`，通过临时文件和原子替换写入。旧 JS 主题、旧自动加载 CSS 不会执行或迁移，原文件不会删除。缺失或失效的主题会暂时回退内置主题，同时保留已选身份，修复后会恢复；主动删除主题才会重置相应选择。

语义 CSS 变量使用 `--mf-theme-` 前缀，点和驼峰转换为连字符，例如 `--mf-theme-surface-canvas`、`--mf-theme-font-editor-line-height`。Desktop 控件和 Capricorn 文档适配层消费这些变量。CSS 覆盖只影响对应消费者，不会反向修改 JSON 引用或 RME 已解析的 JavaScript 配色；需要跨渲染器生效时应修改 JSON token。旧 `--mf-*` facade 别名属于内部实现：其中 `--mf-accent` 表示控件悬停背景，与公开的 `accent.background` 用途不同。

## Capricorn 0.3.0 主题契约

MarkFlowy 已集成 `@drl990114/capricorn-runtime@0.3.1`，沿用 0.3.0 引入的主题契约，由 `scripts/install-capricorn-runtime.mjs` 和 `apps/desktop/capricornRuntimeResolver.ts` 固定精确版本。安装器校验正式 tarball 的 SHA-256 和包身份。发布来源与验证记录见[启动性能文档](../../STARTUP_PERFORMANCE.md#capricorn-031-release-integration-2026-09-26)。

Capricorn 自己提供 `--cap-*` 默认值，不再读取 `--mf-*` 或 `--rme-*` 回退变量。MarkFlowy 将解析后的语义 token 显式映射到每个编辑器实例及其弹层。主题作者通常只需修改 JSON token；单独嵌入 Capricorn 的宿主需要自行传入对应的 Capricorn 变量。

| MarkFlowy 语义 token | Capricorn 实例样式 |
| --- | --- |
| `editor.background`、`editor.foreground` | `--cap-surface`、`--cap-text` |
| `editor.caret`、`editor.link` | `--cap-caret`、`--cap-link` |
| `accent.background`、`accent.foreground`、`accent.subtle` | `--cap-accent`、`--cap-accent-foreground`、`--cap-accent-soft` |
| `editor.selection.background`、`editor.selection.foreground` | `--cap-selection`、`--cap-selection-foreground` |
| `editor.selection.inactiveBackground` | `--cap-inactive-selection` |
| `editor.code.background`、`editor.code.foreground` | `--cap-code-background`、`--cap-code-color` |
| `syntax.keyword`、`syntax.string`、`syntax.function` | `--cap-code-token-keyword`、`--cap-code-token-string`、`--cap-code-token-title` |
| `status.success.foreground`、`status.danger.foreground` | `--cap-code-token-inserted`、`--cap-code-token-deleted` |
| `font.ui.family`、`font.code.family` | `--cap-font-ui`、`--cap-font-mono` 和 `--cap-code-font-family` |
| `font.editor.family` | `style.fontFamily` |
| `font.editor.size`、`font.editor.lineHeight` | `--cap-editor-font-size`、`--cap-editor-line-height` |
| `editor.contentWidth` | `--cap-editor-content-width`；Desktop 全宽偏好可以覆盖它 |

runtime 导出 `CapricornThemeVariable` 和 `CapricornThemeStyle`。创建选项和 `runtime.updateSettings({ style, colorScheme })` 均接受这些样式。更新时传入完整的新样式映射，因为它会替换原来的 `style` 对象；更新现有实例不会重置文档。宿主选择浅色或深色变体时，应显式设置 `colorScheme`。

代码高亮使用稳定的 `.cap-syntax-*` 类，例如 `.cap-syntax-keyword`、`.cap-syntax-title`，颜色来自 `--cap-code-token-*`。其中 `variable` 表示变量标识符，`attribute` 包括属性、普通对象属性、类名和命名空间，`title` 表示函数或方法名（对应 MarkFlowy 的 `syntax.function`）。Diff 行背景通过 `color-mix` 将 `--cap-code-token-inserted` 或 `--cap-code-token-deleted` 的颜色以 10% 比例与透明色混合，随宿主的语义状态色更新。高级定制优先使用这些变量及稳定的 `data-cap-*`/`data-slot` 属性，避免依赖 CodeMirror 生成类名。文档编辑器跟随应用的语义 CSS 变量。独立预览在 iframe 文档根节点定义自己的语义变量，并在该文档内部映射给 Capricorn；只有显式勾选预览选项时，才会加入个人 CSS 片段。

## 旧主题迁移

这是主题格式和宿主契约的破坏性变更，不提供兼容加载器。

1. 将 JS/npm 主题注册改为一个 JSON 文件，为主题和变体设置稳定 ID。把旧 styled token 名转换为语义角色，再通过主题商店导入并校验。
2. 随变体切换的 CSS 放进该变体的 `css`；个人 CSS 作为独立片段导入，检查后逐个启用。原来的旧文件保留在磁盘上，但不会自动加载。
3. 替换对内部 `--mf-*`/`--rme-*` 别名或生成类名的依赖。MarkFlowy 主题使用 JSON 语义 token，独立 Capricorn 宿主显式传入 `--cap-*` 实例样式。检查浅色和深色变体，以及选中文字、光标、链接、代码配色与弹层。

主题 JSON 仍使用 `version: 1`；它表示文件格式版本，与 Capricorn runtime 版本相互独立。

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
