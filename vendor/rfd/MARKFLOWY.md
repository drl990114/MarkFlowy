# MarkFlowy's Zenity backport

The source, build script, manifest and MIT license come from [rfd 0.16.0](https://crates.io/crates/rfd/0.16.0), the version used by `tauri-plugin-dialog` 2.8.3. The crate archive has SHA-256 `a15ad77d9e70a92437d8f74c35d99b4e4691128df018833e99f90bcd36152672`. The upstream examples are omitted, along with their `futures` development dependency.

The Linux PR workflow tests the following Zenity fallback behavior against Cargo's locked dependency graph.

- Selected local paths retain whitespace, pipes and newlines.
- A non-local result such as Zenity's literal `(null)` invalidates the whole selection. An absolute path such as `/tmp/(null)` is valid.
- Zenity receives the caller's title, initial folder and suggested filename.

## Removing the backport

Once a released Tauri dialog plugin uses an upstream rfd that passes these cases, remove the `rfd` entry under `[patch.crates-io]` in the root `Cargo.toml`, delete `vendor/rfd` and remove its dedicated test step from `.github/workflows/nodejs.yml`. Refresh `Cargo.lock` and verify that `cargo tree --locked -i rfd` resolves the registry release. Exercise the fallback with the XDG FileChooser portal unavailable, including a local filename ending in a space and a remote selection without a local path.

Upstream work is tracked in [Tauri plugins #3779](https://github.com/tauri-apps/plugins-workspace/pull/3779), [rfd #346](https://github.com/PolyMeilex/rfd/issues/346), [rfd #347](https://github.com/PolyMeilex/rfd/pull/347) and [rfd #352](https://github.com/PolyMeilex/rfd/pull/352).
