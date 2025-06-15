# UPDATE LOG

## v0.27.0

Features:

- Enhance WYSIWYG editor toolbar.

- Optimize the problem of long stuck opening of large folders.

--- 

特性：

- 增强所见即所得编辑器工具栏。

- 优化大文件夹打开时长卡顿的问题。

## v0.26.0

Features:

- Support open and edit .txt files.

Fixs:

- Fallback Tauri version to fix image loading failure issue.

- The accent color changes brighter in dark mode.

- Improve image file preview style.

---

特性：

- 支持打开和编辑 .txt 文件。

修复：

- 回退 Tauri 版本以修复图片加载失败的问题。

- 深色模式下强调色变亮的问题。

- 优化图片文件预览样式。

## v0.25.0

Features:

- Support AI generation within documents, create AI nodes through slash menu.

Fixs:

- Fix font list loading error.

---

特性：

- 支持在文档内生成 AI 节点，通过斜杠菜单创建。

修复：

- 修复字体列表加载错误的问题。

## v0.24.0

Happy International Labor Day, everyone！

Features:

- Support opening files through the `Open with` menu.

- Support drag and drop folder in app icon to open.

Fixs:

- Fix input chinese cursor instability in chrome.

- Fix json file edit highlight error.

---

祝大家国际劳动节快乐！

特性：

- 支持通过文件的 `打开方式` 菜单打开文件。

- 支持将文件夹拖放到应用图标上打开。

修复：

- 修复在 Chrome 中输入中文时光标不稳定的问题。

- 修复 JSON 文件编辑高亮错误的问题。

## v0.23.1

Features:

- Support custom editor font family.

- Support reset app settings.

- Change default code font to Fira Code.

Fixs:

- Fix create new file display empty.

---

特性：

- 支持自定义编辑器字体。

- 支持重置应用设置。

- 将默认代码字体更改为 Fira Code。

修复：

- 修复新建文件显示空白的问题。

## v0.22.1

Features:

- Support opening images and JSON files.

- Use xdg standards's config file path, in linux and macOS.

Fixs:

- The issue of the preview mode not taking effect when switching to WYSIWYG mode.

- Optimized error handling and crash issues.

---

特性：

- 支持打开图片和 JSON 文件。

- 在 Linux 和 macOS 中使用 xdg 标准的配置文件路径。

修复：

- 预览模式在所见即所得模式切换不生效的问题。

- 优化错误处理和崩溃问题。

## v0.21.0

Features:

- Support opening individual files.

- Support display editing file full path in the editor.

Fix:

- Fix the issue of AI translation and summary not taking effect.

- Fix the issue of multiple editor instances causing paste failure.

- Improve the performance and ui of the editor.

---

特性：

- 支持打开单个文件。

- 支持在编辑器中显示正在编辑的文件的完整路径。

修复：

- 修复 AI 翻译、摘要没生效的问题。

- 修复多个实例导致粘贴失败的问题。

- 优化编辑器性能和样式。

## v0.20.0

Features:

- Support DeepSeek and Ollama AI providers.

- Support Mermaid diagram node.

Fixs:

- Fixed the issue where the content of the HTML Inline node may be incomplete during parsing.

---

特性：

- 支持 DeepSeek 和 Ollama AI 服务商。

- 支持 Mermaid 图表节点。

修复：

- 修复解析 HTML 内联节点时内容可能不完整的问题。

## v0.19.0

Features:

- Supplement error capture and reporting

Fixs:

- Fixed the issue where inlining HTML tags in the **Heading** node would result in errors.

## v0.18.1

Features:

- Support create file when workspace is empty.

- Improve ui display and layout.

## v0.17.0

Features:

- Support export markdown file to html.

- Support export markdown file to image.

- Support duplicate file.

- Optimize the performance of the editor.

## v0.16.0

Features:

- Support drag and drop file node to move.

- Add Spanish translations.

## v0.15.0

Features:

- Add support for customize "chatgpt" api base url and model lists. (#731)

- Update tauri to stable version 2.0.1.

Fixs:

- Fix language settings can not select.

## v0.14.0

Features:

- Improve html inline editing experience.

## v0.13.1

Features:

- Support trash file and folder.

- Improve html image node loading display.

Fixs:

- revert html inline node parse method.

## v0.12.3

Fixs: 

- Init layout visible status when open app.

- Prevent default behavior of shortcut keys.

- Stuck when adjusting file tree size on WindowsOS.

## v0.12.0

Features:

- Add right bar to show table of content.

- Support show table of content in source code mode.

Fixs:

- Search result display error when paragraph has inline node.


## v0.11.3

Fixs: 

- Preview mode load some image error.

- Updater does not work on WindowsOS.

## v0.11.2

Fixs: 

- Some image can't load.

## v0.11.1

> In order to understand the current operation of the app, we have integrated the most basic user statistics.

Features:

- Support setting editor font size and line height.

- When hovering over a heading node, the level prefix will be displayed.

- Titlebar display active file name and edit state.

- Support restore window state(e.g size, position).

Fixs: 

- The copied image link should not be processed.

- when users new a file or new a folder, all opened files should not be forced to close.

- when click rename input , cursor should not blur.

## v0.10.2

Features:

- Explorer support create folder.

- Explorer support rename file or folder.

Fixs: 

- Long file name display optimization.

- problem with displaying line breaks in the table for `br`.

- Titlebar window maximize button display error.

- Some ui and ux optimization, Theme colors optimization.

## v0.9.2

Fixs:

- New files are not allowed temporarily. When the workspace is empty.

## v0.9.1

Fixs:

- Fixed cmd + A don't work in codemirror node.

- Fixed codemirror history is not effective globally.


## v0.9.0

Features:

- Support preview mode

- Better html inline node

- Add tooltip to sidebar item.

Fixs:

- Fixed the table of contents doesn't refresh while switching different md files.

- Fixed reference text not show in editor.

- Some ui and ux optimization.


## v0.8.0

Features:

- Support Table column and row selection.

- Support ChatGPT get post summary.

- Support ChatGPT translate post.

- Multi-language support French.

Fixs: 

- Code block lang menu style error.

- Codemirror highlight error.

- Some ui and ux optimize.


## v0.7.7

Fixs: 

- Editor performance optimization.
  
- Chinese translation supplement.


## v0.7.6

Features:

- Support custom theme.

- Support add file to root folder.

- Html Image and Iframe inlinnode, and can resize.

- Support table of content level display

- Support editarea full width setting.

- Support slash menu for commands.

Fixs:

- Some image load error.

- Delete file should confirm.

- Clipboard paste error.

- Some ui bugs.


## v0.7.5

updater test
