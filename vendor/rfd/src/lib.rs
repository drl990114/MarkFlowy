//! Rusty File Dialogs is a cross platform library for using native file open/save dialogs.
//! It provides both asynchronous and synchronous APIs. Supported platforms:
//!
//!   * Windows
//!   * macOS
//!   * Linux & BSDs (GTK3 or XDG Desktop Portal)
//!   * WASM32 (async only)
//!
//! # Examples
//!
//! ## Synchronous
//! ```no_run
//! use rfd::FileDialog;
//!
//! let files = FileDialog::new()
//!     .add_filter("text", &["txt", "rs"])
//!     .add_filter("rust", &["rs", "toml"])
//!     .set_directory("/")
//!     .pick_file();
//! ```
//!
//! ## Asynchronous
//! ```no_run
//! use rfd::AsyncFileDialog;
//!
//! let future = async {
//!     let file = AsyncFileDialog::new()
//!         .add_filter("text", &["txt", "rs"])
//!         .add_filter("rust", &["rs", "toml"])
//!         .set_directory("/")
//!         .pick_file()
//!         .await;
//!
//!     let data = file.unwrap().read().await;
//! };
//! ```
//!
//! # Linux & BSD backends
//!
//! On Linux & BSDs, two backends are available, one using the [GTK3 Rust bindings](https://gtk-rs.org/)
//! and the other using the [XDG Desktop Portal](https://github.com/flatpak/xdg-desktop-portal)
//! D-Bus API through [ashpd](https://github.com/bilelmoussaoui/ashpd),
//! [zbus](https://gitlab.freedesktop.org/dbus/zbus/) and [zenity](https://gitlab.gnome.org/GNOME/zenity).
//!
//! ## GTK backend
//! The GTK backend is used when the `xdg-portal` feature is disabled with the [`default-features = false`](https://doc.rust-lang.org/cargo/reference/features.html#dependency-features), and `gtk3` is enabled instead. The GTK3
//! backend requires the C library and development headers to be installed to build RFD. The package
//! names on various distributions are:
//!
//! | Distribution    | Installation Command |
//! | --------------- | ------------ |
//! | Fedora          | dnf install gtk3-devel   |
//! | Arch            | pacman -S gtk3         |
//! | Debian & Ubuntu | apt install libgtk-3-dev |
//!
//! ## XDG Desktop Portal backend
//! The XDG Desktop Portal backend is used with the `xdg-portal` Cargo feature which is enabled by default. Either the `tokio` or `async-std` feature must be enabled. This backend will use either the GTK or KDE file dialog depending on the desktop environment
//! in use at runtime.
//!
//! It does not have any non-Rust
//! build dependencies, however it requires the user to have either the
//! [GTK](https://github.com/flatpak/xdg-desktop-portal-gtk),
//! [GNOME](https://gitlab.gnome.org/GNOME/xdg-desktop-portal-gnome), or
//! [KDE](https://invent.kde.org/plasma/xdg-desktop-portal-kde/) XDG Desktop Portal backend installed
//! at runtime. These are typically installed by the distribution together with the desktop environment.
//!
//! The
//! [wlroots portal backend](https://github.com/emersion/xdg-desktop-portal-wlr) does not implement the
//! D-Bus API that RFD requires (it does not interfere with the other portal implementations;
//! they can all be installed simultaneously).
//!
//! [Zenity](https://gitlab.gnome.org/GNOME/zenity) is also required to display message dialogs,
//! and is used for file dialogs if [ashpd] cannot.
//!
//! If you are packaging an application that uses RFD, ensure that both a supported portal backend and
//! Zenity are installed with the package.
//!
//! # macOS non-windowed applications, async, and threading
//!
//! macOS async dialogs require an `NSApplication` instance, so the dialog is only truly async when
//! opened in windowed environment like `winit` or `SDL2`. Otherwise, it will fallback to sync dialog.
//! It is also recommended to spawn dialogs on your main thread. RFD can run dialogs from any thread
//! but it is only possible in a windowed app and it adds a little bit of overhead. So it is recommended
//! to [spawn on main and await in other thread](https://github.com/PolyMeilex/rfd/blob/master/examples/async.rs).
//! Non-windowed apps will never be able to spawn async dialogs or from threads other than the main thread.
//!
//! # Customize button texts of message dialog in Windows
//!
//! `TaskDialogIndirect` API is used for showing message dialog which can have customized button texts.
//! It is only provided by ComCtl32.dll v6 but Windows use v5 by default.
//! If you want to customize button texts or just need a modern dialog style (aka *visual styles*), you will need to:
//!
//! 1. Enable cargo feature `common-controls-v6`.
//! 2. Add an application manifest to use ComCtl32.dll v5. See [Windows Controls / Enabling Visual Styles](https://docs.microsoft.com/en-us/windows/win32/controls/cookbook-overview)
//!
//!
//! Here is an [example](https://github.com/PolyMeilex/rfd/tree/master/examples/message-custom-buttons) using [embed-resource](https://docs.rs/embed-resource/latest/embed_resource/).
//!
//! # Cargo features
//!  * `gtk3`: Uses GTK for dialogs on Linux & BSDs; has no effect on Windows and macOS
//!  * `xdg-portal`: Uses XDG Desktop Portal instead of GTK on Linux & BSDs
//!  * `common-controls-v6`: Use `TaskDialogIndirect` API from ComCtl32.dll v6 for showing message dialog. This is necessary if you need to customize dialog button texts.
//!
//! # State
//!
//! | API Stability |
//! | ------------- |
//! | 🚧            |
//!
//! | Feature      | Linux | Windows | MacOS     | Wasm32 |
//! | ------------ | ----- | ------- | --------- | ------ |
//! | SingleFile   | ✔     | ✔       | ✔         | ✔      |
//! | MultipleFile | ✔     | ✔       | ✔         | ✔      |
//! | PickFolder   | ✔     | ✔       | ✔         | ✖      |
//! | SaveFile     | ✔     | ✔       | ✔         | ✖      |
//! | Filters      | ✔     | ✔       | ✔         | ✔      |
//! | StartingPath | ✔     | ✔       | ✔         | ✖      |
//! | Async        | ✔     | ✔       | ✔         | ✔      |
//!
//! # rfd-extras
//!
//! AKA features that are not file related
//!
//! | Feature       | Linux        | Windows | MacOS | Wasm32 |
//! | ------------- | -----        | ------- | ----- | ------ |
//! | MessageDialog | ✔            | ✔       | ✔     | ✔      |
//! | PromptDialog  |              |         |       |        |
//! | ColorPicker   |              |         |       |        |

mod backend;

mod file_handle;
pub use file_handle::FileHandle;

mod file_dialog;
#[cfg(target_os = "macos")]
mod oneshot;

#[cfg(not(target_arch = "wasm32"))]
pub use file_dialog::FileDialog;

pub use file_dialog::AsyncFileDialog;

mod message_dialog;
pub use message_dialog::{
    AsyncMessageDialog, MessageButtons, MessageDialog, MessageDialogResult, MessageLevel,
};
