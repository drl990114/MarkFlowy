# MarkFlowy

## MarkFlowy is in Beta Stage ⚠️

Currently, MarkFlowy is in the beta stage, and it is recommended to use it with data backups.

## Feature

- **Built-in AI**. Currently, it supports one click export of conversations, translation of articles to any language, and obtaining article abstracts. It also supports large models such as `DeepSeek` and `Chatgpt` to make them your intelligent assistants.
- **Super lightweight**. The MarkFlowy is based on tauri and has a volume of less than 10MB and better performance.
- **High availability**. MarkFlowy uses the remirror editor, which not only provides high scalability, but also has a great editing experience. And, MarkFlowy supports multiple editing modes, such as `source code`, `wysiwyg`.
- **Custom Theme**. MarkFlowy supports custom themes, and you can also share your themes with others.

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

## Why

At present, I have used many Markdown applications, but I have not encountered one that is very suitable for me. I have always hoped to have a Markdown editor that is efficient, beautiful, lightweight, data-safe, and can be easily combined with various workflows. This It is also the original intention of doing MarkFlowy.

## Contribute

The current MarkFlowy is still in its infancy, and there may be some bad experiences or bugs, for which I am sorry. All partners who are interested or encounter usage problems are welcome to submit [issues](https://github.com/drl990114/MarkFlowy/issues/new) or [PR](https://github.com/drl990114/MarkFlowy/compare) to participate in this project.

### How to Contribute

You can read [CONTRIBUTING](./Community/CONTRIBUTING) to know how to start the project and modify the code, Welcome to participate in code contribution.

## Support

MarkFlowy is completely and permanently open source, if you want to support MarkFlowy, you can `star` this project. This will give me great support and help, love you.
