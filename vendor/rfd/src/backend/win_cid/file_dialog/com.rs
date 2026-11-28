#![allow(non_snake_case)]

use std::ffi::c_void;
use windows_sys::core::{HRESULT, PCWSTR, PWSTR};
pub use windows_sys::{
    core::GUID,
    Win32::{
        Foundation::HWND,
        UI::Shell::{Common::COMDLG_FILTERSPEC, FILEOPENDIALOGOPTIONS, SIGDN, SIGDN_FILESYSPATH},
    },
};

pub(crate) type Result<T> = std::result::Result<T, HRESULT>;

#[inline]
pub(super) fn wrap_err(hresult: HRESULT) -> Result<()> {
    if hresult >= 0 {
        Ok(())
    } else {
        Err(hresult)
    }
}

#[inline]
unsafe fn read_to_string(ptr: *const u16) -> String {
    let mut cursor = ptr;

    while *cursor != 0 {
        cursor = cursor.add(1);
    }

    let slice = std::slice::from_raw_parts(ptr, cursor.offset_from(ptr) as usize);
    String::from_utf16(slice).unwrap()
}

#[repr(C)]
pub(super) struct Interface<T> {
    vtable: *mut T,
}

impl<T> Interface<T> {
    #[inline]
    pub(super) fn vtbl(&self) -> &T {
        unsafe { &*self.vtable }
    }
}

#[repr(C)]
pub(super) struct IUnknownV {
    __query_interface: usize,
    __add_ref: usize,
    pub(super) release: unsafe extern "system" fn(this: *mut c_void) -> u32,
}

pub(super) type IUnknown = Interface<IUnknownV>;

#[inline]
fn drop_impl(ptr: *mut c_void) {
    unsafe {
        ((*ptr.cast::<IUnknown>()).vtbl().release)(ptr);
    }
}

#[repr(C)]
pub(super) struct IShellItemV {
    base: IUnknownV,
    BindToHandler: unsafe extern "system" fn(
        this: *mut c_void,
        pbc: *mut c_void,
        bhid: *const GUID,
        riid: *const GUID,
        ppv: *mut *mut c_void,
    ) -> HRESULT,
    GetParent: unsafe extern "system" fn(this: *mut c_void, ppsi: *mut *mut c_void) -> HRESULT,
    GetDisplayName: unsafe extern "system" fn(
        this: *mut c_void,
        sigdnname: SIGDN,
        ppszname: *mut PWSTR,
    ) -> HRESULT,
    GetAttributes: usize,
    Compare: unsafe extern "system" fn(
        this: *mut c_void,
        psi: *mut c_void,
        hint: u32,
        piorder: *mut i32,
    ) -> HRESULT,
}

#[repr(transparent)]
pub(super) struct IShellItem(pub(super) *mut Interface<IShellItemV>);

impl IShellItem {
    pub(super) fn get_path(&self) -> Result<std::path::PathBuf> {
        let filename = unsafe {
            let mut dname = std::mem::MaybeUninit::uninit();
            wrap_err(((*self.0).vtbl().GetDisplayName)(
                self.0.cast(),
                SIGDN_FILESYSPATH,
                dname.as_mut_ptr(),
            ))?;

            let dname = dname.assume_init();
            let fname = read_to_string(dname);
            windows_sys::Win32::System::Com::CoTaskMemFree(dname.cast());
            fname
        };

        Ok(filename.into())
    }
}

impl Drop for IShellItem {
    fn drop(&mut self) {
        drop_impl(self.0.cast());
    }
}

#[repr(C)]
struct IShellItemArrayV {
    base: IUnknownV,
    BindToHandler: unsafe extern "system" fn(
        this: *mut c_void,
        pbc: *mut c_void,
        bhid: *const GUID,
        riid: *const GUID,
        ppvout: *mut *mut c_void,
    ) -> HRESULT,
    GetPropertyStore: usize,
    GetPropertyDescriptionList: usize,
    GetAttributes: usize,
    GetCount: unsafe extern "system" fn(this: *mut c_void, pdwnumitems: *mut u32) -> HRESULT,
    GetItemAt: unsafe extern "system" fn(
        this: *mut c_void,
        dwindex: u32,
        ppsi: *mut IShellItem,
    ) -> HRESULT,
    EnumItems:
        unsafe extern "system" fn(this: *mut c_void, ppenumshellitems: *mut *mut c_void) -> HRESULT,
}

#[repr(transparent)]
pub(super) struct IShellItemArray(*mut Interface<IShellItemArrayV>);

impl IShellItemArray {
    #[inline]
    pub(super) fn get_count(&self) -> Result<u32> {
        let mut count = 0;
        unsafe {
            wrap_err(((*self.0).vtbl().GetCount)(self.0.cast(), &mut count))?;
        }
        Ok(count)
    }

    #[inline]
    pub(super) fn get_item_at(&self, index: u32) -> Result<IShellItem> {
        let mut item = std::mem::MaybeUninit::uninit();
        unsafe {
            wrap_err(((*self.0).vtbl().GetItemAt)(
                self.0.cast(),
                index,
                item.as_mut_ptr(),
            ))?;
            Ok(item.assume_init())
        }
    }
}

impl Drop for IShellItemArray {
    fn drop(&mut self) {
        drop_impl(self.0.cast());
    }
}

#[repr(C)]
pub(super) struct IModalWindowV {
    base: IUnknownV,
    pub(super) Show: unsafe extern "system" fn(this: *mut c_void, owner: HWND) -> HRESULT,
}

/// <https://learn.microsoft.com/en-us/windows/win32/api/shobjidl_core/nn-shobjidl_core-ifiledialog>
#[repr(C)]
pub(super) struct IFileDialogV {
    pub(super) base: IModalWindowV,
    pub(super) SetFileTypes: unsafe extern "system" fn(
        this: *mut c_void,
        cfiletypes: u32,
        rgfilterspec: *const COMDLG_FILTERSPEC,
    ) -> HRESULT,
    SetFileTypeIndex: unsafe extern "system" fn(this: *mut c_void, ifiletype: u32) -> HRESULT,
    GetFileTypeIndex: unsafe extern "system" fn(this: *mut c_void, pifiletype: *mut u32) -> HRESULT,
    Advise: unsafe extern "system" fn(
        this: *mut c_void,
        pfde: *mut c_void,
        pdwcookie: *mut u32,
    ) -> HRESULT,
    Unadvise: unsafe extern "system" fn(this: *mut c_void, dwcookie: u32) -> HRESULT,
    pub(super) SetOptions:
        unsafe extern "system" fn(this: *mut c_void, fos: FILEOPENDIALOGOPTIONS) -> HRESULT,
    GetOptions:
        unsafe extern "system" fn(this: *mut c_void, pfos: *mut FILEOPENDIALOGOPTIONS) -> HRESULT,
    SetDefaultFolder: unsafe extern "system" fn(this: *mut c_void, psi: *mut c_void) -> HRESULT,
    pub(super) SetFolder: unsafe extern "system" fn(this: *mut c_void, psi: *mut c_void) -> HRESULT,
    GetFolder: unsafe extern "system" fn(this: *mut c_void, ppsi: *mut *mut c_void) -> HRESULT,
    GetCurrentSelection:
        unsafe extern "system" fn(this: *mut c_void, ppsi: *mut *mut c_void) -> HRESULT,
    pub(super) SetFileName:
        unsafe extern "system" fn(this: *mut c_void, pszname: PCWSTR) -> HRESULT,
    GetFileName: unsafe extern "system" fn(this: *mut c_void, pszname: *mut PWSTR) -> HRESULT,
    pub(super) SetTitle: unsafe extern "system" fn(this: *mut c_void, psztitle: PCWSTR) -> HRESULT,
    SetOkButtonLabel: unsafe extern "system" fn(this: *mut c_void, psztext: PCWSTR) -> HRESULT,
    SetFileNameLabel: unsafe extern "system" fn(this: *mut c_void, pszlabel: PCWSTR) -> HRESULT,
    pub(super) GetResult:
        unsafe extern "system" fn(this: *mut c_void, ppsi: *mut IShellItem) -> HRESULT,
    AddPlace: unsafe extern "system" fn(
        this: *mut c_void,
        psi: *mut c_void,
        fdap: windows_sys::Win32::UI::Shell::FDAP,
    ) -> HRESULT,
    pub(super) SetDefaultExtension:
        unsafe extern "system" fn(this: *mut c_void, pszdefaultextension: PCWSTR) -> HRESULT,
    Close: unsafe extern "system" fn(this: *mut c_void, hr: HRESULT) -> HRESULT,
    SetClientGuid: unsafe extern "system" fn(this: *mut c_void, guid: *const GUID) -> HRESULT,
    ClearClientData: unsafe extern "system" fn(this: *mut c_void) -> HRESULT,
    SetFilter: unsafe extern "system" fn(this: *mut c_void, pfilter: *mut c_void) -> HRESULT,
}

#[repr(transparent)]
pub(super) struct IFileDialog(pub(super) *mut Interface<IFileDialogV>);

impl Drop for IFileDialog {
    fn drop(&mut self) {
        drop_impl(self.0.cast());
    }
}

/// <https://learn.microsoft.com/en-us/windows/win32/api/shobjidl_core/nn-shobjidl_core-ifileopendialog>
#[repr(C)]
pub(super) struct IFileOpenDialogV {
    pub(super) base: IFileDialogV,
    /// <https://learn.microsoft.com/en-us/windows/win32/api/shobjidl_core/nf-shobjidl_core-ifileopendialog-getresults>
    GetResults:
        unsafe extern "system" fn(this: *mut c_void, ppenum: *mut IShellItemArray) -> HRESULT,
    GetSelectedItems:
        unsafe extern "system" fn(this: *mut c_void, ppsai: *mut *mut c_void) -> HRESULT,
}

#[repr(transparent)]
pub(super) struct IFileOpenDialog(pub(super) *mut Interface<IFileOpenDialogV>);

impl IFileOpenDialog {
    #[inline]
    pub(super) fn get_results(&self) -> Result<IShellItemArray> {
        let mut res = std::mem::MaybeUninit::uninit();
        unsafe {
            wrap_err((((*self.0).vtbl()).GetResults)(
                self.0.cast(),
                res.as_mut_ptr(),
            ))?;
            Ok(res.assume_init())
        }
    }
}

impl Drop for IFileOpenDialog {
    fn drop(&mut self) {
        drop_impl(self.0.cast());
    }
}
