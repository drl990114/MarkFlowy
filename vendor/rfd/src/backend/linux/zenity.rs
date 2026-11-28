use std::{error::Error, fmt::Display, path::PathBuf, process::Command};

use crate::{
    file_dialog::Filter,
    message_dialog::{MessageButtons, MessageLevel},
    FileDialog, MessageDialogResult,
};

#[derive(Debug)]
pub enum ZenityError {
    Io(std::io::Error),
    FromUtf8Error(std::string::FromUtf8Error),
}

impl Error for ZenityError {}

impl Display for ZenityError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ZenityError::Io(io) => write!(f, "{io}"),
            ZenityError::FromUtf8Error(err) => err.fmt(f),
        }
    }
}

impl From<std::io::Error> for ZenityError {
    fn from(value: std::io::Error) -> Self {
        Self::Io(value)
    }
}

impl From<std::string::FromUtf8Error> for ZenityError {
    fn from(value: std::string::FromUtf8Error) -> Self {
        Self::FromUtf8Error(value)
    }
}

pub type ZenityResult<T> = Result<T, ZenityError>;

fn command() -> Command {
    let mut cmd = Command::new("zenity");
    cmd.arg("--no-markup");
    cmd
}

fn add_filters(command: &mut Command, filters: &[Filter]) {
    for f in filters.iter() {
        command.arg("--file-filter");

        let extensions: Vec<_> = f
            .extensions
            .iter()
            .map(|ext| format!("*.{}", ext))
            .collect();

        command.arg(format!("{} | {}", f.name, extensions.join(" ")));
    }
}

fn add_filename(command: &mut Command, file_name: &Option<String>) {
    if let Some(name) = file_name.as_ref() {
        command.arg("--filename");
        command.arg(name);
    }
}

async fn run(command: Command) -> ZenityResult<Option<String>> {
    let res = super::async_command::AsyncCommand::spawn(command).await?;
    let buffer = String::from_utf8(res.stdout)?;

    Ok((res.status.success() || !buffer.is_empty()).then_some(buffer))
}

pub async fn pick_file(dialog: &FileDialog) -> ZenityResult<Option<PathBuf>> {
    let mut command = command();
    command.arg("--file-selection");

    add_filters(&mut command, &dialog.filters);
    add_filename(&mut command, &dialog.file_name);

    run(command).await.map(|res| {
        res.map(|buffer| {
            let trimed = buffer.trim();
            trimed.into()
        })
    })
}

pub async fn pick_files(dialog: &FileDialog) -> ZenityResult<Vec<PathBuf>> {
    let mut command = command();
    command.args(["--file-selection", "--multiple"]);

    add_filters(&mut command, &dialog.filters);
    add_filename(&mut command, &dialog.file_name);

    run(command).await.map(|res| {
        res.map(|buffer| {
            let list = buffer.trim().split('|').map(PathBuf::from).collect();
            list
        })
        .unwrap_or_default()
    })
}

pub async fn pick_folder(dialog: &FileDialog) -> ZenityResult<Option<PathBuf>> {
    let mut command = command();
    command.args(["--file-selection", "--directory"]);

    add_filters(&mut command, &dialog.filters);
    add_filename(&mut command, &dialog.file_name);

    run(command).await.map(|res| {
        res.map(|buffer| {
            let trimed = buffer.trim();
            trimed.into()
        })
    })
}

pub async fn pick_folders(dialog: &FileDialog) -> ZenityResult<Vec<PathBuf>> {
    let mut command = command();
    command.args(["--file-selection", "--directory", "--multiple"]);

    add_filters(&mut command, &dialog.filters);
    add_filename(&mut command, &dialog.file_name);

    run(command).await.map(|res| {
        res.map(|buffer| {
            let list = buffer.trim().split('|').map(PathBuf::from).collect();
            list
        })
        .unwrap_or_default()
    })
}

pub async fn save_file(dialog: &FileDialog) -> ZenityResult<Option<PathBuf>> {
    let mut command = command();
    command.args(["--file-selection", "--save", "--confirm-overwrite"]);

    add_filters(&mut command, &dialog.filters);
    add_filename(&mut command, &dialog.file_name);

    run(command).await.map(|res| {
        res.map(|buffer| {
            let trimed = buffer.trim();
            trimed.into()
        })
    })
}

pub async fn message(
    level: &MessageLevel,
    btns: &MessageButtons,
    title: &str,
    description: &str,
) -> ZenityResult<MessageDialogResult> {
    let cmd = match level {
        MessageLevel::Info => "--info",
        MessageLevel::Warning => "--warning",
        MessageLevel::Error => "--error",
    };

    let ok_label = match btns {
        MessageButtons::Ok => None,
        MessageButtons::OkCustom(ok) => Some(ok),
        _ => None,
    };

    let mut command = command();
    command.args([cmd, "--title", title, "--text", description]);

    if let Some(ok) = ok_label {
        command.args(["--ok-label", ok]);
    }

    run(command).await.map(|res| match res {
        Some(_) => MessageDialogResult::Ok,
        None => MessageDialogResult::Cancel,
    })
}

pub async fn question(
    btns: &MessageButtons,
    title: &str,
    description: &str,
) -> ZenityResult<MessageDialogResult> {
    let mut command = command();
    command.args(["--question", "--title", title, "--text", description]);

    match btns {
        MessageButtons::OkCancel => {
            command.args(["--ok-label", "Ok"]);
            command.args(["--cancel-label", "Cancel"]);
        }
        MessageButtons::OkCancelCustom(ok, cancel) => {
            command.args(["--ok-label", ok.as_str()]);
            command.args(["--cancel-label", cancel.as_str()]);
        }
        MessageButtons::YesNoCancel => {
            command.args(["--extra-button", "No"]);
            command.args(["--cancel-label", "Cancel"]);
        }
        MessageButtons::YesNoCancelCustom(yes, no, cancel) => {
            command.args(["--ok-label", yes.as_str()]);
            command.args(["--cancel-label", cancel.as_str()]);
            command.args(["--extra-button", no.as_str()]);
        }
        _ => {}
    }

    run(command).await.map(|res| match btns {
        MessageButtons::OkCancel => match res {
            Some(_) => MessageDialogResult::Ok,
            None => MessageDialogResult::Cancel,
        },
        MessageButtons::YesNo => match res {
            Some(_) => MessageDialogResult::Yes,
            None => MessageDialogResult::No,
        },
        MessageButtons::OkCancelCustom(ok, cancel) => match res {
            Some(_) => MessageDialogResult::Custom(ok.clone()),
            None => MessageDialogResult::Custom(cancel.clone()),
        },
        MessageButtons::YesNoCancel => match res {
            Some(output) if output.is_empty() => MessageDialogResult::Yes,
            Some(_) => MessageDialogResult::No,
            None => MessageDialogResult::Cancel,
        },
        MessageButtons::YesNoCancelCustom(yes, no, cancel) => match res {
            Some(output) if output.is_empty() => MessageDialogResult::Custom(yes.clone()),
            Some(_) => MessageDialogResult::Custom(no.clone()),
            None => MessageDialogResult::Custom(cancel.clone()),
        },
        _ => MessageDialogResult::Cancel,
    })
}

#[cfg(test)]
mod tests {
    use crate::FileDialog;

    #[test]
    #[ignore]
    fn message() {
        pollster::block_on(super::message(
            &crate::message_dialog::MessageLevel::Info,
            &crate::message_dialog::MessageButtons::Ok,
            "hi",
            "me",
        ))
        .unwrap();
        pollster::block_on(super::message(
            &crate::message_dialog::MessageLevel::Warning,
            &crate::message_dialog::MessageButtons::Ok,
            "hi",
            "me",
        ))
        .unwrap();
        pollster::block_on(super::message(
            &crate::message_dialog::MessageLevel::Error,
            &crate::message_dialog::MessageButtons::Ok,
            "hi",
            "me",
        ))
        .unwrap();
    }

    #[test]
    #[ignore]
    fn question() {
        pollster::block_on(super::question(
            &crate::message_dialog::MessageButtons::OkCancel,
            "hi",
            "me",
        ))
        .unwrap();
        pollster::block_on(super::question(
            &crate::message_dialog::MessageButtons::YesNo,
            "hi",
            "me",
        ))
        .unwrap();
    }

    #[test]
    #[ignore]
    fn pick_file() {
        let path = pollster::block_on(super::pick_file(&FileDialog::default())).unwrap();
        dbg!(path);
    }

    #[test]
    #[ignore]
    fn pick_files() {
        let path = pollster::block_on(super::pick_files(&FileDialog::default())).unwrap();
        dbg!(path);
    }

    #[test]
    #[ignore]
    fn pick_folder() {
        let path = pollster::block_on(super::pick_folder(&FileDialog::default())).unwrap();
        dbg!(path);
    }

    #[test]
    #[ignore]
    fn save_file() {
        let path = pollster::block_on(super::save_file(&FileDialog::default())).unwrap();
        dbg!(path);
    }
}
