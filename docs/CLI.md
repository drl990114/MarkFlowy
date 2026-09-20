# 可靠 CLI 与官方 Skill

本仓库提供 [MarkFlowy 官方 Skill](../skills/markflowy/SKILL.md)。将 `skills/markflowy` 整个目录放入所用 AI Agent 的 Skill 目录即可安装；它通过本机 CLI 工作，不需要模型服务或网络端口。使用前先运行 `markflowy status`，确认安装的 CLI 返回 `cliProtocolVersion: 1`。此协议需要包含相应实现的 Desktop 版本，仓库中的修改不会自动更新已安装应用。

```sh
markflowy window list
markflowy file open "/path/report.md" --preview --window-id main --wait applied
markflowy file status "/path/report.md" --window-id main
markflowy file wait "/path/report.md" --window-id main --sha256 <content-sha256>
markflowy file export "/path/report.md" --window-id main --format html --output "/path/report.html"
```

请将路径和窗口 ID 换成实际目标。`file open` 可以启动应用，其他操作要求应用已运行。指定的窗口不存在时直接失败；不会悄悄打开另一个窗口。

打开文件默认等待 `applied`：读取调用时的磁盘版本，复用外部文件同步逻辑，再比较实际编辑器内容的 SHA-256，并在一次渲染机会后复核。既有未保存修改受到冲突保护。只需要确认当前文件可见时可用 `--wait visible`，但这不能证明目标版本已经应用。`file wait` 不切换标签；目标被隐藏时，需要先重新打开目标文件。

导出绑定指定文件与输出路径，支持 HTML、Markdown、文本、JSON、JPG。输出目录必须存在，默认拒绝覆盖；需要替换已有导出时加 `--overwrite`。输出内容写入临时文件、同步并提交后，再读取校验，返回实际路径、字节数和 SHA-256。不会覆盖源文件。PDF 仍使用系统打印对话框，目前不支持通过 CLI 指定 PDF 路径并确认完成。

回执包含 `requestId`、`ok`、`code`、`message` 和 `result`，失败返回非零退出码。确认文件已经显示，应检查 `ready`、`visible`、`applied`；确认导出完成，应检查 `code: "export_completed"` 及 `result.output`。`command execute` 仅能确认 GUI 命令已分发，不能证明异步保存或导出完成。

默认超时 30 秒，可用 `--timeout` 指定 1–300000 毫秒。超时表示无法确认完成，不等同于操作已撤销；再次写入前先检查文件状态和输出文件。详细命令、摘要计算方式、回执字段和错误处理见 [CLI 协议参考](../skills/markflowy/references/cli.md)。
