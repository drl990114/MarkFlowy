# UPDATE LOG

## v0.90.0

Features:

- Added Pandoc export for Markdown documents in DOCX, ODT, and EPUB formats. Open a Markdown document, choose **More → Export with Pandoc** from the editor toolbar, then select a format; Pandoc can be detected automatically or configured under **Settings → Export**.

- Added drag-and-drop tab management. Drag a tab along the tab bar to reorder it, or drop it onto another split editor's tab bar to move the document between editor groups; drop indicators and edge auto-scrolling help with longer tab lists.

- Added external file-change synchronization for open documents. Clean documents reload automatically when changed by another application; if the document also has local edits, use the alert below the editor to **Update** from disk or **Overwrite** the disk version with the current content.

- Added path-copy actions to the File Tree. Right-click a file or folder, then choose **Copy → Copy path** or **Copy relative path** to copy its absolute path or its path relative to the current workspace.

Improvements and Fixes:

- Improved File Tree startup and folder collapsing. The workspace root now opens automatically, and the **Collapse All** button on the right side of the root row reliably closes every subfolder while keeping the workspace root visible.

---

特性：

- Markdown 文档新增 Pandoc 导出，支持 DOCX、ODT 和 EPUB 格式。打开 Markdown 文档后，在编辑器工具栏的“更多”菜单中选择“使用 Pandoc 导出”，再选择目标格式；可自动检测 Pandoc，也可前往“设置 → 导出”配置其可执行文件。

- 新增标签页拖拽管理。拖动顶部标签页可调整同一分组内的顺序，也可将其拖到其他分屏的标签栏，在编辑器分组之间移动文档；较长的标签列表还支持落点提示和边缘自动滚动。

- 新增已打开文档的外部文件变更同步。文档没有本地修改时，会自动载入其他应用写入的最新内容；如果同时存在本地编辑，可在编辑器底部提示条中选择“更新”以载入磁盘版本，或选择“覆盖”以用当前内容替换磁盘版本。

- 文件树新增路径复制操作。右键点击文件或文件夹，在“复制”子菜单中选择“复制路径”或“复制相对路径”，即可复制绝对路径或相对于当前工作区的路径。

改进与修复：

- 改进文件树的初始展开与文件夹收起行为。工作区根节点现在会自动展开；点击根节点右侧的“折叠全部”按钮，可可靠收起所有子文件夹并保持工作区根节点可见。

## v0.89.0

Features:

- Added interactive image preview controls for zooming in or out, viewing at actual size, and fitting images to the editor window.

- Local file links in Markdown now open directly in the current editor group, with relative paths resolved from the current document; web links continue to open in the browser.

- Added a compact workspace switcher in the title bar or status bar, with search for recent workspaces and quick actions to open another folder or clear recent history.

Improvements and Fixes:

- Reworked WYSIWYG lists around the standard nested-list model, improving bullet, ordered, and task list conversion, Markdown round-tripping, Enter and Backspace behavior, and task checkbox alignment.

- Improved File Tree navigation with a workspace root that stays visible while scrolling and clearer file and folder icons.

- Refined startup and appearance restoration so the selected theme and application shell are restored more consistently while a workspace loads, with clearer retry and workspace-change states.

---

特性：

- 图片预览新增交互式缩放控制，支持放大、缩小、按实际尺寸显示以及适应编辑器窗口。

- Markdown 中的本地文件链接现在会直接在当前编辑器分组内打开，相对路径会基于当前文档解析；网页链接仍会在浏览器中打开。

- 标题栏或状态栏新增紧凑的工作区切换器，可搜索最近使用的工作区，并快速打开其他文件夹或清空最近记录。

改进与修复：

- 将所见即所得列表统一迁移到标准嵌套列表模型，改进无序列表、有序列表和任务列表的转换、Markdown 往返序列化、Enter 与 Backspace 行为，以及任务复选框的对齐。

- 改进文件树导航，滚动时保持工作区根节点可见，并提供更清晰的文件与文件夹图标。

- 优化启动与外观恢复逻辑，在工作区加载期间更一致地恢复所选主题和应用框架，并提供更清晰的重试与切换工作区状态。

## v0.88.0

Features:

- Added hierarchical heading numbering in WYSIWYG mode. Open the Table of Contents panel on the right, then click the ordered-list button in the upper-right corner of its header to add or remove Arabic prefixes such as `1、` and `1.1、`; numbered documents keep their heading paths synchronized when headings are inserted or reordered.

- Added Print / Export PDF for Markdown documents. 

- Added a pure-character count mode to the status bar, excluding spaces, line breaks, and other whitespace.

- Added a Windows x64 Portable ZIP that can be extracted and run without installation. It uses the system WebView2 Runtime and keeps MarkFlowy's existing user-level data location.

Improvements and Fixes:

- Improved WYSIWYG block dragging with more reliable block selection, drag previews, and editor-native HTML and plain-text transfer data when moving or copying content.

- Polished the compact Desktop interface across tabs, sidebars, toolbars, the status bar, Settings, and workspace information, with more consistent tooltips, control styling, and keyboard-accessible tabs.

---

特性：

- 所见即所得模式新增层级标题编号。打开右侧“目录”面板，点击面板标题栏右上角的有序列表按钮，即可一键添加或移除 `1、`、`1.1、` 等阿拉伯数字前缀；在已编号文档中插入或重排标题时，层级路径会自动同步。

- Markdown 文档新增“打印 / 导出 PDF”。

- 底部状态栏新增“纯字符”统计模式，不计空格、换行和其他空白字符。

- 新增 Windows x64 Portable ZIP，解压后即可运行，无需安装；该版本使用系统 WebView2 Runtime，并继续使用 MarkFlowy 现有的用户级数据目录。

改进与修复：

- 改进所见即所得模式的块拖拽，提升块选中、拖拽预览以及移动或复制内容时 HTML 和纯文本传输的可靠性。

- 统一标签栏、侧边栏、工具栏、状态栏、设置页及工作区信息的紧凑视觉和交互，并改进 Tooltip、控件样式及标签页的键盘操作。

## v0.87.0

Features:

- Added Zen Mode for distraction-free writing. With a document open, click the focus icon at the far right of the bottom status bar, or press Cmd/Ctrl + Shift + F. Zen Mode hides sidebars, tabs, toolbars, the status bar, and inactive split panes while preserving the current editor and layout state. Press the same shortcut or Escape twice to exit and restore the previous layout.

- Redesigned Settings as a dedicated full-page experience with search, clearer category navigation, a more compact responsive layout, and improved accessibility. Use Back to App or press Escape to return to the editor.

- Enhanced WYSIWYG table editing with header rows and left, center, and right column alignment. New tables now start with a header row, inserted rows retain column alignment, and Markdown alignment is preserved when opening and saving documents. Repeatedly pressing Cmd/Ctrl + A inside a table now selects the current cell, then the table, then the whole document.

Improvements and Fixes:

- Reorganized editor-group actions around the tab bar, making new-tab, split-editor, group, and sidebar controls easier to find and use in multi-pane layouts.

- Improved copy, cut, and paste behavior around embedded code, HTML, Mermaid, and math editors. Cross-block selections now preserve their Markdown structure and block metadata more reliably, while selections contained inside an embedded editor continue to behave locally.

- Fixed Preview images that could render as fallback text, especially remote SVG badges. Image loading now preserves source information, retries the original remote URL when needed, and uses a subtler non-blocking progress indicator.

---

特性：

- 新增 Zen Mode（禅模式），提供更专注的写作空间。打开文档后，可点击底部状态栏最右侧的专注图标，或按下 Cmd/Ctrl + Shift + F 进入；进入后会隐藏侧栏、标签栏、工具栏、状态栏及非活动分屏，同时保留当前编辑器和布局状态。再次使用同一快捷键或连续按两次 Esc，即可退出并恢复此前布局。

- 将设置改版为独立的全页面体验，新增设置搜索和更清晰的分类导航，并优化紧凑布局、响应式显示及无障碍体验。可点击“返回应用”或按下 Esc 回到编辑器。

- 增强所见即所得表格编辑，支持表头行以及左对齐、居中和右对齐。新建表格默认包含表头，插入新行时会继承列对齐方式，打开和保存文档时也会保留 Markdown 表格对齐信息。在表格内连续按 Cmd/Ctrl + A，会依次选中当前单元格、整张表格和整个文档。

改进与修复：

- 重新整理标签栏附近的编辑器分组操作，让新建标签、拆分编辑器、分组操作及侧栏开关在多分屏布局中更易发现和使用。

- 改进代码、HTML、Mermaid 和数学公式等嵌套编辑器周围的复制、剪切与粘贴行为。跨块选区现在能更可靠地保留 Markdown 结构和块元数据，嵌套编辑器内部的局部选区仍保持原有操作方式。

- 修复预览图片可能显示为替代文字的问题，尤其是远程 SVG 徽章图片；现在会保留图片源信息，必要时回退到原始远程地址，并使用更轻量且不遮挡内容的加载进度提示。

## v0.86.0

Features:

- 🌟🌟🌟🌟🌟🌟 The web version is now officially launched, supporting online editing of GitHub repositories and local browser editing. We look forward to your use and feedback! https://www.markflowy.cc

Improvements and Fixes:

- Improved WYSIWYG Markdown handling for inline links and quotes containing only images, enhancing the display and selection reliability of source code markers surrounding inline images, links, autolinks, and other atomic inline content.

- Fixed an issue that incorrectly inserted blank lines between adjacent items in unordered lists, ordered lists, and task lists when serializing Markdown in WYSIWYG mode.

- Improved editor initialization and lifecycle stability, and fixed a module initialization issue that could prevent the editor from rendering.

- Optimize the style and loading logic of image nodes.

---

特性：

- 🌟🌟🌟🌟🌟🌟 Web 端正式上线，支持在线编辑 github repo 以及纯浏览器本地编辑，期待大家的使用与反馈！https://www.markflowy.cc/zh

改进与修复：

- 改进所见即所得模式对仅包含图片的行内链接和引用式链接的 Markdown 处理，提升行内图片、链接、自动链接及其他原子行内内容周围源码标记的显示与选区可靠性。

- 修复所见即所得模式序列化 Markdown 时，在无序列表、有序列表和任务列表的相邻条目之间错误插入空行的问题。

- 提升编辑器初始化与生命周期稳定性，并修复可能导致编辑器无法渲染的模块初始化问题。

- 优化图片节点的样式和加载逻辑

## v0.85.2

Features:

- Expanded Mermaid support with ELK and tidy-tree layouts, Lucide and Logos icon packs, and better rendering for complex directional subgraphs.

- Added a manual collapse control for Live Preview source panels, so the source can be hidden when it is no longer needed, including in the always-split layout.

---

特性：

- 扩展 Mermaid 支持，新增 ELK 与 tidy-tree 布局、Lucide 与 Logos 图标包，并优化复杂方向子图的渲染效果。

- 为实时预览的源码面板新增手动收起操作；不再需要查看源码时可直接隐藏，在始终分栏布局下也可以使用。

## v0.85.0

Features:

- Added a unified image insertion flow to both Source Code and WYSIWYG modes. Images can now be inserted from an HTTP/HTTPS URL or selected from the local computer through the toolbar and slash menu, with local files handled according to the image settings.

- Improved table keyboard navigation: use Mod + Enter to leave the current table and continue writing in a new paragraph below it, while Shift + Enter continues to insert a line break inside the current cell.

Improvements and fixes:

- Redesigned the update dialog with clearer version and release date information, rich Markdown release notes, and support for opening external links.

- Fixed case-only file and folder renames on case-insensitive file systems while preserving conflict detection for existing paths.

- Improved Windows CLI installation and update reliability by repairing outdated wrappers, prioritizing the managed CLI path, cleaning up legacy executables, and avoiding console flashes during process checks.

---

特性：

- 为源码模式和所见即所得模式新增统一的图片插入流程。现在可通过工具栏或斜杠菜单插入 HTTP/HTTPS 网络图片，或从电脑选择本地图片；本地图片会按照图片设置中的规则进行处理。

- 优化表格键盘操作：使用 Mod + Enter 可退出当前表格，并在表格下方的新段落中继续输入；Shift + Enter 仍会在当前单元格内插入换行。

改进与修复：

- 重新设计更新提示弹窗，更清晰地展示版本号、发布日期和 Markdown 格式的更新说明，并支持打开外部链接。

- 修复在大小写不敏感的文件系统上仅修改文件或文件夹名称大小写时被误判为名称冲突的问题，同时保留对真实路径冲突的检测。

- 提升 Windows CLI 的安装和更新可靠性，可修复过期的命令包装器、优先使用 MarkFlowy 管理的 CLI 路径、清理旧版可执行文件，并避免进程检测时出现控制台闪烁。

## v0.84.0

Features:

- Upgraded Preview mode with richer rendering for syntax-highlighted code, HTML, Mermaid diagrams, and inline and block math, including fenced math blocks and theme-aware Mermaid diagrams.

- HTML, Mermaid, and block math live previews now use a preview-first workflow. Source code opens while editing or in fullscreen, collapses after editing, and can optionally remain side by side with the preview.

Improvements and fixes:

- Improved preview image loading with skeleton and progress feedback, lazy asynchronous decoding, and more reliable handling of local, remote, and reference images. Image export now waits for pending preview resources.

- Improved preview security and reliability with safer HTML and Mermaid rendering, isolated block errors, interactive HTML content, better text wrapping, keyboard and focus handling, and accessibility.

---

特性：

- 升级预览模式，增强代码高亮、HTML、Mermaid 图表及行内和块级公式的渲染，并支持围栏式数学公式和跟随主题变化的 Mermaid 图表。

- HTML、Mermaid 和块级公式实时预览采用“预览优先”交互：编辑或进入全屏时显示源代码，编辑结束后自动收起，也可在设置中选择始终并排显示源码和预览。

改进与修复：

- 优化预览图片加载，新增骨架屏和加载进度提示、懒加载及异步解码，并提升本地、远程和引用式图片的处理可靠性；导出图片时会等待预览资源加载完成。

- 提升预览的安全性与稳定性，包括更安全的 HTML 和 Mermaid 渲染、错误块隔离、可交互的 HTML 内容，以及更好的文本换行、键盘焦点和无障碍体验。

## v0.83.0

Features:

- Redesigned Chat AI with a new conversation interface, workspace-based history, conversation export, and controls for editing, regenerating, branching, and deleting messages.

- Chat AI can now use the current document or multiple open files as context, discover available models automatically, and connect to local Ollama models more easily.

- Refreshed Settings, theme controls, dialogs, and common form components for a more consistent and accessible experience.

Improvements and fixes:

- Improved editor and file explorer performance, especially when working with multiple tabs, searches, and larger workspaces.

- Made saving, Save As, workspace switching, and file rename, move, delete, and drag-and-drop operations safer and more reliable, including better handling of concurrent changes and path conflicts.

- Fixed flickering during file rename validation and improved editor layout stability.

---

特性：

- 全新设计 Chat AI 对话界面，支持按工作区保存对话历史、导出对话，以及编辑、重新生成、切换分支和删除消息。

- Chat AI 现在可以将当前文档或多个已打开文件作为上下文，支持自动发现可用模型，并优化了本地 Ollama 模型的连接体验。

- 更新设置页、主题配置、弹窗及常用表单组件，提供更加统一且易用的交互体验。

改进与修复：

- 优化编辑器和文件树性能，在多标签、搜索及大型工作区场景下更加流畅。

- 提升保存、另存为、工作区切换，以及文件重命名、移动、删除和拖拽操作的安全性与可靠性，更好地处理并发修改和路径冲突，降低内容丢失风险。

- 修复文件重命名校验时的闪烁问题，并提升编辑区域布局稳定性。

## v0.82.1

Features:

- Support quick date insertion in the editor via mod + ;

- Added install-linux.sh script for easier downloading.

Fixes:

- Optimized table overflow styles.

- Fixed theme changes following the system settings.

- Fixed image export issues.

---

特性：

- editor 支持快速插入日期，通过 mod + ;

- 新增 install-linux.sh 脚本，更方便下载。

修复：

- 优化表格溢出的样式

- 修复跟随系统的主题变化

- 修复图片导出问题


## v0.82.0

Features:

- Added file exclusion patterns setting, integrated with the file explorer and search.

- Enhanced CLI window management and command execution for more reliable command-line workflows.

- Added split editor layout support.

- Added accent color customization in appearance settings.

- Improved HTML live preview rendering with details support and additional tests.

Fixes:

- Normalized font family values for valid CSS and more reliable theme rendering.

- Improved Windows system theme detection and synchronization for better consistency when following the system theme.

---

特性：

- 新增文件排除规则设置，集成到文件树和搜索。

- 增强 CLI 的窗口管理与命令执行能力，提升命令行工作流可靠性。

- 支持分屏 editor 布局。

- 外观设置新增强调色自定义。

- 改进 HTML 实时预览渲染，支持 details 内容并补充相关测试。

修复：

- 规范字体族配置为合法 CSS 值，提升主题渲染稳定性。

- 优化 Windows 系统主题检测与同步，提升跟随系统主题时的一致性。

## v0.81.5

Features:

- Improved live preview blocks for HTML, Mermaid, and math with a unified editing experience, preview toggle, copy source, and fullscreen preview support.

- Improved block transform and slash menu interactions, including better menu scrolling, outside-click closing, and more reliable selection behavior.

- Improved desktop startup and editor loading with lazy-loaded editor panels and a loading skeleton while file content is being prepared.


- Improved Windows CLI installation with a more reliable command wrapper.

Fixes:

- Fixed focus and visual issues around slash menu and context menu interactions.

---

特性：

- 改进 HTML、Mermaid 和数学公式的实时预览块，统一编辑体验，并支持预览切换、复制源码和全屏预览。

- 改进块转换菜单和斜杠菜单交互，包括菜单滚动、点击外部关闭以及选区保持。

- 优化桌面端启动和编辑器加载，编辑区域按需加载，并在文件内容准备期间显示加载占位。

- 改进 WindowsOS CLI 安装逻辑，命令包装器更加可靠。

修复：

- 修复斜杠菜单和上下文菜单交互中的焦点与视觉问题。


## v0.81.0

Features:

- Add theme support for system theme.  (#1113)

- Enhance CLI path handling and support relative paths. (#1112)

- Add empty paragraph placeholder toggle setting.

- Update font settings and improve theme consistency across the application.

- Enhance search functionality with improved state management and UI updates.

---

特性：

- 明亮主题支持跟随系统(#1113)

- 增强 CLI 路径处理，支持相对路径。(#1112)

- 新增 placeholder 显示/隐藏设置。

- 更新字体设置，改善应用内主题一致性。

- 改进搜索功能的状态管理和 UI 更新。

## v0.80.1

Features:

- Support CLI open command, quickly open files or folders via command line.

- Support typewriter mode for focused writing experience.

- Support shortcut to toggle between source code and WYSIWYG modes.

- Support link open in editor.

- Replaced KaTeX with MathJax for math rendering, with display mode support for inline math.

- Lazy load file tree for better performance.

- Optimized multiple code logic and page presentation.

Fixes:

- Fixed file tree toggle error.

- Fixed NewFileInput issue under Chinese input method.

- Fixed i18n not working in some cases.

- Fixed build errors and improved stability.

- Replaced unwrap() with proper error handling for better safety.

- Fixed aborted streams handling and improved cleanup.

---

特性：

- 支持 CLI open 命令，可通过命令行快速打开文件或文件夹。

- 支持打字机模式，提供更专注的写作体验。

- 支持快捷键在源代码模式和所见即所得模式之间切换。

- 支持编辑器内链接打开。

- 数学公式渲染由 KaTeX 替换为 MathJax，行内数学公式支持显示模式。

- 文件树懒加载，提升性能。

- 优化多处代码逻辑和页面展示。

修复：

- 修复文件树切换错误。

- 修复中文输入法下创建文件的异常问题。

- 修复部分场景下 i18n 不生效的问题。

- 修复构建错误，提升稳定性。

- 使用安全的错误处理替代 unwrap()，提升安全性。

- 修复中断流的处理并优化清理逻辑。

## v0.55.4

I wrote an article on how to use Copilot and Ollama in MarkFlowy. If you encounter some problems, you may find solutions here, [Use Copilot with Ollama](https://www.markflowy.cc/en/docs/Extension/UseCopilotWithOllama)。

Fixes:

- The style is adjusted, and the TOC location is back

- Fix Copilot configuration errors

---

我写了一篇如何在 MarkFlowy 中使用 Copilot 和 Ollama，如果你遇到了一些问题，也许可以在这里找到解决方案, [如何Copilot 与 Ollama 配合使用](https://www.markflowy.cc/zh/docs/Extension/UseCopilotWithOllama)。

修复：

- 样式调整，目录位置回退回去了

- 修复 Copilot 配置错误的问题

## v0.55.3

Fixes:

- Feature convergence: removed Git management functionality.

- After switching between Traditional and Simplified Chinese, the save status is updated to “Unsaved” and supports undo.

- Fixed the issue where the zoom ratio was not initialized.

- Fixed the issue where some toolbar buttons were unresponsive.

---

修复：

- 功能收敛，删除 git 管理功能

- 繁简切换后，保存状态更新为“未保存”，支持撤销

- 缩放比例没有初始化的问题修复

- 工具栏部分按钮点击没反应的问题修复

## v0.55.2

Features:

- 【Beta】 Added Copilot plugin in WYSIWYG mode, supporting document auto-completion. It is disabled by default due to instability and needs to be enabled in settings.

- Adjusted interface layout for simplified display and optimized interaction experience.

- Added Traditional/Simplified Chinese toggle, accessible via “More” in the Editor toolbar.

- New Theme Store allows submitting themes via PR. See [Custom Theme Documentation](https://github.com/drl990114/MarkFlowy/blob/main/docs/en/Extension/CustomTheme.md) for details.

- Support importing local CSS files, which are loaded on application startup.

- Optimized image loading in HTML blocks, now supporting relative paths.

Fixes:

- Fixed the issue on macOS where pasting in code blocks required secondary confirmation.

- Fixed rendering issues on Windows caused by incorrect Mark matching.

- Optimized image loading to support encoded paths.

- Numerous performance improvements.

---

特性：

- 【Beta】所见即所得模式下新增 Copilot 插件，支持文档自动补全，因还不稳定，默认关闭，需在设置中开启。

- 界面布局调整，简化显示，优化交互体验。

- 支持繁简切换，在 Editor 工具栏的 “更多” 中使用。

- 新增主题商店，可以通过 PR 来提交主题，详细操作请看：[Custom Theme Documentation](https://github.com/drl990114/MarkFlowy/blob/main/docs/zh/Extension/CustomTheme.md),

- 支持导入本地 CSS 文件，应用启动时会加载该文件。

- html 块中的图片加载优化，支持相对路径。

修复：

- 修复 MacOS 中代码块粘贴需要二次确认的问题。

- 修复 Windows 下 Mark 匹配错误导致的渲染问题。

- 优化图片加载，支持 encode 后的路径。

- 很多的性能优化。

## v0.51.1

Features:

- Support for opening file location via right-click, using the system's default file explorer.

- Optimized global search display: each matching line is shown separately, with improved performance.

- Added more block types to the '/' slash menu.

- Added `fileName` variable when saving images to paths relative to the document; see settings for details.

- Added multiple built-in themes.

- Added support for spell check settings (disabled by default).

- Support for quickly inserting `front-matter` nodes by typing `---` at the beginning of a document.

- Support for closing Editor tabs using the middle mouse button.

- Add setting native menu for MacOS.

Fixes:

- Rewrote the search plugin with support for syntax highlighting in code blocks.

- Improved code block language editing: using up/down arrow keys to move the cursor will now focus the language selection box first.

- Optimized overall performance and styles.

---

特性：

- 支持右键打开文件所在位置，使用系统默认的文件浏览器打开。

- 全局搜索显示优化，每行匹配字符单独显示，并优化性能。

- '/' 快捷菜单补充更多块类型。

- 保存图片到文件相对路径时，新增 `fileName` 变量，具体可见设置中的描述。

- 新增多个内置主题。

- 支持设置拼写检查，默认关闭。

- 编辑器支持通过在文档开头输入 `---` 快速插入 `front-matter` 节点。

- 支持通过鼠标中键关闭 Editor 标签页。

- 为 MacOS 添加`设置`原生菜单。

修复：

- 搜索插件重写，支持代码块的高亮。

- 代码块的语言编辑体验支持，支持上下方向键移动光标会先聚焦到语言选择框。

- 优化性能与样式。

## v0.50.2

Fixes:

- Paste events temporarily do not support customization due to browser security policy restrictions, affecting user experience. Continuous optimization will be carried out in the future.

- Support for parsing `front-matter` syntax.

---

修复：

- 粘贴事件暂时不支持自定义，因为浏览器安全策略限制，影响用户体验，后续会持续优化。

- 支持 `front-matter` 语法的解析。

## v0.50.1

Happy New Year 2026! Thank you for your support in the past year♥️. In 2026, I will focus on refining existing features and addressing issues. I also hope for your continued support and valuable feedback.

This update brings many new features and bug fixes：

### Features: 

#### Application:

- Support for opening `multiple windows`.

- AI conversation refactored to `stream` output with a more user-friendly interface and interaction.

- Support for multiple system right-clicks to quickly open files with `MarkFlowy`.

- Application configuration files no longer use explicit JSON file storage; instead, they use the application's data storage for improved security.

- Support for interface scaling, configurable in `Settings - Display - Zoom Ratio` .

- Quick left/right movement of the currently open file editing page in the file tab bar.

#### Editor:

- `WYSIWYG` mode now supports parsing of Markdown reference syntax.

- `WYSIWYG` mode supports drag-and-drop image upload, defaulting to storage in the application's `${markflowyConfigPath}/assets/images` directory. The completed path can be viewed and modified in `Settings - Pictures`.

- `Source code` mode supports `tab` key indentation.

### Fixes:

- Fixed drag event conflicts when renaming files.

- Fixed `link` paste and copy format loss issues.

- Fixed `ordered list` numbering not recalculating across different paragraphs.

---

2026 新年快乐！感谢过去一年大家的支持♥️。在 2026，我会将主要精力放在现有功能的完善优化和 issues 处理上，同时也希望大家可以多多支持，提出宝贵的建议和反馈。

这次更新了诸多功能和修复了一些问题:

### 特性：

#### 应用:

- 支持打开多个窗口。

- AI 对话重构，改为流式输出，界面与交互更友好。

- 支持多次系统右键,使用 MarkFlowy 快速打开文件。

- 应用的配置文件不再使用显式的 json 文件储存，使用应用的数据存储，提高安全性。

- 支持设置界面的缩放，在 `设置 - 显示 - 缩放比例` 中设置。

- 文件标签栏左侧，支持快速左右移动当前打开的文件编辑页。

#### 编辑器:

- 所见即所得模式支持 Markdown 引用语法的解析。

- 所见即所得模式支持图片的拖拽上传，默认将存放在应用的 `${markflowyConfigPath}/assets/images` 目录。完成路径可以在 `设置 - 图片`中查看和修改。

- 源代码模式支持 `tab` 键缩进。

### 修复:

- 修复重命名文件时，拖拽事件冲突问题。

- 修复 link 粘贴和复制格式丢失问题。

- 修复 ordered list 的排序在不同段落中没有重新计算问题。

## v0.43.0

Features:

- support config ai request headers.

Fixed:

- Fix the mark matching condition.

---

特性:

- 支持配置 AI 请求头。

修复:

- 修复mark匹配条件。

## v0.42.0

Features:

- Support saving images to relative paths when pasting.

- Source code mode shortcuts remain consistent with WYSIWYG mode.

- Support `Google AI model` configuration.

- When pasting images, if pasting as `relative workspace` or `relative file` path and a workspace is open, the image path will be converted to relative path instead of the original absolute path.

- Support editing `textbundle (markdown)` format folders. When pasting images into Markdown within textbundle , images will be automatically copied to `textbundle/assets` .

Fixes:

- Fixed white screen issue during AI chat submission.

- Fixed the issue where old paths were used when pasting images after dragging and dropping files.

---

特性:

- 支持粘贴时，保存图片到相对当前文件路径。

- 源代码模式的快捷键保持与所见即所得模式下一致。

- 支持 Google AI 模型配置。

- 粘贴图片时，在粘贴为相对工作区或相对文件时，如果有打开的工作区，图片路径会变为相对路径返回，而不是原来的绝对路径。

- 支持 `textbundle (markdown)` 格式的文件夹编辑，当粘贴图片到 `textbundle` 中的 `Markdown` 时，图片会固定复制到 `textbundle/assets`。

修复:

- 修复 AI chat 提交时白屏问题。

- 修复拖拽文件后，粘贴图片时用的是旧路径。

## v0.41.0

Features:

- Supports line breaks in code blocks configured with `Wysiwyg` mode.

- React framework upgrade and performance optimization.

Fixes:

- Fixed an issue where an extra confirmation pop-up would appear when pasting.

- Optimized image node display.

- Optimized the scrolling display of the shortcut table in the small window.

---

特性:

- 支持配置 `Wysiwyg` 模式的代码块换行。

- react 框架升级，性能优化。

修复:

- 修复粘贴时会有额外的弹窗确认问题。

- 优化图片节点的显示。

- 优化快捷键表格在小窗口的滚动显示。

## v0.40.0

Long time no see! A huge upgrade has brought many features that everyone has been looking forward to.

Features:

- Completely upgraded interface, inspired by Apple’s design palette and made more compact.

- Editor now supports drag-and-drop to move elements.

- Custom keyboard shortcuts are now supported.

- Added shortcuts for quickly opening settings, quickly closing the current editing page, and hiding the app.

- The language switch will take effect immediately.

Fixes:

- Git-related commands are now invoked only when the workspace type requires it.

- Fixed auto-update failures on macOS AArch64.

- Improved input experience for math nodes.

---

好久不见，一次巨大的升级，带来了很多大家期待的功能。

特性：

- 界面全新升级，参考 Apple 设计色彩，并且更加紧凑。

- 编辑器支持拖拽移动元素。

- 支持自定义快捷键。

- 添加了快速打开设置、快速关闭当前编辑页、隐藏app等快捷键。

- 切换语言后，立即生效。

修复：

- 根据工作区的类型判断是否调用 git 相关命令。

- 修复 mac aarch64 的自动更新失败问题。

- math 节点的输入方式优化。

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

- Some style optimizations.

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
