![img](https://github.com/PolyMeilex/rfd/assets/20758186/9bef59fa-60f0-448c-b9db-44ab436ee611)


[![version](https://img.shields.io/crates/v/rfd.svg)](https://crates.io/crates/rfd)
[![Documentation](https://docs.rs/rfd/badge.svg)](https://docs.rs/rfd)
[![dependency status](https://deps.rs/crate/rfd/0.15.1/status.svg)](https://deps.rs/crate/rfd/0.15.3)

Rusty File Dialogs is a cross platform Rust library for using native file open/save dialogs.
It provides both asynchronous and synchronous APIs. Supported platforms:

  * Windows
  * macOS
  * Linux & BSDs (GTK3 or XDG Desktop Portal)
  * WASM32 (async only)

Refer to the [documentation](https://docs.rs/rfd) for more details.


## Platform-specific notes

### Linux
Please refer to [Linux & BSD backends](https://docs.rs/rfd/latest/rfd/#linux--bsd-backends) for information about the needed dependencies to be able to compile on Linux.
