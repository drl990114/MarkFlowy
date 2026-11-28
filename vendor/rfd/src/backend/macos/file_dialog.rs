use objc2::rc::autoreleasepool;
use objc2_app_kit::NSModalResponseOK;
use std::path::PathBuf;

mod panel_ffi;

use self::panel_ffi::Panel;
use super::modal_future::ModalFuture;
use super::utils::{run_on_main, window_from_raw_window_handle};
use crate::backend::DialogFutureType;
use crate::{FileDialog, FileHandle};

//
// File Picker
//

use crate::backend::FilePickerDialogImpl;
impl FilePickerDialogImpl for FileDialog {
    fn pick_file(self) -> Option<PathBuf> {
        autoreleasepool(move |_| {
            run_on_main(move |mtm| {
                let panel = Panel::build_pick_file(&self, mtm);

                if panel.run_modal() == NSModalResponseOK {
                    Some(panel.get_result())
                } else {
                    None
                }
            })
        })
    }

    fn pick_files(self) -> Option<Vec<PathBuf>> {
        autoreleasepool(move |_| {
            run_on_main(move |mtm| {
                let panel = Panel::build_pick_files(&self, mtm);

                if panel.run_modal() == NSModalResponseOK {
                    Some(panel.get_results())
                } else {
                    None
                }
            })
        })
    }
}

use crate::backend::AsyncFilePickerDialogImpl;
impl AsyncFilePickerDialogImpl for FileDialog {
    fn pick_file_async(self) -> DialogFutureType<Option<FileHandle>> {
        let win = self.parent.as_ref().map(window_from_raw_window_handle);

        let future = ModalFuture::new(
            win,
            move |mtm| Panel::build_pick_file(&self, mtm),
            |panel, res_id| {
                if res_id == NSModalResponseOK {
                    Some(panel.get_result().into())
                } else {
                    None
                }
            },
        );

        Box::pin(future)
    }

    fn pick_files_async(self) -> DialogFutureType<Option<Vec<FileHandle>>> {
        let win = self.parent.as_ref().map(window_from_raw_window_handle);

        let future = ModalFuture::new(
            win,
            move |mtm| Panel::build_pick_files(&self, mtm),
            |panel, res_id| {
                if res_id == NSModalResponseOK {
                    Some(
                        panel
                            .get_results()
                            .into_iter()
                            .map(FileHandle::wrap)
                            .collect(),
                    )
                } else {
                    None
                }
            },
        );

        Box::pin(future)
    }
}

//
// Folder Picker
//

use crate::backend::FolderPickerDialogImpl;
impl FolderPickerDialogImpl for FileDialog {
    fn pick_folder(self) -> Option<PathBuf> {
        autoreleasepool(move |_| {
            run_on_main(move |mtm| {
                let panel = Panel::build_pick_folder(&self, mtm);
                if panel.run_modal() == NSModalResponseOK {
                    Some(panel.get_result())
                } else {
                    None
                }
            })
        })
    }

    fn pick_folders(self) -> Option<Vec<PathBuf>> {
        autoreleasepool(move |_| {
            run_on_main(move |mtm| {
                let panel = Panel::build_pick_folders(&self, mtm);
                if panel.run_modal() == NSModalResponseOK {
                    Some(panel.get_results())
                } else {
                    None
                }
            })
        })
    }
}

use crate::backend::AsyncFolderPickerDialogImpl;
impl AsyncFolderPickerDialogImpl for FileDialog {
    fn pick_folder_async(self) -> DialogFutureType<Option<FileHandle>> {
        let win = self.parent.as_ref().map(window_from_raw_window_handle);

        let future = ModalFuture::new(
            win,
            move |mtm| Panel::build_pick_folder(&self, mtm),
            |panel, res_id| {
                if res_id == NSModalResponseOK {
                    Some(panel.get_result().into())
                } else {
                    None
                }
            },
        );

        Box::pin(future)
    }

    fn pick_folders_async(self) -> DialogFutureType<Option<Vec<FileHandle>>> {
        let win = self.parent.as_ref().map(window_from_raw_window_handle);

        let future = ModalFuture::new(
            win,
            move |mtm| Panel::build_pick_folders(&self, mtm),
            |panel, res_id| {
                if res_id == NSModalResponseOK {
                    Some(
                        panel
                            .get_results()
                            .into_iter()
                            .map(FileHandle::wrap)
                            .collect(),
                    )
                } else {
                    None
                }
            },
        );

        Box::pin(future)
    }
}

//
// File Save
//

use crate::backend::FileSaveDialogImpl;
impl FileSaveDialogImpl for FileDialog {
    fn save_file(self) -> Option<PathBuf> {
        autoreleasepool(move |_| {
            run_on_main(move |mtm| {
                let panel = Panel::build_save_file(&self, mtm);
                if panel.run_modal() == NSModalResponseOK {
                    Some(panel.get_result())
                } else {
                    None
                }
            })
        })
    }
}

use crate::backend::AsyncFileSaveDialogImpl;
impl AsyncFileSaveDialogImpl for FileDialog {
    fn save_file_async(self) -> DialogFutureType<Option<FileHandle>> {
        let win = self.parent.as_ref().map(window_from_raw_window_handle);

        let future = ModalFuture::new(
            win,
            move |mtm| Panel::build_save_file(&self, mtm),
            |panel, res_id| {
                if res_id == NSModalResponseOK {
                    Some(panel.get_result().into())
                } else {
                    None
                }
            },
        );

        Box::pin(future)
    }
}
