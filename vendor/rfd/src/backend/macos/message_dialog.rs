use crate::backend::DialogFutureType;
use crate::message_dialog::{MessageButtons, MessageDialog, MessageDialogResult, MessageLevel};

use super::modal_future::AsModal;
use super::{
    modal_future::{InnerModal, ModalFuture},
    utils::{self, run_on_main, FocusManager, PolicyManager},
};

use super::utils::window_from_raw_window_handle;
use block2::Block;
use objc2::rc::{autoreleasepool, Retained};
use objc2::MainThreadMarker;
use objc2_app_kit::{
    NSAlert, NSAlertFirstButtonReturn, NSAlertSecondButtonReturn, NSAlertStyle,
    NSAlertThirdButtonReturn, NSApplication, NSModalResponse, NSWindow,
};
use objc2_foundation::NSString;

pub struct Alert {
    buttons: MessageButtons,
    alert: Retained<NSAlert>,
    parent: Option<Retained<NSWindow>>,
    _focus_manager: FocusManager,
    _policy_manager: PolicyManager,
}

impl Alert {
    pub fn new(opt: MessageDialog, mtm: MainThreadMarker) -> Self {
        let _policy_manager = PolicyManager::new(mtm);

        let alert = unsafe { NSAlert::new(mtm) };

        let level = match opt.level {
            MessageLevel::Info => NSAlertStyle::Informational,
            MessageLevel::Warning => NSAlertStyle::Warning,
            MessageLevel::Error => NSAlertStyle::Critical,
        };

        unsafe { alert.setAlertStyle(level) };

        let buttons = match &opt.buttons {
            MessageButtons::Ok => vec!["OK".to_owned()],
            MessageButtons::OkCancel => vec!["OK".to_owned(), "Cancel".to_owned()],
            MessageButtons::YesNo => vec!["Yes".to_owned(), "No".to_owned()],
            MessageButtons::YesNoCancel => {
                vec!["Yes".to_owned(), "No".to_owned(), "Cancel".to_owned()]
            }
            MessageButtons::OkCustom(ok_text) => vec![ok_text.to_owned()],
            MessageButtons::OkCancelCustom(ok_text, cancel_text) => {
                vec![ok_text.to_owned(), cancel_text.to_owned()]
            }
            MessageButtons::YesNoCancelCustom(yes_text, no_text, cancel_text) => {
                vec![
                    yes_text.to_owned(),
                    no_text.to_owned(),
                    cancel_text.to_owned(),
                ]
            }
        };

        for button in buttons {
            let label = NSString::from_str(&button);
            unsafe { alert.addButtonWithTitle(&label) };
        }

        unsafe {
            let text = NSString::from_str(&opt.title);
            alert.setMessageText(&text);
            let text = NSString::from_str(&opt.description);
            alert.setInformativeText(&text);
        }

        let _focus_manager = FocusManager::new(mtm);

        Self {
            alert,
            parent: opt.parent.map(|x| window_from_raw_window_handle(&x)),
            buttons: opt.buttons,
            _focus_manager,
            _policy_manager,
        }
    }

    pub fn run(mut self) -> MessageDialogResult {
        let mtm = MainThreadMarker::from(&*self.alert);

        if let Some(parent) = self.parent.take() {
            let completion = {
                block2::StackBlock::new(move |result| unsafe {
                    NSApplication::sharedApplication(mtm).stopModalWithCode(result);
                })
            };

            unsafe {
                self.alert
                    .beginSheetModalForWindow_completionHandler(&parent, Some(&completion))
            }
        }

        dialog_result(&self.buttons, unsafe { self.alert.runModal() })
    }
}

fn dialog_result(buttons: &MessageButtons, ret: NSModalResponse) -> MessageDialogResult {
    match buttons {
        MessageButtons::Ok if ret == NSAlertFirstButtonReturn => MessageDialogResult::Ok,
        MessageButtons::OkCancel if ret == NSAlertFirstButtonReturn => MessageDialogResult::Ok,
        MessageButtons::OkCancel if ret == NSAlertSecondButtonReturn => MessageDialogResult::Cancel,
        MessageButtons::YesNo if ret == NSAlertFirstButtonReturn => MessageDialogResult::Yes,
        MessageButtons::YesNo if ret == NSAlertSecondButtonReturn => MessageDialogResult::No,
        MessageButtons::YesNoCancel if ret == NSAlertFirstButtonReturn => MessageDialogResult::Yes,
        MessageButtons::YesNoCancel if ret == NSAlertSecondButtonReturn => MessageDialogResult::No,
        MessageButtons::YesNoCancel if ret == NSAlertThirdButtonReturn => {
            MessageDialogResult::Cancel
        }
        MessageButtons::OkCustom(custom) if ret == NSAlertFirstButtonReturn => {
            MessageDialogResult::Custom(custom.to_owned())
        }
        MessageButtons::OkCancelCustom(custom, _) if ret == NSAlertFirstButtonReturn => {
            MessageDialogResult::Custom(custom.to_owned())
        }
        MessageButtons::OkCancelCustom(_, custom) if ret == NSAlertSecondButtonReturn => {
            MessageDialogResult::Custom(custom.to_owned())
        }
        MessageButtons::YesNoCancelCustom(custom, _, _) if ret == NSAlertFirstButtonReturn => {
            MessageDialogResult::Custom(custom.to_owned())
        }
        MessageButtons::YesNoCancelCustom(_, custom, _) if ret == NSAlertSecondButtonReturn => {
            MessageDialogResult::Custom(custom.to_owned())
        }
        MessageButtons::YesNoCancelCustom(_, _, custom) if ret == NSAlertThirdButtonReturn => {
            MessageDialogResult::Custom(custom.to_owned())
        }
        _ => MessageDialogResult::Cancel,
    }
}

impl AsModal for Alert {
    fn inner_modal(&self) -> &(impl InnerModal + 'static) {
        &*self.alert
    }
}

impl InnerModal for NSAlert {
    fn begin_modal(&self, window: &NSWindow, handler: &Block<dyn Fn(NSModalResponse)>) {
        unsafe { self.beginSheetModalForWindow_completionHandler(window, Some(handler)) }
    }

    fn run_modal(&self) -> NSModalResponse {
        unsafe { self.runModal() }
    }
}

use crate::backend::MessageDialogImpl;
impl MessageDialogImpl for MessageDialog {
    fn show(self) -> MessageDialogResult {
        autoreleasepool(move |_| {
            run_on_main(move |mtm| {
                if self.parent.is_none() {
                    utils::sync_pop_dialog(self, mtm)
                } else {
                    Alert::new(self, mtm).run()
                }
            })
        })
    }
}

use crate::backend::AsyncMessageDialogImpl;

impl AsyncMessageDialogImpl for MessageDialog {
    fn show_async(self) -> DialogFutureType<MessageDialogResult> {
        if self.parent.is_none() {
            utils::async_pop_dialog(self)
        } else {
            Box::pin(ModalFuture::new(
                self.parent.as_ref().map(window_from_raw_window_handle),
                move |mtm| Alert::new(self, mtm),
                |dialog, ret| dialog_result(&dialog.buttons, ret),
            ))
        }
    }
}
