mod file_dialog;
mod message_dialog;

mod gtk_future;

mod utils;

pub(self) trait AsGtkDialog {
    fn gtk_dialog_ptr(&self) -> *mut gtk_sys::GtkDialog;
    unsafe fn show(&self);
}
