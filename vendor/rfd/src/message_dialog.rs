use crate::backend::AsyncMessageDialogImpl;
use crate::backend::MessageDialogImpl;
use std::fmt::{Display, Formatter};

use std::future::Future;

use raw_window_handle::{HasDisplayHandle, HasWindowHandle, RawDisplayHandle, RawWindowHandle};

/// Synchronous Message Dialog. Supported platforms:
///  * Windows
///  * macOS
///  * Linux
///  * WASM
#[derive(Default, Debug, Clone)]
pub struct MessageDialog {
    pub(crate) title: String,
    pub(crate) description: String,
    pub(crate) level: MessageLevel,
    pub(crate) buttons: MessageButtons,
    pub(crate) parent: Option<RawWindowHandle>,
    pub(crate) parent_display: Option<RawDisplayHandle>,
}

// Oh god, I don't like sending RawWindowHandle between threads but here we go anyways...
// fingers crossed
unsafe impl Send for MessageDialog {}

impl MessageDialog {
    pub fn new() -> Self {
        Default::default()
    }

    /// Set level of a dialog
    ///
    /// Depending on the system it can result in level specific icon to show up,
    /// the will inform user it message is a error, warning or just information.
    pub fn set_level(mut self, level: MessageLevel) -> Self {
        self.level = level;
        self
    }

    /// Set title of a dialog
    pub fn set_title(mut self, text: impl Into<String>) -> Self {
        self.title = text.into();
        self
    }

    /// Set description of a dialog
    ///
    /// Description is a content of a dialog
    pub fn set_description(mut self, text: impl Into<String>) -> Self {
        self.description = text.into();
        self
    }

    /// Set the set of button that will be displayed on the dialog
    ///
    /// - `Ok` dialog is a single `Ok` button
    /// - `OkCancel` dialog, will display 2 buttons: ok and cancel.
    /// - `YesNo` dialog, will display 2 buttons: yes and no.
    /// - `YesNoCancel` dialog, will display 3 buttons: yes, no, and cancel.
    pub fn set_buttons(mut self, btn: MessageButtons) -> Self {
        self.buttons = btn;
        self
    }

    /// Set parent windows explicitly (optional).
    /// Supported platforms:
    ///  * Windows
    ///  * Mac
    ///  * Linux (XDG only)
    pub fn set_parent<W: HasWindowHandle + HasDisplayHandle + ?Sized>(
        mut self,
        parent: &W,
    ) -> Self {
        self.parent = parent.window_handle().ok().map(|x| x.as_raw());
        self.parent_display = parent.display_handle().ok().map(|x| x.as_raw());
        self
    }

    /// Shows a message dialog and returns the button that was pressed.
    pub fn show(self) -> MessageDialogResult {
        MessageDialogImpl::show(self)
    }
}

/// Asynchronous Message Dialog. Supported platforms:
///  * Windows
///  * macOS
///  * Linux
///  * WASM
#[derive(Default, Debug, Clone)]
pub struct AsyncMessageDialog(MessageDialog);

impl AsyncMessageDialog {
    pub fn new() -> Self {
        Default::default()
    }

    /// Set level of a dialog
    ///
    /// Depending on the system it can result in level specific icon to show up,
    /// the will inform user it message is a error, warning or just information.
    pub fn set_level(mut self, level: MessageLevel) -> Self {
        self.0 = self.0.set_level(level);
        self
    }

    /// Set title of a dialog
    pub fn set_title(mut self, text: impl Into<String>) -> Self {
        self.0 = self.0.set_title(text);
        self
    }

    /// Set description of a dialog
    ///
    /// Description is a content of a dialog
    pub fn set_description(mut self, text: impl Into<String>) -> Self {
        self.0 = self.0.set_description(text);
        self
    }

    /// Set the set of button that will be displayed on the dialog
    ///
    /// - `Ok` dialog is a single `Ok` button
    /// - `OkCancel` dialog, will display 2 buttons ok and cancel.
    /// - `YesNo` dialog, will display 2 buttons yes and no.
    /// - `YesNoCancel` dialog, will display 3 buttons: yes, no, and cancel.
    pub fn set_buttons(mut self, btn: MessageButtons) -> Self {
        self.0 = self.0.set_buttons(btn);
        self
    }

    /// Set parent windows explicitly (optional).
    /// Supported platforms:
    ///  * Windows
    ///  * Mac
    ///  * Linux (XDG only)
    pub fn set_parent<W: HasWindowHandle + HasDisplayHandle + ?Sized>(
        mut self,
        parent: &W,
    ) -> Self {
        self.0 = self.0.set_parent(parent);
        self
    }

    /// Shows a message dialog and returns the button that was pressed.
    pub fn show(self) -> impl Future<Output = MessageDialogResult> {
        AsyncMessageDialogImpl::show_async(self.0)
    }
}

#[derive(Debug, Clone, Copy)]
pub enum MessageLevel {
    Info,
    Warning,
    Error,
}

impl Default for MessageLevel {
    fn default() -> Self {
        Self::Info
    }
}

#[derive(Debug, Clone)]
pub enum MessageButtons {
    Ok,
    OkCancel,
    YesNo,
    YesNoCancel,
    /// One customizable button.
    /// Notice that in Windows, this only works with the feature *common-controls-v6* enabled
    OkCustom(String),
    /// Two customizable buttons.
    /// Notice that in Windows, this only works with the feature *common-controls-v6* enabled
    OkCancelCustom(String, String),
    /// Three customizable buttons.
    /// Notice that in Windows, this only works with the feature *common-controls-v6* enabled
    YesNoCancelCustom(String, String, String),
}

impl Default for MessageButtons {
    fn default() -> Self {
        Self::Ok
    }
}

#[derive(Debug, Default, Clone, PartialEq, Eq)]
pub enum MessageDialogResult {
    Yes,
    No,
    Ok,
    #[default]
    Cancel,
    Custom(String),
}

impl Display for MessageDialogResult {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "{}",
            match self {
                Self::Yes => "Yes".to_string(),
                Self::No => "No".to_string(),
                Self::Ok => "Ok".to_string(),
                Self::Cancel => "Cancel".to_string(),
                Self::Custom(custom) => format!("Custom({custom})"),
            }
        )
    }
}
