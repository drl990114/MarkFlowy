use windows_sys::{
    core::HRESULT,
    Win32::System::Com::{
        CoInitializeEx, CoUninitialize, COINIT_APARTMENTTHREADED, COINIT_DISABLE_OLE1DDE,
    },
};

#[inline]
pub(crate) fn str_to_vec_u16(s: &str) -> Vec<u16> {
    let mut v: Vec<_> = s.encode_utf16().collect();
    v.push(0);
    v
}

/// Makes sure that COM lib is initialized long enough
pub fn init_com<T, F: FnOnce() -> T>(f: F) -> Result<T, HRESULT> {
    let res = unsafe {
        CoInitializeEx(
            std::ptr::null(),
            (COINIT_APARTMENTTHREADED | COINIT_DISABLE_OLE1DDE) as u32,
        )
    };

    if res < 0 {
        return Err(res);
    }

    let out = f();

    unsafe {
        CoUninitialize();
    }

    Ok(out)
}
