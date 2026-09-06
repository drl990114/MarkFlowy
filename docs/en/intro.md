---
seoTitle: "MarkFlowy: Markdown editing with optional AI"
description: "A local-first Markdown editor for macOS, Windows, and Linux. Learn about large documents, optional AI, and desktop versus web workflows."
updatedAt: "2026-09-06"
---

# MarkFlowy: Markdown editing with optional AI

MarkFlowy is a local-first Markdown editor for macOS, Windows, and Linux. It focuses on working with existing files, large-document editing, and optional AI assistance. You can edit without configuring an AI provider, connect a cloud service, or use Ollama with a local model.

## Who is it for?

MarkFlowy suits writers and developers who keep notes, articles, or technical documents as Markdown files and want both source and visual editing. Its file tree, search, multiple tabs, themes, and configurable shortcuts support an everyday folder-based writing workflow.

It is an editor rather than a promise of identical behavior across Markdown tools. When moving an existing collection, start with representative files and check tables, links, images, formulas, and saved Markdown. The v0.100.0 editor rewrite introduced changes to some editing behaviors.

## Performance and large documents

The v0.100.0 release notes report that a **2 MB Markdown file opened in around 1 second in testing**. This is a reported test observation, not a guarantee for every file or device. The release note does not include the hardware, complete fixture, sample distribution, or P95.

Read [large-document performance notes](./Performance/large-markdown-files) for the available evidence, its limits, and a way to compare your own files. MarkFlowy is built with Tauri; installer sizes vary by platform, version, and whether a runtime is bundled.

## Optional AI

AI features include chat, summaries, translation, and Copilot completion. Provider credentials, model availability, and costs depend on your configuration. Chat can use selected document context, while Copilot has its own provider and model settings and uses text around the cursor.

For local inference, choose a locally running Ollama model and a local endpoint. A remote endpoint or cloud-hosted model sends requests to that service, even if you access it through Ollama. See [setting up Ollama and Copilot](./Extension/UseCopilotWithOllama).

## Desktop, Web App, and Playground

| Entry | What to expect |
| --- | --- |
| Desktop release | Local file and folder workflows and configurable AI. |
| Web App Beta | A separate browser workspace; connected or remote workspaces have their own storage and authentication behavior. |
| Playground | A browser demonstration of the RME editor. It does not establish desktop editor performance or desktop AI support. |

For the large-document and local AI workflows described here, use the desktop release. The [Playground](https://www.markflowy.cc/playground) is useful for a quick basic editing trial.

## Download

Available for Windows, macOS and Linux, from the [latest release](https://github.com/drl990114/MarkFlowy/releases/latest).

### Windows

Download and run one of the x64 builds:

- `MarkFlowy_v<version>_x64-setup.exe` or `MarkFlowy_v<version>_x64.msi` — installer.
- `MarkFlowy_v<version>_offline_installer_x64-setup.exe` / `.msi` — same, with the WebView2 runtime bundled.
- `MarkFlowy_v<version>_x64_portable.zip` — unpack and run, no installation.

### macOS

Download `MarkFlowy_v<version>_aarch64.dmg` (Apple silicon) or `MarkFlowy_v<version>_x64.dmg` (Intel).

> [!NOTE]
> Because of Apple’s security policy restrictions on software without developer certification, the **macOS aarch64** version cannot be downloaded and used directly. You can ignore the limit by doing the following:
> - Open your terminal
> - Go to the `Applications` directory. .e.g `/Applications`.
> - Run `xattr -cr MarkFlowy.app` and open the app again
> - Please make sure you download from `github releases`.

### Linux

x86_64 only for now.

#### Flatpak

On [FlatPark](https://flatpark.org) — [app page](https://flatpark.org/apps/io.github.drl990114.MarkFlowy):

```sh
flatpak remote-add --if-not-exists flatpark https://dl.flatpark.org/flatpark.flatpakrepo
flatpak install flatpark io.github.drl990114.MarkFlowy
```

#### Install script

Installs the `.deb` or `.rpm` for your distribution, or the AppImage if it is not recognized:

```sh
curl -fsSL https://raw.githubusercontent.com/drl990114/MarkFlowy/main/scripts/install-linux.sh -o install-linux.sh
sh install-linux.sh
```

Use `wget -O install-linux.sh <url>` if `curl` is unavailable. Add `--appimage` to force the AppImage, or `--uninstall` to remove MarkFlowy.

## Project and feedback

See the [source repository](https://github.com/drl990114/MarkFlowy), [release notes](https://www.markflowy.cc/releases), and [contribution guide](./Community/CONTRIBUTING). When reporting a problem, include the application version, operating system, and a reproducible example.
