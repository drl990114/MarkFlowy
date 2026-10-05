---
seoTitle: '自定义 MarkFlowy 主题'
description: '使用可视化编辑器和 JSON 创建、编辑、分享 MarkFlowy 主题。'
updatedAt: '2026-10-05'
---

# 自定义主题

主题由 JSON 数据组成，不需要 Node、npm 包或 JavaScript 构建。打开 **设置 → 主题商店**，选择“创建主题”或“复制并编辑”。

## 使用 AI Agent 辅助开发

仓库提供 [MarkFlowy Dev](https://github.com/drl990114/MarkFlowy/tree/main/skills/markflowy-dev) 开发辅助 Skill，目前覆盖自定义主题与 CSS，附带浅色/深色模板，以及校验、导入和分享指南。将 `skills/markflowy-dev` 整个目录复制到所用 Agent 的 Skill 目录即可安装，例如 Codex 的 `~/.agents/skills/markflowy-dev`。

可以这样提问：`使用 $markflowy-dev 创建一个暖纸色的 MarkFlowy 主题，包含浅色和深色变体，并说明如何导入和校验。` 没有源码仓库也可以通过应用主题编辑器完成开发。

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
