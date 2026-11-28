use crate::{
    backend::{
        macos::utils::{FocusManager, PolicyManager},
        DialogFutureType,
    },
    message_dialog::{MessageButtons, MessageDialog, MessageDialogResult, MessageLevel},
};

use objc2::MainThreadMarker;
use objc2_core_foundation::{
    kCFUserNotificationAlternateResponse, kCFUserNotificationCancelResponse,
    kCFUserNotificationCautionAlertLevel, kCFUserNotificationDefaultResponse,
    kCFUserNotificationNoteAlertLevel, kCFUserNotificationOtherResponse,
    kCFUserNotificationStopAlertLevel, CFOptionFlags, CFRetained, CFString, CFTimeInterval,
    CFUserNotificationDisplayAlert, CFURL,
};

use std::{mem::MaybeUninit, thread};

struct UserAlert {
    timeout: CFTimeInterval,
    flags: CFOptionFlags,
    icon_url: Option<CFRetained<CFURL>>,
    sound_url: Option<CFRetained<CFURL>>,
    localization_url: Option<CFRetained<CFURL>>,
    alert_header: String,
    alert_message: String,
    default_button_title: Option<String>,
    alternate_button_title: Option<String>,
    other_button_title: Option<String>,
    buttons: MessageButtons,
    _focus_manager: Option<FocusManager>,
    _policy_manager: Option<PolicyManager>,
}

impl UserAlert {
    fn new(opt: MessageDialog, mtm: Option<MainThreadMarker>) -> Self {
        let mut buttons: [Option<String>; 3] = match &opt.buttons {
            MessageButtons::Ok => [None, None, None],
            MessageButtons::OkCancel => [None, Some("Cancel".to_string()), None],
            MessageButtons::YesNo => [Some("Yes".to_string()), Some("No".to_string()), None],
            MessageButtons::YesNoCancel => [
                Some("Yes".to_string()),
                Some("No".to_string()),
                Some("Cancel".to_string()),
            ],
            MessageButtons::OkCustom(ok_text) => [Some(ok_text.to_string()), None, None],
            MessageButtons::OkCancelCustom(ok_text, cancel_text) => [
                Some(ok_text.to_string()),
                Some(cancel_text.to_string()),
                None,
            ],
            MessageButtons::YesNoCancelCustom(yes_text, no_text, cancel_text) => [
                Some(yes_text.to_string()),
                Some(no_text.to_string()),
                Some(cancel_text.to_string()),
            ],
        };
        UserAlert {
            timeout: 0_f64,
            icon_url: None,
            sound_url: None,
            localization_url: None,
            flags: match opt.level {
                MessageLevel::Info => kCFUserNotificationNoteAlertLevel,
                MessageLevel::Warning => kCFUserNotificationCautionAlertLevel,
                MessageLevel::Error => kCFUserNotificationStopAlertLevel,
            },
            alert_header: opt.title,
            alert_message: opt.description,
            default_button_title: buttons[0].take(),
            alternate_button_title: buttons[1].take(),
            other_button_title: buttons[2].take(),
            buttons: opt.buttons,
            _policy_manager: mtm.map(PolicyManager::new),
            _focus_manager: mtm.map(FocusManager::new),
        }
    }

    fn run(self) -> MessageDialogResult {
        let alert_header = CFString::from_str(&self.alert_header[..]);
        let alert_message = CFString::from_str(&self.alert_message[..]);
        let default_button_title = self
            .default_button_title
            .map(|string| CFString::from_str(&string[..]));
        let alternate_button_title = self
            .alternate_button_title
            .map(|value| CFString::from_str(&value[..]));
        let other_button_title = self
            .other_button_title
            .map(|value| CFString::from_str(&value[..]));
        let mut response_flags = MaybeUninit::<CFOptionFlags>::uninit();
        let is_cancel = unsafe {
            CFUserNotificationDisplayAlert(
                self.timeout,
                self.flags,
                self.icon_url.as_deref(),
                self.sound_url.as_deref(),
                self.localization_url.as_deref(),
                Some(&alert_header),
                Some(&alert_message),
                default_button_title.as_deref(),
                alternate_button_title.as_deref(),
                other_button_title.as_deref(),
                response_flags.as_mut_ptr(),
            )
        };
        if is_cancel != 0 {
            return MessageDialogResult::Cancel;
        }
        let response = unsafe { response_flags.assume_init() };
        if response == kCFUserNotificationCancelResponse {
            return MessageDialogResult::Cancel;
        }
        match self.buttons {
            MessageButtons::Ok if response == kCFUserNotificationDefaultResponse => {
                MessageDialogResult::Ok
            }
            MessageButtons::OkCancel if response == kCFUserNotificationDefaultResponse => {
                MessageDialogResult::Ok
            }
            MessageButtons::OkCancel if response == kCFUserNotificationAlternateResponse => {
                MessageDialogResult::Cancel
            }
            MessageButtons::YesNo if response == kCFUserNotificationDefaultResponse => {
                MessageDialogResult::Yes
            }
            MessageButtons::YesNo if response == kCFUserNotificationAlternateResponse => {
                MessageDialogResult::No
            }
            MessageButtons::YesNoCancel if response == kCFUserNotificationDefaultResponse => {
                MessageDialogResult::Yes
            }
            MessageButtons::YesNoCancel if response == kCFUserNotificationAlternateResponse => {
                MessageDialogResult::No
            }
            MessageButtons::YesNoCancel if response == kCFUserNotificationOtherResponse => {
                MessageDialogResult::Cancel
            }
            MessageButtons::OkCustom(custom) if response == kCFUserNotificationDefaultResponse => {
                MessageDialogResult::Custom(custom.to_owned())
            }
            MessageButtons::OkCancelCustom(custom, _)
                if response == kCFUserNotificationDefaultResponse =>
            {
                MessageDialogResult::Custom(custom.to_owned())
            }
            MessageButtons::OkCancelCustom(_, custom)
                if response == kCFUserNotificationAlternateResponse =>
            {
                MessageDialogResult::Custom(custom.to_owned())
            }
            MessageButtons::YesNoCancelCustom(custom, _, _)
                if response == kCFUserNotificationDefaultResponse =>
            {
                MessageDialogResult::Custom(custom.to_owned())
            }
            MessageButtons::YesNoCancelCustom(_, custom, _)
                if response == kCFUserNotificationAlternateResponse =>
            {
                MessageDialogResult::Custom(custom.to_owned())
            }
            MessageButtons::YesNoCancelCustom(_, _, custom)
                if response == kCFUserNotificationOtherResponse =>
            {
                MessageDialogResult::Custom(custom.to_owned())
            }
            _ => MessageDialogResult::Cancel,
        }
    }
}

pub fn sync_pop_dialog(opt: MessageDialog, mtm: MainThreadMarker) -> MessageDialogResult {
    UserAlert::new(opt, Some(mtm)).run()
}

pub fn async_pop_dialog(opt: MessageDialog) -> DialogFutureType<MessageDialogResult> {
    let (tx, rx) = crate::oneshot::channel();

    thread::spawn(move || {
        let message_dialog_result = UserAlert::new(opt.clone(), None).run();
        if let Err(err) = tx.send(message_dialog_result) {
            log::error!("UserAler result send error: {err}");
        }
    });

    Box::pin(async {
        match rx.await {
            Ok(res) => res,
            Err(err) => {
                log::error!("UserAler error: {err}");
                MessageDialogResult::Cancel
            }
        }
    })
}
