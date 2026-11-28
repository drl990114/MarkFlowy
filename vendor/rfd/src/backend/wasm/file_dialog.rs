//
// File Save
//

use crate::{
    backend::{AsyncFileSaveDialogImpl, DialogFutureType},
    file_dialog::FileDialog,
    FileHandle,
};
use std::future::ready;
impl AsyncFileSaveDialogImpl for FileDialog {
    fn save_file_async(self) -> DialogFutureType<Option<FileHandle>> {
        let file = FileHandle::writable(self);
        Box::pin(ready(Some(file)))
    }
}
