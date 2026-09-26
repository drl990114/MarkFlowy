# 片段库

设置 → 片段库用于管理本机全局的 Math、Mermaid、Code 源码片段。编辑器菜单中的“管理片段”可以直接打开对应分类。

Math、Mermaid、Code 每种类型各内置 1 个基础片段（分式、流程图、JSON），可隐藏、恢复或复制为自定义片段。自定义片段支持名称搜索、新建、编辑、复制和删除。源码只填写块内文本，不包含外层代码围栏或 `$$`。保存会保留源码的缩进、Tab 和首尾换行；`${…}` 按文字处理。

修改先保留为草稿，点击“保存”后才写入片段库。离开条目、切换设置页或关闭管理窗口时，可以保存、放弃或取消。点击“预览”才创建独立的只读 Capricorn 实例；源码修改后需要重新预览，预览失败不阻止保存。

在 Capricorn 中输入 `/`，用鼠标或上下方向键选中 Math、Mermaid 或 Code 时，会展开片段子菜单，键盘焦点仍留在当前分类。直接按 Enter 会插入空白块，并自动聚焦源码编辑区；按右方向键后才能用上下方向键选择子菜单条目，也可以直接点击片段插入。左方向键返回分类，Escape 逐级关闭，取消和管理片段均保留 `/`。块工具栏右侧的片段按钮会替换先前的源码选区，或在光标处插入；没有有效位置时在源码末尾插入。已有代码块保留语言，新建代码块采用片段语言。一次插入可一次撤销。

片段库保存在应用数据目录的 `snippets.json`，包含 `version`、`revision`、`items` 和 `hiddenBuiltinIds`。原子写入成功后才更新界面并通知其他窗口。版本冲突保留当前草稿并显示错误；切换条目并放弃草稿可载入最新版本，再重新编辑。损坏或未来版本的文件不会被自动覆盖为空库。片段加载不阻塞文档打开。

此功能仅接入 Capricorn，已集成 runtime `0.3.0`。安装器和 runtime resolver 固定精确版本，安装脚本已校验正式包的 SHA-256 和包身份。`0.3.0` 的主题契约通过显式 `--cap-*` 实例样式提供颜色与排版，不再读取 MarkFlowy/RME 的内部回退变量；主题迁移见[自定义主题](./CustomTheme.md#capricorn-030-主题契约)。片段库仍使用原有 `snippets.json` 格式，升级主题契约不需要转换已保存的片段。

源码联调用 `yarn workspace @markflowy/desktop test:capricorn-source` 验证，正式包集成用 `yarn workspace @markflowy/desktop test:capricorn-published` 验证。本次发布来源和验证结果见[启动性能记录](../../STARTUP_PERFORMANCE.md#capricorn-030-release-integration-2026-09-26)；复查时应按该记录限制为单 worker 和 4 GB Node 堆，串行执行。单测使用模拟的 Tauri 命令和 DOM 环境；Tauri 实机与系统中文输入法仍需单独验收。
