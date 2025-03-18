# UPDATE LOG

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
