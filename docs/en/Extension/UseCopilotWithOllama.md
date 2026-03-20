# Using Copilot with Ollama

Since Copilot requires real-time performance and works well with smaller parameter models, I recommend using it with Ollama. This article mainly introduces common issues you may encounter when using them together.

## Issue 1: Ollama Request Fails?

This is because Ollama requests need to be configured with cross-origin headers. You can refer to the operations below. However, due to the nature of this information, it may become outdated at any time. I also recommend searching on AI for "how to configure Ollama API to support cross-origin requests".

### 1. Windows System

### Setting Environment Variables (Allow Cross-Origin/Remote Access)

**GUI Method** (Permanent):

1. **Completely quit Ollama** (click the taskbar icon to exit)

2. **Win + S** search for **"Edit environment variables"** → open

3. Click **"Environment Variables"** → **"New"** (User variables):

- Variable name: `OLLAMA_ORIGINS`

- Variable value: `*` (allow all origins)

4. If you need remote access, add another:

- Variable name: `OLLAMA_HOST`

- Variable value: `0.0.0.0`

5. Click **OK** to save

6. **Restart Ollama** to take effect

**Command Line Method** (Administrator privileges):

```powershell
# Set environment variable (permanent)
setx OLLAMA_ORIGINS "*" /M

# Verify
echo %OLLAMA_ORIGINS%
```

> ⚠️ **Note**: After setting with `setx`, you need to open a new terminal or restart your computer for it to take effect.

---

## 2. macOS System

### Setting Environment Variables (Allow Cross-Origin/Remote Access)

**Using `launchctl` command** (Recommended):

```bash
# Set environment variable (current session)
launchctl setenv OLLAMA_ORIGINS "*"
launchctl setenv OLLAMA_HOST "0.0.0.0"

# Restart Ollama app to take effect
```

**Permanent effect** (Write to shell configuration file):

```bash
# Edit configuration file (depending on your shell)
nano ~/.zshrc   # or ~/.bash_profile

# Add the following content
export OLLAMA_ORIGINS="*"
export OLLAMA_HOST="0.0.0.0"

# Save and apply
source ~/.zshrc
```

**Verify settings**:

```bash
launchctl getenv OLLAMA_ORIGINS
# Should return: *
```

## How to Use Copilot

Copilot can work with any AI provider already supported by MarkFlowy. You need to configure it in the AI section of `Settings`, and make sure it works normally in AI chat. Then you can select the provider and model you configured in Copilot settings.

### Copilot's Trigger Mechanism

Typically, after entering some text in a paragraph, MarkFlowy will take the characters around your cursor as context and have AI provide some suggestions. It looks something like this:
![](https://raw.githubusercontent.com/drl990114/MarkFlowy/refs/heads/main/public/copilot.png)

### Recommendations

It is recommended to choose a model with around 1b - 2b parameters to achieve a balance between speed and quality.
