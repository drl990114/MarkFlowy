# UPDATE LOG

## v0.34.1

Features:

- Support setting the default editing mode when opening Markdown files in the editor.

- Support offline installation bundle for Windows.

- Support right-clicking on the blank area of the file tree to create new files and new folders.

Fixes:

- Enhance error handling during AI conversations to display error messages.

- Remove the default setting of baseUrl for OpenAI. If older versions encounter OpenAI request failures, try deleting the baseUrl setting first.

- Some style and performance optimizations.

---

特性：

- 支持设置编辑器打开 Markdown 文件时的默认编辑模式。

- 支持 Windows 的 offline 安装包。

- 支持右键文件书的空白地方创建新文件和新文件夹。

修复：

- 增强 AI 对话时的错误处理，显示错误信息。

- 取消 OpenAI 的 baseUrl 默认设置，老版本如果遇到 OpenAI 请求失败问题，可以先尝试删除 baseUrl 设置。

- 一些样式和性能优化。

## v0.33.0

Features:

- Support processing images when copying in the editor (e.g., copy as base64, save to local folder, save to workspace relative path).

- Support editing multiple files when the workspace is empty.

- Change the image in Markdown syntax to a node implementation, supporting drag to resize.

- Support Japanese language.

Fixes:

- Optimize the trigger conditions of the `Slash menu`.

---

特性：

- 支持在编辑器复制图片时，对其做处理（如复制为base64、保存到本地文件夹、保存到工作区相对路径）

- 支持在空工作区的时候，编辑多个文件

- Markdown 语法的图片改为 node 实现方式，支持拖拽调整大小

- 支持日语

修复：

- 对 Slash 菜单的触发条件做了优化。

## v0.32.0

Features:

- Support Math node for mathematical formulas.

- Support softbreak (single line break), which can be inserted with `Shift + Enter` or `mod + Enter`. Pressing `Enter` directly will insert a new paragraph (double line break).

- Support copying code block content.

- Image loading supports absolute paths, prioritizing relative paths first.

Fixes:

- Optimize the trigger conditions of the `Slash menu` to be compatible with more language keyboards.

---

特性：

- 支持 Math 数学公式节点。

- 支持 softbreak（单换行符），可以通过 `Shift + Enter` 或 `mod + Enter` 插入，直接 `Enter` 则插入新的段落（双换行符）。

- 支持复制代码块内容。

- 图片加载支持绝对路径，优先尝试相对路径。

修复：

- 对 Slash 菜单的触发条件做了优化，兼容更多语言键盘。

## v0.31.0

Features:

- The slash menu supports search and enhanced directional movement.

- The original file path is changed to display the last update time, and supports clicking to view file size and other information.

Fixes:

- Fix the issue that image elements cannot be loaded in base64 format.

- Fix the issue that the slash menu cannot be invoked with the Chinese input method.

---

特性：

- Slash 菜单支持搜索，并且加强了方向移动。

- 原有的文件路径改为显示上次更新时间，支持点击查看文件大小等信息。

修复：

- 修复图片元素无法加载 base64 格式的问题。

- 修复中文输入法无法唤起 slash 菜单的问题。


## v0.30.2

Fixes:

- Fix the issue of Chinese input not taking effect in specific situations on macOS.

---

修复：

- 修复 macOS 特定情况下中文输入无效的问题。

## v0.30.1

Features:

- Support distinguishing between git remote and git local.

Fixes:

-  Some style optimizations.

---

特性：

- 同步方式区分 git 远程和 git 本地。

修复：

- 一些样式优化。

## v0.30.0

Features:

- Support refresh folder data.

- Support pull changes from remote Git repository.

- In Table, arrow up/down keys move rows, left/right keys move columns.

Fixes:

- Fix the issue of inserting a table when editing `-` + `space` in Table

- Some style and performance optimizations.

---

特性：

- 支持刷新文件夹数据。

- 支持同步远程 Git 仓库的更改。

- Table 内方向键改为上下键移动行，左右键移动列。

修复：

- 修复 Table 中编辑 `-` + `空格` 时会插入表格的问题。

- 一些样式与性能优化。

## v0.29.0

Features:

- Support quick management of Git repositories, such as staging, committing, and pushing (beta version, welcome to discuss features or report issues on GitHub).

- When exiting the application, check for unsaved files and prompt the user to save or discard changes.

- Confirm whether to cancel or save when renaming a file loses focus through a popup.

- Layout adjustments and style optimizations.

- Update the update check to support UpgradeLink nodes, improving update speed for users in China.

Fixes:

- Fix the positioning issue of the table's menu button.

---

特性：

- 支持 Git 仓库的快捷管理，如暂存、提交、推送（beta版，欢迎在 Github issue 中讨论特性或反馈问题）

- 退出应用时，检查未保存的文件，提示用户保存或放弃更改。

- 重命名文件失去焦点时，通过弹窗确认是取消还是保存。

- 布局调整和样式优化。

- 检查更新支持 UpgradeLink 节点，提升中国用户的更新速度。

修复：

- 修复表格的菜单按钮定位问题。

## v0.28.3

Fixes:

- Fix the issue of losing format when pasting Excel data.

- Optimize the display of the bottom status bar and adjust it to display on the right side.

---

修复：

- 修复粘贴 excel 时格式丢失的问题。

- 优化底部状态栏显示和调整到右侧显示。

## v0.28.1

Features:

- Support folding file trees and quick positioning of file tree focus.

- Adjust EditorCount positioning and opacity

---

特性：

- 支持折叠文件树和快速定位文件树焦点。

- 调整文件字数统计的位置和透明度。

## v0.27.1

Fixes:

- fix the table of contents link not working when clicking on the heading node.

---

修复：

- 修复点击标题节点时链接跳转不生效的问题。

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

Fixes:

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

Fixes:

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

Fixes:

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

Fixes:

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

Fixes:

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

Fixes:

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

Fixes:

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

Fixes:

- Fix language settings can not select.

## v0.14.0

Features:

- Improve html inline editing experience.

## v0.13.1

Features:

- Support trash file and folder.

- Improve html image node loading display.

Fixes:

- revert html inline node parse method.

## v0.12.3

Fixes: 

- Init layout visible status when open app.

- Prevent default behavior of shortcut keys.

- Stuck when adjusting file tree size on WindowsOS.

## v0.12.0

Features:

- Add right bar to show table of content.

- Support show table of content in source code mode.

Fixes:

- Search result display error when paragraph has inline node.


## v0.11.3

Fixes: 

- Preview mode load some image error.

- Updater does not work on WindowsOS.

## v0.11.2

Fixes: 

- Some image can't load.

## v0.11.1

> In order to understand the current operation of the app, we have integrated the most basic user statistics.

Features:

- Support setting editor font size and line height.

- When hovering over a heading node, the level prefix will be displayed.

- Titlebar display active file name and edit state.

- Support restore window state(e.g size, position).

Fixes: 

- The copied image link should not be processed.

- when users new a file or new a folder, all opened files should not be forced to close.

- when click rename input , cursor should not blur.

## v0.10.2

Features:

- Explorer support create folder.

- Explorer support rename file or folder.

Fixes: 

- Long file name display optimization.

- problem with displaying line breaks in the table for `br`.

- Titlebar window maximize button display error.

- Some ui and ux optimization, Theme colors optimization.

## v0.9.2

Fixes:

- New files are not allowed temporarily. When the workspace is empty.

## v0.9.1

Fixes:

- Fixed cmd + A don't work in codemirror node.

- Fixed codemirror history is not effective globally.


## v0.9.0

Features:

- Support preview mode

- Better html inline node

- Add tooltip to sidebar item.

Fixes:

- Fixed the table of contents doesn't refresh while switching different md files.

- Fixed reference text not show in editor.

- Some ui and ux optimization.


## v0.8.0

Features:

- Support Table column and row selection.

- Support ChatGPT get post summary.

- Support ChatGPT translate post.

- Multi-language support French.

Fixes: 

- Code block lang menu style error.

- Codemirror highlight error.

- Some ui and ux optimize.


## v0.7.7

Fixes: 

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

Fixes:

- Some image load error.

- Delete file should confirm.

- Clipboard paste error.

- Some ui bugs.


## v0.7.5

updater test
