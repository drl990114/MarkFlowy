pub mod dialog_ffi;

use dialog_ffi::GtkFileDialog;

use std::path::PathBuf;

use super::utils::GtkGlobalThread;
use crate::backend::DialogFutureType;
use crate::{FileDialog, FileHandle};

use super::gtk_future::GtkDialogFuture;

//
// File Picker
//

use crate::backend::FilePickerDialogImpl;
impl FilePickerDialogImpl for FileDialog {
    fn pick_file(self) -> Option<PathBuf> {
        GtkGlobalThread::instance().run_blocking(move || {
            let dialog = GtkFileDialog::build_pick_file(&self);

            if dialog.run() == gtk_sys::GTK_RESPONSE_ACCEPT {
                dialog.get_result()
            } else {
                None
            }
        })
    }

    fn pick_files(self) -> Option<Vec<PathBuf>> {
        GtkGlobalThread::instance().run_blocking(move || {
            let dialog = GtkFileDialog::build_pick_files(&self);

            if dialog.run() == gtk_sys::GTK_RESPONSE_ACCEPT {
                Some(dialog.get_results())
            } else {
                None
            }
        })
    }
}

use crate::backend::AsyncFilePickerDialogImpl;
impl AsyncFilePickerDialogImpl for FileDialog {
    fn pick_file_async(self) -> DialogFutureType<Option<FileHandle>> {
        let builder = move || GtkFileDialog::build_pick_file(&self);

        let future = GtkDialogFuture::new(builder, |dialog, res_id| {
            if res_id == gtk_sys::GTK_RESPONSE_ACCEPT {
                dialog.get_result().map(FileHandle::wrap)
            } else {
                None
            }
        });

        Box::pin(future)
    }

    fn pick_files_async(self) -> DialogFutureType<Option<Vec<FileHandle>>> {
        let builder = move || GtkFileDialog::build_pick_files(&self);

        let future = GtkDialogFuture::new(builder, |dialog, res_id| {
            if res_id == gtk_sys::GTK_RESPONSE_ACCEPT {
                Some(
                    dialog
                        .get_results()
                        .into_iter()
                        .map(FileHandle::wrap)
                        .collect(),
                )
            } else {
                None
            }
        });

        Box::pin(future)
    }
}

//
// Folder Picker
//

use crate::backend::FolderPickerDialogImpl;
impl FolderPickerDialogImpl for FileDialog {
    fn pick_folder(self) -> Option<PathBuf> {
        GtkGlobalThread::instance().run_blocking(move || {
            let dialog = GtkFileDialog::build_pick_folder(&self);

            if dialog.run() == gtk_sys::GTK_RESPONSE_ACCEPT {
                dialog.get_result()
            } else {
                None
            }
        })
    }

    fn pick_folders(self) -> Option<Vec<PathBuf>> {
        GtkGlobalThread::instance().run_blocking(move || {
            let dialog = GtkFileDialog::build_pick_folders(&self);

            if dialog.run() == gtk_sys::GTK_RESPONSE_ACCEPT {
                Some(dialog.get_results())
            } else {
                None
            }
        })
    }
}

use crate::backend::AsyncFolderPickerDialogImpl;
impl AsyncFolderPickerDialogImpl for FileDialog {
    fn pick_folder_async(self) -> DialogFutureType<Option<FileHandle>> {
        let builder = move || GtkFileDialog::build_pick_folder(&self);

        let future = GtkDialogFuture::new(builder, |dialog, res_id| {
            if res_id == gtk_sys::GTK_RESPONSE_ACCEPT {
                dialog.get_result().map(FileHandle::wrap)
            } else {
                None
            }
        });

        Box::pin(future)
    }

    fn pick_folders_async(self) -> DialogFutureType<Option<Vec<FileHandle>>> {
        let builder = move || GtkFileDialog::build_pick_folders(&self);

        let future = GtkDialogFuture::new(builder, |dialog, res_id| {
            if res_id == gtk_sys::GTK_RESPONSE_ACCEPT {
                Some(
                    dialog
                        .get_results()
                        .into_iter()
                        .map(FileHandle::wrap)
                        .collect(),
                )
            } else {
                None
            }
        });

        Box::pin(future)
    }
}

//
// File Save
//

use crate::backend::FileSaveDialogImpl;
impl FileSaveDialogImpl for FileDialog {
    fn save_file(self) -> Option<PathBuf> {
        GtkGlobalThread::instance().run_blocking(move || {
            let dialog = GtkFileDialog::build_save_file(&self);

            if dialog.run() == gtk_sys::GTK_RESPONSE_ACCEPT {
                dialog.get_result()
            } else {
                None
            }
        })
    }
}

use crate::backend::AsyncFileSaveDialogImpl;
impl AsyncFileSaveDialogImpl for FileDialog {
    fn save_file_async(self) -> DialogFutureType<Option<FileHandle>> {
        let builder = move || GtkFileDialog::build_save_file(&self);

        let future = GtkDialogFuture::new(builder, |dialog, res_id| {
            if res_id == gtk_sys::GTK_RESPONSE_ACCEPT {
                dialog.get_result().map(FileHandle::wrap)
            } else {
                None
            }
        });

        Box::pin(future)
    }
}
