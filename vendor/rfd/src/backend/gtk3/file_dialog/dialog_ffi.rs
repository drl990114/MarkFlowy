use super::super::AsGtkDialog;
use crate::FileDialog;
use gtk_sys::GtkFileChooserNative;

use std::{
    ffi::{CStr, CString},
    ops::Deref,
    path::{Path, PathBuf},
    ptr,
};

#[repr(i32)]
pub enum GtkFileChooserAction {
    Open = 0,
    Save = 1,
    SelectFolder = 2,
    // CreateFolder = 3,
}

pub struct GtkFileDialog {
    pub ptr: *mut GtkFileChooserNative,
}

impl GtkFileDialog {
    fn new(title: &str, action: GtkFileChooserAction) -> Self {
        let title = CString::new(title).unwrap();

        let ptr = unsafe {
            let dialog = gtk_sys::gtk_file_chooser_native_new(
                title.as_ptr(),
                ptr::null_mut(),
                action as i32,
                // passing null for the texts will use the default text, which has full support for i18n
                std::ptr::null(),
                std::ptr::null(),
            );
            dialog as _
        };

        Self { ptr }
    }

    fn add_filters(&mut self, filters: &[crate::file_dialog::Filter]) {
        for f in filters.iter() {
            if let Ok(name) = CString::new(f.name.as_str()) {
                unsafe {
                    let filter = gtk_sys::gtk_file_filter_new();

                    let paterns: Vec<_> = f
                        .extensions
                        .iter()
                        .filter_map(|e| CString::new(format!("*.{}", e)).ok())
                        .collect();

                    gtk_sys::gtk_file_filter_set_name(filter, name.as_ptr());

                    for p in paterns.iter() {
                        gtk_sys::gtk_file_filter_add_pattern(filter, p.as_ptr());
                    }

                    gtk_sys::gtk_file_chooser_add_filter(self.ptr as _, filter);
                }
            }
        }
    }

    fn set_file_name(&self, name: Option<&str>) {
        if let Some(name) = name {
            if let Ok(name) = CString::new(name) {
                unsafe {
                    gtk_sys::gtk_file_chooser_set_filename(self.ptr as _, name.as_ptr());
                }
            }
        }
    }

    fn set_current_name(&self, name: Option<&str>) {
        if let Some(name) = name {
            if let Ok(name) = CString::new(name) {
                unsafe {
                    gtk_sys::gtk_file_chooser_set_current_name(self.ptr as _, name.as_ptr());
                }
            }
        }
    }

    fn set_path(&self, path: Option<&Path>) {
        if let Some(path) = path {
            if let Some(path) = path.to_str() {
                if let Ok(path) = CString::new(path) {
                    unsafe {
                        gtk_sys::gtk_file_chooser_set_current_folder(self.ptr as _, path.as_ptr());
                    }
                }
            }
        }
    }

    pub fn get_result(&self) -> Option<PathBuf> {
        let cstr = unsafe {
            let chosen_filename = gtk_sys::gtk_file_chooser_get_filename(self.ptr as _);
            CStr::from_ptr(chosen_filename).to_str()
        };

        if let Ok(cstr) = cstr {
            Some(PathBuf::from(cstr.to_owned()))
        } else {
            None
        }
    }

    pub fn get_results(&self) -> Vec<PathBuf> {
        #[derive(Debug)]
        struct FileList(*mut glib_sys::GSList);

        impl Iterator for FileList {
            type Item = glib_sys::GSList;
            fn next(&mut self) -> Option<Self::Item> {
                let curr_ptr = self.0;

                if !curr_ptr.is_null() {
                    let curr = unsafe { *curr_ptr };

                    self.0 = curr.next;

                    Some(curr)
                } else {
                    None
                }
            }
        }

        let chosen_filenames =
            unsafe { gtk_sys::gtk_file_chooser_get_filenames(self.ptr as *mut _) };

        let paths: Vec<PathBuf> = FileList(chosen_filenames)
            .filter_map(|item| {
                let cstr = unsafe { CStr::from_ptr(item.data as _).to_str() };

                if let Ok(cstr) = cstr {
                    Some(PathBuf::from(cstr.to_owned()))
                } else {
                    None
                }
            })
            .collect();

        paths
    }

    pub fn run(&self) -> i32 {
        unsafe { gtk_sys::gtk_native_dialog_run(self.ptr as *mut _) }
    }
}

impl GtkFileDialog {
    pub fn build_pick_file(opt: &FileDialog) -> Self {
        let mut dialog = GtkFileDialog::new(
            opt.title.as_deref().unwrap_or("Open File"),
            GtkFileChooserAction::Open,
        );

        dialog.add_filters(&opt.filters);
        dialog.set_path(opt.starting_directory.as_deref());

        if let (Some(mut path), Some(file_name)) =
            (opt.starting_directory.to_owned(), opt.file_name.as_deref())
        {
            path.push(file_name);
            dialog.set_file_name(path.deref().to_str());
        } else {
            dialog.set_file_name(opt.file_name.as_deref());
        }

        dialog
    }

    pub fn build_save_file(opt: &FileDialog) -> Self {
        let mut dialog = GtkFileDialog::new(
            opt.title.as_deref().unwrap_or("Save File"),
            GtkFileChooserAction::Save,
        );

        unsafe { gtk_sys::gtk_file_chooser_set_do_overwrite_confirmation(dialog.ptr as _, 1) };

        dialog.add_filters(&opt.filters);
        dialog.set_path(opt.starting_directory.as_deref());

        if let (Some(mut path), Some(file_name)) =
            (opt.starting_directory.to_owned(), opt.file_name.as_deref())
        {
            path.push(file_name);
            if path.exists() {
                // the user edited an existing document
                dialog.set_file_name(path.deref().to_str());
            } else {
                // the user just created a new document
                dialog.set_current_name(opt.file_name.as_deref());
            }
        } else {
            // the user just created a new document
            dialog.set_current_name(opt.file_name.as_deref());
        }

        dialog
    }

    pub fn build_pick_folder(opt: &FileDialog) -> Self {
        let dialog = GtkFileDialog::new(
            opt.title.as_deref().unwrap_or("Select Folder"),
            GtkFileChooserAction::SelectFolder,
        );
        dialog.set_path(opt.starting_directory.as_deref());

        if let (Some(mut path), Some(file_name)) =
            (opt.starting_directory.to_owned(), opt.file_name.as_deref())
        {
            path.push(file_name);
            dialog.set_file_name(path.deref().to_str());
        } else {
            dialog.set_file_name(opt.file_name.as_deref());
        }

        dialog
    }

    pub fn build_pick_folders(opt: &FileDialog) -> Self {
        let dialog = GtkFileDialog::new(
            opt.title.as_deref().unwrap_or("Select Folder"),
            GtkFileChooserAction::SelectFolder,
        );
        unsafe { gtk_sys::gtk_file_chooser_set_select_multiple(dialog.ptr as _, 1) };
        dialog.set_path(opt.starting_directory.as_deref());

        if let (Some(mut path), Some(file_name)) =
            (opt.starting_directory.to_owned(), opt.file_name.as_deref())
        {
            path.push(file_name);
            dialog.set_file_name(path.deref().to_str());
        } else {
            dialog.set_file_name(opt.file_name.as_deref());
        }

        dialog
    }

    pub fn build_pick_files(opt: &FileDialog) -> Self {
        let mut dialog = GtkFileDialog::new(
            opt.title.as_deref().unwrap_or("Open File"),
            GtkFileChooserAction::Open,
        );

        unsafe { gtk_sys::gtk_file_chooser_set_select_multiple(dialog.ptr as _, 1) };
        dialog.add_filters(&opt.filters);
        dialog.set_path(opt.starting_directory.as_deref());

        if let (Some(mut path), Some(file_name)) =
            (opt.starting_directory.to_owned(), opt.file_name.as_deref())
        {
            path.push(file_name);
            dialog.set_file_name(path.deref().to_str());
        } else {
            dialog.set_file_name(opt.file_name.as_deref());
        }

        dialog
    }
}

impl AsGtkDialog for GtkFileDialog {
    fn gtk_dialog_ptr(&self) -> *mut gtk_sys::GtkDialog {
        self.ptr as *mut _
    }

    unsafe fn show(&self) {
        gtk_sys::gtk_native_dialog_show(self.ptr as *mut _);
    }
}

impl Drop for GtkFileDialog {
    fn drop(&mut self) {
        unsafe {
            gtk_sys::gtk_native_dialog_destroy(self.ptr as _);
        }
    }
}
