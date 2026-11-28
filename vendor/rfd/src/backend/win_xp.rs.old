//! Windows commdlg.h dialogs
//! Win32 XP
use crate::DialogOptions;

use std::path::PathBuf;

use winapi::um::commdlg::{
    GetOpenFileNameW, GetSaveFileNameW, OFN_ALLOWMULTISELECT, OFN_EXPLORER, OFN_FILEMUSTEXIST,
    OFN_NOCHANGEDIR, OFN_OVERWRITEPROMPT, OFN_PATHMUSTEXIST,
};

extern "C" {
    fn wcslen(buf: *const u16) -> usize;
}

mod utils {
    use crate::DialogOptions;

    use std::{ffi::OsStr, iter::once, mem, os::windows::ffi::OsStrExt};

    use winapi::um::commdlg::OPENFILENAMEW;

    pub unsafe fn build_ofn(
        path: &mut Vec<u16>,
        filters: Option<&Vec<u16>>,
        flags: u32,
    ) -> OPENFILENAMEW {
        let mut ofn: OPENFILENAMEW = std::mem::zeroed();
        ofn.lStructSize = mem::size_of::<OPENFILENAMEW>() as u32;
        ofn.hwndOwner = std::mem::zeroed();

        ofn.lpstrFile = path.as_mut_ptr();
        ofn.nMaxFile = path.len() as _;

        if let Some(filters) = filters {
            ofn.lpstrFilter = filters.as_ptr();
            ofn.nFilterIndex = 1;
        }

        ofn.Flags = flags;

        ofn
    }

    pub fn build_filters(params: &DialogParams) -> Option<Vec<u16>> {
        let mut filters = String::new();

        for f in params.filters.iter() {
            filters += &format!("{}\0{}\0", f.0, f.1);
        }

        let filter: Option<Vec<u16>> = if !params.filters.is_empty() {
            Some(OsStr::new(&filters).encode_wide().chain(once(0)).collect())
        } else {
            None
        };

        filter
    }
}

use utils::*;

pub fn open_file_with_params(params: DialogOptions) -> Option<PathBuf> {
    let filters = build_filters(&params);

    unsafe {
        // This vec needs to be initialized with zeros, so we do not use `Vec::with_capacity` here
        let mut path: Vec<u16> = vec![0; 260];

        let flags = OFN_EXPLORER | OFN_PATHMUSTEXIST | OFN_FILEMUSTEXIST | OFN_NOCHANGEDIR;

        let mut ofn = build_ofn(&mut path, filters.as_ref(), flags);
        let out = GetOpenFileNameW(&mut ofn);

        if out == 1 {
            let l = wcslen(ofn.lpstrFile);

            // Trim string
            path.set_len(l);

            String::from_utf16(&path).ok().map(PathBuf::from)
        } else {
            None
        }
    }
}

pub fn save_file_with_params(params: DialogOptions) -> Option<PathBuf> {
    let filters = build_filters(&params);

    unsafe {
        // This vec needs to be initialized with zeros, so we do not use `Vec::with_capacity` here
        let mut path: Vec<u16> = vec![0; 260];

        let flags = OFN_EXPLORER
            | OFN_OVERWRITEPROMPT
            | OFN_PATHMUSTEXIST
            | OFN_FILEMUSTEXIST
            | OFN_NOCHANGEDIR;

        let mut ofn = build_ofn(&mut path, filters.as_ref(), flags);
        let out = GetSaveFileNameW(&mut ofn);

        if out == 1 {
            let l = wcslen(ofn.lpstrFile);
            // Trim string
            path.set_len(l);

            String::from_utf16(&path).ok().map(PathBuf::from)
        } else {
            None
        }
    }
}

pub fn pick_folder_with_params(params: DialogOptions) -> Option<PathBuf> {
    unimplemented!("pick_folder");
}

pub fn open_multiple_files_with_params(params: DialogOptions) -> Option<Vec<PathBuf>> {
    let filters = build_filters(&params);

    unsafe {
        // This vec needs to be initialized with zeros, so we do not use `Vec::with_capacity` here
        let mut path: Vec<u16> = vec![0; 260];

        let flags = OFN_EXPLORER
            | OFN_ALLOWMULTISELECT
            | OFN_PATHMUSTEXIST
            | OFN_FILEMUSTEXIST
            | OFN_NOCHANGEDIR;

        let mut ofn = build_ofn(&mut path, filters.as_ref(), flags);
        let out = GetOpenFileNameW(&mut ofn);

        if out == 1 {
            String::from_utf16(&path).ok().map(|s| {
                let mut res = Vec::new();

                let split = s.split("\u{0}");
                for elm in split {
                    if !elm.is_empty() {
                        res.push(PathBuf::from(elm));
                    } else {
                        break;
                    }
                }

                if res.len() == 1 {
                    // 0th element is path to a files
                    res
                } else {
                    // 0th element is base path of all files
                    let dir = res.remove(0);
                    // Add base path to all files
                    res.into_iter().map(|i| dir.clone().join(i)).collect()
                }
            })
        } else {
            None
        }
    }
}
