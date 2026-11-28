use crate::message_dialog::MessageDialogResult;
use crate::FileHandle;
use std::future::Future;
#[cfg(not(target_arch = "wasm32"))]
use std::path::PathBuf;
use std::pin::Pin;

#[cfg(all(
    any(
        target_os = "linux",
        target_os = "freebsd",
        target_os = "dragonfly",
        target_os = "netbsd",
        target_os = "openbsd"
    ),
    not(feature = "gtk3")
))]
mod linux;

#[cfg(all(
    any(
        target_os = "linux",
        target_os = "freebsd",
        target_os = "dragonfly",
        target_os = "netbsd",
        target_os = "openbsd"
    ),
    feature = "gtk3"
))]
mod gtk3;
#[cfg(target_os = "macos")]
mod macos;
#[cfg(target_arch = "wasm32")]
mod wasm;
#[cfg(target_os = "windows")]
mod win_cid;
#[cfg(all(
    any(
        target_os = "linux",
        target_os = "freebsd",
        target_os = "dragonfly",
        target_os = "netbsd",
        target_os = "openbsd"
    ),
    not(feature = "gtk3")
))]
mod xdg_desktop_portal;

//
// Sync
//

/// Dialog used to pick file/files
#[cfg(not(target_arch = "wasm32"))]
pub trait FilePickerDialogImpl {
    fn pick_file(self) -> Option<PathBuf>;
    fn pick_files(self) -> Option<Vec<PathBuf>>;
}

/// Dialog used to save file
#[cfg(not(target_arch = "wasm32"))]
pub trait FileSaveDialogImpl {
    fn save_file(self) -> Option<PathBuf>;
}

/// Dialog used to pick folder
#[cfg(not(target_arch = "wasm32"))]
pub trait FolderPickerDialogImpl {
    fn pick_folder(self) -> Option<PathBuf>;
    fn pick_folders(self) -> Option<Vec<PathBuf>>;
}

pub trait MessageDialogImpl {
    fn show(self) -> MessageDialogResult;
}

//
// Async
//

// Return type of async dialogs:
#[cfg(not(target_arch = "wasm32"))]
pub type DialogFutureType<T> = Pin<Box<dyn Future<Output = T> + Send>>;
#[cfg(target_arch = "wasm32")]
pub type DialogFutureType<T> = Pin<Box<dyn Future<Output = T>>>;

/// Dialog used to pick file/files
pub trait AsyncFilePickerDialogImpl {
    fn pick_file_async(self) -> DialogFutureType<Option<FileHandle>>;
    fn pick_files_async(self) -> DialogFutureType<Option<Vec<FileHandle>>>;
}

/// Dialog used to pick folder
#[cfg(not(target_arch = "wasm32"))]
pub trait AsyncFolderPickerDialogImpl {
    fn pick_folder_async(self) -> DialogFutureType<Option<FileHandle>>;
    fn pick_folders_async(self) -> DialogFutureType<Option<Vec<FileHandle>>>;
}

/// Dialog used to pick folder
pub trait AsyncFileSaveDialogImpl {
    fn save_file_async(self) -> DialogFutureType<Option<FileHandle>>;
}

pub trait AsyncMessageDialogImpl {
    fn show_async(self) -> DialogFutureType<MessageDialogResult>;
}
