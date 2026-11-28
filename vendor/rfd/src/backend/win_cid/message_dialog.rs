use super::thread_future::ThreadFuture;
use super::utils::str_to_vec_u16;
use crate::message_dialog::{MessageButtons, MessageDialog, MessageDialogResult, MessageLevel};

use windows_sys::Win32::{
    Foundation::HWND,
    UI::WindowsAndMessaging::{IDCANCEL, IDNO, IDOK, IDYES},
};

#[cfg(not(feature = "common-controls-v6"))]
use windows_sys::Win32::UI::WindowsAndMessaging::{
    MessageBoxW, MB_ICONERROR, MB_ICONINFORMATION, MB_ICONWARNING, MB_OK, MB_OKCANCEL, MB_YESNO,
    MB_YESNOCANCEL, MESSAGEBOX_STYLE,
};

use raw_window_handle::RawWindowHandle;

pub struct WinMessageDialog {
    parent: Option<HWND>,
    text: Vec<u16>,
    caption: Vec<u16>,
    #[cfg(not(feature = "common-controls-v6"))]
    flags: MESSAGEBOX_STYLE,
    #[cfg(feature = "common-controls-v6")]
    opt: MessageDialog,
}

// Oh god, I don't like sending RawWindowHandle between threads but here we go anyways...
// fingers crossed
unsafe impl Send for WinMessageDialog {}

impl WinMessageDialog {
    pub fn new(opt: MessageDialog) -> Self {
        let text: Vec<u16> = str_to_vec_u16(&opt.description);
        let caption: Vec<u16> = str_to_vec_u16(&opt.title);

        #[cfg(not(feature = "common-controls-v6"))]
        let level = match opt.level {
            MessageLevel::Info => MB_ICONINFORMATION,
            MessageLevel::Warning => MB_ICONWARNING,
            MessageLevel::Error => MB_ICONERROR,
        };

        #[cfg(not(feature = "common-controls-v6"))]
        let buttons = match opt.buttons {
            MessageButtons::Ok | MessageButtons::OkCustom(_) => MB_OK,
            MessageButtons::OkCancel | MessageButtons::OkCancelCustom(_, _) => MB_OKCANCEL,
            MessageButtons::YesNo => MB_YESNO,
            MessageButtons::YesNoCancel | MessageButtons::YesNoCancelCustom(_, _, _) => {
                MB_YESNOCANCEL
            }
        };

        let parent = match opt.parent {
            Some(RawWindowHandle::Win32(handle)) => Some(handle.hwnd.get() as _),
            None => None,
            _ => unreachable!("unsupported window handle, expected: Windows"),
        };

        Self {
            parent,
            text,
            caption,
            #[cfg(not(feature = "common-controls-v6"))]
            flags: level | buttons,
            #[cfg(feature = "common-controls-v6")]
            opt,
        }
    }

    #[cfg(feature = "common-controls-v6")]
    pub fn run(self) -> MessageDialogResult {
        use windows_sys::{
            core::BOOL,
            Win32::UI::Controls::{
                TaskDialogIndirect, TASKDIALOGCONFIG, TASKDIALOGCONFIG_0, TASKDIALOGCONFIG_1,
                TASKDIALOG_BUTTON, TDCBF_CANCEL_BUTTON, TDCBF_NO_BUTTON, TDCBF_OK_BUTTON,
                TDCBF_YES_BUTTON, TDF_ALLOW_DIALOG_CANCELLATION, TDF_SIZE_TO_CONTENT,
                TD_ERROR_ICON, TD_INFORMATION_ICON, TD_WARNING_ICON,
            },
        };

        let mut pf_verification_flag_checked = 0;
        let mut pn_button = 0;
        let mut pn_radio_button = 0;

        const ID_CUSTOM_OK: i32 = 1000;
        const ID_CUSTOM_CANCEL: i32 = 1001;
        const ID_CUSTOM_YES: i32 = 1004;
        const ID_CUSTOM_NO: i32 = 1008;

        let main_icon_ptr = match self.opt.level {
            MessageLevel::Warning => TD_WARNING_ICON,
            MessageLevel::Error => TD_ERROR_ICON,
            MessageLevel::Info => TD_INFORMATION_ICON,
        };

        let (system_buttons, custom_buttons) = match &self.opt.buttons {
            MessageButtons::Ok => (TDCBF_OK_BUTTON, vec![]),
            MessageButtons::OkCancel => (TDCBF_OK_BUTTON | TDCBF_CANCEL_BUTTON, vec![]),
            MessageButtons::YesNo => (TDCBF_YES_BUTTON | TDCBF_NO_BUTTON, vec![]),
            MessageButtons::YesNoCancel => (
                TDCBF_YES_BUTTON | TDCBF_NO_BUTTON | TDCBF_CANCEL_BUTTON,
                vec![],
            ),
            MessageButtons::OkCustom(ok_text) => (
                Default::default(),
                vec![(ID_CUSTOM_OK, str_to_vec_u16(ok_text))],
            ),
            MessageButtons::OkCancelCustom(ok_text, cancel_text) => (
                Default::default(),
                vec![
                    (ID_CUSTOM_OK, str_to_vec_u16(ok_text)),
                    (ID_CUSTOM_CANCEL, str_to_vec_u16(cancel_text)),
                ],
            ),
            MessageButtons::YesNoCancelCustom(yes_text, no_text, cancel_text) => (
                Default::default(),
                vec![
                    (ID_CUSTOM_YES, str_to_vec_u16(yes_text)),
                    (ID_CUSTOM_NO, str_to_vec_u16(no_text)),
                    (ID_CUSTOM_CANCEL, str_to_vec_u16(cancel_text)),
                ],
            ),
        };

        let p_buttons = custom_buttons
            .iter()
            .map(|(id, text)| TASKDIALOG_BUTTON {
                nButtonID: *id,
                pszButtonText: text.as_ptr(),
            })
            .collect::<Vec<_>>();

        let task_dialog_config = TASKDIALOGCONFIG {
            cbSize: core::mem::size_of::<TASKDIALOGCONFIG>() as u32,
            hwndParent: self.parent.unwrap_or(std::ptr::null_mut()),
            dwFlags: TDF_ALLOW_DIALOG_CANCELLATION | TDF_SIZE_TO_CONTENT,
            pszWindowTitle: self.caption.as_ptr(),
            pszContent: self.text.as_ptr(),
            Anonymous1: TASKDIALOGCONFIG_0 {
                pszMainIcon: main_icon_ptr,
            },
            Anonymous2: TASKDIALOGCONFIG_1 {
                pszFooterIcon: std::ptr::null(),
            },
            dwCommonButtons: system_buttons,
            pButtons: p_buttons.as_ptr(),
            cButtons: custom_buttons.len() as u32,
            pRadioButtons: std::ptr::null(),
            cRadioButtons: 0,
            cxWidth: 0,
            hInstance: std::ptr::null_mut(),
            pfCallback: None,
            lpCallbackData: 0,
            nDefaultButton: 0,
            nDefaultRadioButton: 0,
            pszCollapsedControlText: std::ptr::null(),
            pszExpandedControlText: std::ptr::null(),
            pszExpandedInformation: std::ptr::null(),
            pszMainInstruction: std::ptr::null(),
            pszVerificationText: std::ptr::null(),
            pszFooter: std::ptr::null(),
        };

        let ret = unsafe {
            TaskDialogIndirect(
                &task_dialog_config,
                &mut pn_button as *mut i32,
                &mut pn_radio_button as *mut i32,
                &mut pf_verification_flag_checked as *mut BOOL,
            )
        };

        if ret != 0 {
            return MessageDialogResult::Cancel;
        }

        match pn_button {
            IDOK => MessageDialogResult::Ok,
            IDYES => MessageDialogResult::Yes,
            IDCANCEL => MessageDialogResult::Cancel,
            IDNO => MessageDialogResult::No,
            custom => match self.opt.buttons {
                MessageButtons::OkCustom(ok_text) => match custom {
                    ID_CUSTOM_OK => MessageDialogResult::Custom(ok_text),
                    _ => MessageDialogResult::Cancel,
                },
                MessageButtons::OkCancelCustom(ok_text, cancel_text) => match custom {
                    ID_CUSTOM_OK => MessageDialogResult::Custom(ok_text),
                    ID_CUSTOM_CANCEL => MessageDialogResult::Custom(cancel_text),
                    _ => MessageDialogResult::Cancel,
                },
                MessageButtons::YesNoCancelCustom(yes_text, no_text, cancel_text) => match custom {
                    ID_CUSTOM_YES => MessageDialogResult::Custom(yes_text),
                    ID_CUSTOM_NO => MessageDialogResult::Custom(no_text),
                    ID_CUSTOM_CANCEL => MessageDialogResult::Custom(cancel_text),
                    _ => MessageDialogResult::Cancel,
                },
                _ => MessageDialogResult::Cancel,
            },
        }
    }

    #[cfg(not(feature = "common-controls-v6"))]
    pub fn run(self) -> MessageDialogResult {
        let ret = unsafe {
            MessageBoxW(
                self.parent.unwrap_or(std::ptr::null_mut()),
                self.text.as_ptr(),
                self.caption.as_ptr(),
                self.flags,
            )
        };

        match ret {
            IDOK => MessageDialogResult::Ok,
            IDYES => MessageDialogResult::Yes,
            IDCANCEL => MessageDialogResult::Cancel,
            IDNO => MessageDialogResult::No,
            _ => MessageDialogResult::Cancel,
        }
    }

    pub fn run_async(self) -> ThreadFuture<MessageDialogResult> {
        ThreadFuture::new(move |data| *data = Some(self.run()))
    }
}

use crate::backend::MessageDialogImpl;

impl MessageDialogImpl for MessageDialog {
    fn show(self) -> MessageDialogResult {
        let dialog = WinMessageDialog::new(self);
        dialog.run()
    }
}

use crate::backend::AsyncMessageDialogImpl;
use crate::backend::DialogFutureType;

impl AsyncMessageDialogImpl for MessageDialog {
    fn show_async(self) -> DialogFutureType<MessageDialogResult> {
        let dialog = WinMessageDialog::new(self);
        Box::pin(dialog.run_async())
    }
}
