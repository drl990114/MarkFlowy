# MarkFlowy's Zenity backport

The source, build script, manifest and MIT license come from [rfd 0.16.0](https://crates.io/crates/rfd/0.16.0), the version used by `tauri-plugin-dialog` 2.8.3. The crate archive has SHA-256 `a15ad77d9e70a92437d8f74c35d99b4e4691128df018833e99f90bcd36152672`. The upstream examples are omitted, along with their `futures` development dependency.

The local changes to `src/backend/linux/zenity.rs` preserve selected paths and pass Zenity an explicit initial folder. The Linux PR workflow runs the unit tests against Cargo's locked dependency graph.

Revisit the Cargo patch when Tauri ships a compatible rfd release covering these cases. The upstream reports and fixes are tracked in [rfd #346](https://github.com/PolyMeilex/rfd/issues/346), [rfd #347](https://github.com/PolyMeilex/rfd/pull/347) and [rfd #352](https://github.com/PolyMeilex/rfd/pull/352).
