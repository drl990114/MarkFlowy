use std::{
    error::Error,
    fmt::Display,
    path::{Path, PathBuf},
    process::Command,
};

use crate::{
    file_dialog::Filter,
    message_dialog::{MessageButtons, MessageLevel},
    FileDialog, MessageDialogResult,
};

#[derive(Debug)]
pub enum ZenityError {
    Io(std::io::Error),
    FromUtf8Error(std::string::FromUtf8Error),
    NonLocalSelection,
}

impl Error for ZenityError {}

impl Display for ZenityError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ZenityError::Io(io) => write!(f, "{io}"),
            ZenityError::FromUtf8Error(err) => err.fmt(f),
            ZenityError::NonLocalSelection => {
                f.write_str("Zenity returned a selection without an absolute local path")
            }
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

fn file_selection(dialog: &FileDialog, flags: &[&str]) -> Command {
    let mut cmd = command();
    cmd.arg("--file-selection").args(flags);
    if let Some(title) = &dialog.title {
        cmd.arg("--title").arg(title);
    }
    add_filters(&mut cmd, &dialog.filters);

    let name = dialog.file_name.as_deref();
    if let Some(dir) = &dialog.starting_directory {
        // Zenity needs an explicit absolute path to override GTK's recent-files view.
        // Joining an empty name adds the trailing slash for a directory-only hint.
        let dir = std::path::absolute(dir).unwrap_or_else(|_| dir.clone());
        let path = dir.join(name.unwrap_or(""));
        // Zenity 4 treats "/" as a bare name. "/./" explicitly selects the root.
        let hint = if path.as_os_str() == "/" {
            std::ffi::OsStr::new("/./")
        } else {
            path.as_os_str()
        };
        cmd.arg("--filename").arg(hint);
    } else if let Some(name) = name {
        cmd.arg("--filename").arg(name);
    }
    cmd
}

async fn run(command: Command) -> ZenityResult<Option<String>> {
    let res = super::async_command::AsyncCommand::spawn(command).await?;
    let buffer = String::from_utf8(res.stdout)?;

    Ok((res.status.success() || !buffer.is_empty()).then_some(buffer))
}

// GFile returns absolute paths without "." components, so this separator also
// preserves names containing pipes, newlines or other whitespace.
const SELECTION_SEPARATOR: &str = "/./";

fn strip_output_newline(output: &str) -> &str {
    output.strip_suffix('\n').unwrap_or(output)
}

fn local_path(value: &str) -> ZenityResult<PathBuf> {
    let path = Path::new(value);
    // GFile paths are absolute. Zenity can print "(null)" for a remote selection.
    if !path.is_absolute() {
        return Err(ZenityError::NonLocalSelection);
    }
    Ok(path.to_path_buf())
}

async fn pick_path(cmd: Command) -> ZenityResult<Option<PathBuf>> {
    run(cmd)
        .await?
        .as_deref()
        .map(strip_output_newline)
        .map(local_path)
        .transpose()
}

async fn pick_paths(mut cmd: Command) -> ZenityResult<Vec<PathBuf>> {
    cmd.args(["--multiple", "--separator", SELECTION_SEPARATOR]);
    let Some(output) = run(cmd).await? else {
        return Ok(Vec::new());
    };
    strip_output_newline(&output)
        .split(SELECTION_SEPARATOR)
        .map(local_path)
        .collect()
}

pub async fn pick_file(dialog: &FileDialog) -> ZenityResult<Option<PathBuf>> {
    pick_path(file_selection(dialog, &[])).await
}

pub async fn pick_files(dialog: &FileDialog) -> ZenityResult<Vec<PathBuf>> {
    pick_paths(file_selection(dialog, &[])).await
}

pub async fn pick_folder(dialog: &FileDialog) -> ZenityResult<Option<PathBuf>> {
    pick_path(file_selection(dialog, &["--directory"])).await
}

pub async fn pick_folders(dialog: &FileDialog) -> ZenityResult<Vec<PathBuf>> {
    pick_paths(file_selection(dialog, &["--directory"])).await
}

pub async fn save_file(dialog: &FileDialog) -> ZenityResult<Option<PathBuf>> {
    pick_path(file_selection(dialog, &["--save", "--confirm-overwrite"])).await
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
    use std::ffi::{OsStr, OsString};
    use std::path::{Path, PathBuf};
    use std::process::Command;

    use crate::FileDialog;

    fn zenity_reply(stdout: &str) -> Command {
        let mut cmd = Command::new("sh");
        cmd.args(["-c", r#"printf '%s' "$1""#, "zenity", stdout]);
        cmd
    }

    fn filename_hint(dialog: FileDialog) -> Option<OsString> {
        let cmd = super::file_selection(&dialog, &[]);
        let mut args = cmd.get_args();
        args.find(|arg| *arg == "--filename")?;
        args.next().map(OsStr::to_owned)
    }

    #[test]
    fn directory_hint_explicitly_selects_the_folder() {
        let dialog = FileDialog::new().set_directory("/tmp/My notes ");
        assert_eq!(
            filename_hint(dialog).as_deref(),
            Some(OsStr::new("/tmp/My notes /"))
        );
        assert_eq!(
            filename_hint(FileDialog::new().set_directory("/")).as_deref(),
            Some(OsStr::new("/./"))
        );
    }

    #[test]
    fn directory_and_suggested_name_are_combined_without_trimming() {
        let expected = std::env::current_dir().unwrap().join("notes/draft.md ");
        let dialog = FileDialog::new()
            .set_directory("notes")
            .set_file_name("draft.md ");
        assert_eq!(filename_hint(dialog).as_deref(), Some(expected.as_os_str()));
        assert_eq!(
            filename_hint(FileDialog::new().set_file_name("draft.md ")).as_deref(),
            Some(OsStr::new("draft.md "))
        );
        assert_eq!(filename_hint(FileDialog::new()), None);
    }

    #[test]
    fn file_selection_forwards_the_optional_title_as_one_argument() {
        let title = "复制到 | Export draft";
        let dialog = FileDialog::new().set_title(title);
        for flags in [
            &[][..],
            &["--directory"],
            &["--save", "--confirm-overwrite"],
        ] {
            let cmd = super::file_selection(&dialog, flags);
            let mut args = cmd.get_args();
            assert!(args.any(|arg| arg == "--title"));
            assert_eq!(args.next(), Some(OsStr::new(title)));
        }
        let untitled = super::file_selection(&FileDialog::new(), &[]);
        assert!(!untitled.get_args().any(|arg| arg == "--title"));
    }

    #[test]
    fn one_selection_keeps_all_whitespace_in_the_path() {
        for path in [
            "/tmp/normal",
            "/tmp/(null)",
            "/tmp/notes ",
            "/tmp/name\t",
            "/tmp/line\n",
            "/tmp/name\r",
        ] {
            let result = pollster::block_on(super::pick_path(zenity_reply(&format!("{path}\n"))));
            assert_eq!(result.unwrap().as_deref(), Some(Path::new(path)));
        }
        let result = pollster::block_on(super::pick_path(zenity_reply("/tmp/notes ")));
        assert_eq!(result.unwrap().as_deref(), Some(Path::new("/tmp/notes ")));
    }

    #[test]
    fn single_selection_rejects_results_without_a_local_path() {
        for output in ["(null)\n", "relative/notes.md\n", "\n"] {
            let result = pollster::block_on(super::pick_path(zenity_reply(output)));
            assert!(matches!(result, Err(super::ZenityError::NonLocalSelection)));
        }
    }

    #[test]
    fn multiple_selections_keep_pipes_newlines_and_trailing_spaces() {
        let paths = [
            "/",
            "/tmp/a|b",
            "/tmp/dir\n/file",
            "/tmp/.hidden",
            "/tmp/notes ",
        ];
        let output = paths.join(super::SELECTION_SEPARATOR) + "\n";
        let result = pollster::block_on(super::pick_paths(zenity_reply(&output)));
        assert_eq!(result.unwrap(), paths.map(PathBuf::from));
    }

    #[test]
    fn one_non_local_path_rejects_the_whole_multiple_selection() {
        for paths in [["/tmp/(null)", "(null)"], ["relative.md", "/tmp/notes "]] {
            let output = paths.join(super::SELECTION_SEPARATOR) + "\n";
            let result = pollster::block_on(super::pick_paths(zenity_reply(&output)));
            assert!(matches!(result, Err(super::ZenityError::NonLocalSelection)));
        }
    }

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
