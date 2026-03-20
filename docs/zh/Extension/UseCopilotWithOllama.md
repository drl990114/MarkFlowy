# Copilot 与 Ollama 配合使用手册

因为 copilot 需要实时性较高，对模型参数量要求较小，所以我比较推荐和 ollama 配合使用，本文主要简单介绍一下配合使用中常遇到的问题。

## 问题1: Ollama无法请求成功？

这是由于 ollama 请求需要配置一个允许跨域的请求头，可以参考下面这个操作设置，当然，由于实效性，本文随时可能过时，所以也推荐去 AI 搜索“如何配置 Ollama 接口，支持跨域请求”。

### 一、Windows 系统

### 设置环境变量（允许跨域/远程访问）

**图形界面方式**（永久生效）：

1. **完全退出 Ollama**（点击任务栏图标退出）

2. **Win + S** 搜索 **"编辑环境变量"** → 打开

3. 点击 **"环境变量"** → **"新建"**（用户变量）：

- 变量名：`OLLAMA_ORIGINS`

- 变量值：`*`（允许所有来源）

4. 如需远程访问，再添加：

- 变量名：`OLLAMA_HOST`

- 变量值：`0.0.0.0`

5. 点击 **确定** 保存

6. **重新打开 Ollama** 生效

**命令行方式**（管理员权限）：

```powershell
# 设置环境变量（永久）
setx OLLAMA_ORIGINS "*" /M

# 验证
echo %OLLAMA_ORIGINS%
```

> ⚠️ **注意**：`setx` 设置后需新开终端或重启电脑才能生效。

---

## 二、macOS 系统

### 设置环境变量（允许跨域/远程访问）

**使用 `launchctl` 命令**（推荐）：

```bash
# 设置环境变量（当前会话）
launchctl setenv OLLAMA_ORIGINS "*"
launchctl setenv OLLAMA_HOST "0.0.0.0"

# 重启 Ollama 应用生效
```

**永久生效**（写入 shell 配置文件）：

```bash
# 编辑配置文件（根据你的 shell）
nano ~/.zshrc   # 或 ~/.bash_profile

# 添加以下内容
export OLLAMA_ORIGINS="*"
export OLLAMA_HOST="0.0.0.0"

# 保存后生效
source ~/.zshrc
```

**验证设置**：

```bash
launchctl getenv OLLAMA_ORIGINS
# 应返回: *
```

## Copilot 如何使用

Copilot 可以配合任何 MarkFlowy 已经支持的 AI 供应商使用，但需要你在 `设置`中的 AI 部分配置，并且确认在 AI chat 中可以正常使用，然后在 Copilot 设置中选择你设置好的供应商和模型即可。

### Copilot 的触发机制

通常，在一个段落输入一定的文本后，MarkFlowy 会把你所在的附近的字符，作为上下文让 AI 提供一些建议，大概的样子是这样的:![](https://raw.githubusercontent.com/drl990114/MarkFlowy/refs/heads/main/public/copilot.png)

### 建议

建议选择1b - 2b 左右参数量的模型，以获得速度与质量的平衡。
