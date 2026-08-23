use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::time::Duration;
use tokio::io::AsyncWriteExt;
use tokio::process::Command;
use tokio::time::timeout;

const PROBE_TIMEOUT: Duration = Duration::from_secs(5);
const EXPORT_TIMEOUT: Duration = Duration::from_secs(120);
const ERROR_DETAIL_LIMIT: usize = 4_000;

#[derive(Debug, Clone, Copy, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum PandocOutputFormat {
    Docx,
    Odt,
    Epub,
}

impl PandocOutputFormat {
    fn as_str(self) -> &'static str {
        match self {
            Self::Docx => "docx",
            Self::Odt => "odt",
            Self::Epub => "epub",
        }
    }

    fn extension(self) -> &'static str {
        self.as_str()
    }

    fn supported_from(output_formats: &HashSet<String>) -> Vec<Self> {
        [Self::Docx, Self::Odt, Self::Epub]
            .into_iter()
            .filter(|format| output_formats.contains(format.as_str()))
            .collect()
    }
}

#[derive(Debug, Clone, Copy, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum PandocErrorCode {
    NotFound,
    InvalidExecutable,
    UnsupportedFormat,
    ConversionFailed,
    TimedOut,
    OutputCommitFailed,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PandocError {
    pub code: PandocErrorCode,
    pub message: String,
    pub detail: Option<String>,
    pub exit_code: Option<i32>,
}

impl PandocError {
    fn new(code: PandocErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
            detail: None,
            exit_code: None,
        }
    }

    fn with_detail(mut self, detail: impl Into<String>) -> Self {
        let detail = truncate_detail(&detail.into());
        if !detail.is_empty() {
            self.detail = Some(detail);
        }
        self
    }

    fn with_exit_code(mut self, exit_code: Option<i32>) -> Self {
        self.exit_code = exit_code;
        self
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PandocInfo {
    pub available: bool,
    pub compatible: bool,
    pub version: Option<String>,
    pub executable_path: Option<String>,
    pub supported_formats: Vec<PandocOutputFormat>,
    pub error: Option<PandocError>,
}

impl PandocInfo {
    fn unavailable(error: PandocError) -> Self {
        Self {
            available: false,
            compatible: false,
            version: None,
            executable_path: None,
            supported_formats: Vec::new(),
            error: Some(error),
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PandocExportRequest {
    pub source: String,
    pub format: PandocOutputFormat,
    pub output_path: String,
    pub executable_path: Option<String>,
    #[serde(default)]
    pub resource_paths: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PandocExportResult {
    pub output_path: String,
    pub warnings: Vec<String>,
}

fn truncate_detail(detail: &str) -> String {
    let trimmed = detail.trim();
    if trimmed.chars().count() <= ERROR_DETAIL_LIMIT {
        return trimmed.to_string();
    }

    trimmed.chars().take(ERROR_DETAIL_LIMIT).collect::<String>() + "…"
}

fn normalized_configured_path(path: Option<String>) -> Option<PathBuf> {
    path.map(|path| path.trim().to_string())
        .filter(|path| !path.is_empty())
        .map(PathBuf::from)
}

fn push_candidate(candidates: &mut Vec<PathBuf>, seen: &mut HashSet<PathBuf>, path: PathBuf) {
    if seen.insert(path.clone()) {
        candidates.push(path);
    }
}

fn path_candidates() -> Vec<PathBuf> {
    let mut candidates = Vec::new();
    let mut seen = HashSet::new();

    if let Some(path) = std::env::var_os("PATH") {
        for directory in std::env::split_paths(&path) {
            #[cfg(windows)]
            push_candidate(&mut candidates, &mut seen, directory.join("pandoc.exe"));
            #[cfg(not(windows))]
            push_candidate(&mut candidates, &mut seen, directory.join("pandoc"));
        }
    }

    #[cfg(target_os = "macos")]
    for path in [
        "/opt/homebrew/bin/pandoc",
        "/usr/local/bin/pandoc",
        "/opt/local/bin/pandoc",
        "/usr/bin/pandoc",
    ] {
        push_candidate(&mut candidates, &mut seen, PathBuf::from(path));
    }

    #[cfg(target_os = "linux")]
    for path in [
        "/usr/local/bin/pandoc",
        "/usr/bin/pandoc",
        "/snap/bin/pandoc",
    ] {
        push_candidate(&mut candidates, &mut seen, PathBuf::from(path));
    }

    #[cfg(windows)]
    {
        for variable in ["LOCALAPPDATA", "ProgramFiles", "ProgramFiles(x86)"] {
            if let Some(root) = std::env::var_os(variable) {
                push_candidate(
                    &mut candidates,
                    &mut seen,
                    PathBuf::from(root).join("Pandoc").join("pandoc.exe"),
                );
            }
        }
    }

    candidates
}

async fn run_probe_command(executable: &Path, argument: &str) -> Result<String, PandocError> {
    let output = timeout(
        PROBE_TIMEOUT,
        Command::new(executable)
            .arg(argument)
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true)
            .output(),
    )
    .await
    .map_err(|_| {
        PandocError::new(
            PandocErrorCode::InvalidExecutable,
            "Pandoc did not respond while checking the executable.",
        )
    })?
    .map_err(|error| {
        PandocError::new(
            PandocErrorCode::InvalidExecutable,
            "Failed to start the configured Pandoc executable.",
        )
        .with_detail(error.to_string())
    })?;

    if !output.status.success() {
        return Err(PandocError::new(
            PandocErrorCode::InvalidExecutable,
            "The configured executable did not pass the Pandoc compatibility check.",
        )
        .with_detail(String::from_utf8_lossy(&output.stderr))
        .with_exit_code(output.status.code()));
    }

    Ok(String::from_utf8_lossy(&output.stdout).into_owned())
}

fn parse_version(output: &str) -> Option<String> {
    let first_line = output.lines().next()?.trim();
    first_line
        .strip_prefix("pandoc ")
        .map(str::trim)
        .filter(|version| !version.is_empty())
        .map(str::to_string)
}

fn parse_format_list(output: &str) -> HashSet<String> {
    output
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(str::to_string)
        .collect()
}

async fn inspect_executable(executable: &Path) -> Result<PandocInfo, PandocError> {
    let version_output = run_probe_command(executable, "--version").await?;
    let version = parse_version(&version_output).ok_or_else(|| {
        PandocError::new(
            PandocErrorCode::InvalidExecutable,
            "The configured executable did not report a Pandoc version.",
        )
    })?;
    let input_formats =
        parse_format_list(&run_probe_command(executable, "--list-input-formats").await?);
    let output_formats =
        parse_format_list(&run_probe_command(executable, "--list-output-formats").await?);
    let supported_formats = PandocOutputFormat::supported_from(&output_formats);
    let compatible = input_formats.contains("commonmark_x") && supported_formats.len() == 3;
    let error = if compatible {
        None
    } else {
        Some(PandocError::new(
            PandocErrorCode::UnsupportedFormat,
            "This Pandoc installation does not support the required Markdown reader or export formats.",
        ))
    };

    Ok(PandocInfo {
        available: true,
        compatible,
        version: Some(version),
        executable_path: Some(executable.to_string_lossy().into_owned()),
        supported_formats,
        error,
    })
}

async fn probe(executable_path: Option<String>) -> PandocInfo {
    if let Some(configured_path) = normalized_configured_path(executable_path) {
        if !configured_path.is_file() {
            return PandocInfo::unavailable(PandocError::new(
                PandocErrorCode::InvalidExecutable,
                "The configured Pandoc executable does not exist or is not a file.",
            ));
        }

        return inspect_executable(&configured_path)
            .await
            .unwrap_or_else(PandocInfo::unavailable);
    }

    for candidate in path_candidates() {
        if !candidate.is_file() {
            continue;
        }
        if let Ok(info) = inspect_executable(&candidate).await {
            return info;
        }
    }

    PandocInfo::unavailable(PandocError::new(
        PandocErrorCode::NotFound,
        "Pandoc was not found. Install Pandoc or select its executable in Export settings.",
    ))
}

fn dedupe_existing_resource_paths(paths: &[String]) -> Vec<PathBuf> {
    let mut seen = HashSet::new();
    let mut result = Vec::new();

    for path in paths {
        let path = PathBuf::from(path);
        if path.is_dir() && seen.insert(path.clone()) {
            result.push(path);
        }
    }

    result
}

fn validate_output_path(path: &Path, format: PandocOutputFormat) -> Result<&Path, PandocError> {
    let extension_matches = path
        .extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case(format.extension()));
    if !extension_matches {
        return Err(PandocError::new(
            PandocErrorCode::OutputCommitFailed,
            format!(
                "The output file must use the .{} extension.",
                format.extension()
            ),
        ));
    }

    let parent = path
        .parent()
        .filter(|parent| parent.is_dir())
        .ok_or_else(|| {
            PandocError::new(
                PandocErrorCode::OutputCommitFailed,
                "The selected output directory does not exist.",
            )
        })?;

    Ok(parent)
}

fn append_resource_arguments(command: &mut Command, resource_paths: &[PathBuf]) {
    // Pandoc gives later --resource-path values higher priority. Add the list in
    // reverse so the document directory supplied first by Desktop wins.
    for path in resource_paths.iter().rev() {
        command.arg("--resource-path").arg(path);
    }
}

fn warnings_from_stderr(stderr: &[u8]) -> Vec<String> {
    String::from_utf8_lossy(stderr)
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .take(20)
        .map(str::to_string)
        .collect()
}

fn verify_committed_output(output_path: &Path) -> Result<(), PandocError> {
    let metadata = fs::metadata(output_path).map_err(|error| {
        PandocError::new(
            PandocErrorCode::OutputCommitFailed,
            "The exported file is missing after the final commit.",
        )
        .with_detail(format!(
            "Expected output: {}\n{}",
            output_path.display(),
            error
        ))
    })?;
    if !metadata.is_file() {
        return Err(PandocError::new(
            PandocErrorCode::OutputCommitFailed,
            "The export destination is not a file after the final commit.",
        )
        .with_detail(format!("Expected output: {}", output_path.display())));
    }
    if metadata.len() == 0 {
        return Err(PandocError::new(
            PandocErrorCode::OutputCommitFailed,
            "The exported file is empty after the final commit.",
        )
        .with_detail(format!("Expected output: {}", output_path.display())));
    }

    Ok(())
}

#[cfg(not(windows))]
fn commit_temp_output(
    temp_path: tempfile::TempPath,
    output_path: &Path,
) -> Result<(), PandocError> {
    temp_path.persist(output_path).map_err(|error| {
        PandocError::new(
            PandocErrorCode::OutputCommitFailed,
            "Failed to commit the generated export file.",
        )
        .with_detail(error.error.to_string())
    })?;
    Ok(())
}

#[cfg(windows)]
fn commit_temp_output(
    temp_path: tempfile::TempPath,
    output_path: &Path,
) -> Result<(), PandocError> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::{
        MoveFileExW, MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH,
    };

    let source = temp_path
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect::<Vec<_>>();
    let destination = output_path
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect::<Vec<_>>();
    let replaced = unsafe {
        MoveFileExW(
            source.as_ptr(),
            destination.as_ptr(),
            MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
        )
    };
    if replaced == 0 {
        return Err(PandocError::new(
            PandocErrorCode::OutputCommitFailed,
            "Failed to commit the generated export file.",
        )
        .with_detail(std::io::Error::last_os_error().to_string()));
    }

    Ok(())
}

async fn export_with_timeout(
    request: PandocExportRequest,
    export_timeout: Duration,
) -> Result<PandocExportResult, PandocError> {
    let info = probe(request.executable_path.clone()).await;
    if !info.available || !info.compatible {
        return Err(info.error.unwrap_or_else(|| {
            PandocError::new(
                PandocErrorCode::InvalidExecutable,
                "Pandoc is not available for export.",
            )
        }));
    }
    if !info.supported_formats.contains(&request.format) {
        return Err(PandocError::new(
            PandocErrorCode::UnsupportedFormat,
            format!(
                "This Pandoc installation does not support {} output.",
                request.format.as_str()
            ),
        ));
    }

    let executable = info
        .executable_path
        .as_ref()
        .map(PathBuf::from)
        .ok_or_else(|| {
            PandocError::new(
                PandocErrorCode::InvalidExecutable,
                "Pandoc executable path is unavailable.",
            )
        })?;
    let output_path = PathBuf::from(&request.output_path);
    let output_parent = validate_output_path(&output_path, request.format)?;
    let resource_paths = dedupe_existing_resource_paths(&request.resource_paths);
    let working_directory = resource_paths
        .first()
        .map(PathBuf::as_path)
        .unwrap_or(output_parent);

    let temp_file = tempfile::Builder::new()
        .prefix(".markflowy-pandoc-")
        .suffix(&format!(".{}", request.format.extension()))
        .tempfile_in(output_parent)
        .map_err(|error| {
            PandocError::new(
                PandocErrorCode::OutputCommitFailed,
                "Failed to create a temporary export file.",
            )
            .with_detail(error.to_string())
        })?;
    let temp_path = temp_file.into_temp_path();

    let mut command = Command::new(&executable);
    command
        .arg("--from=commonmark_x")
        .arg(format!("--to={}", request.format.as_str()))
        .arg("--standalone")
        .arg("--output")
        .arg(&temp_path)
        .current_dir(working_directory)
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .kill_on_drop(true);
    append_resource_arguments(&mut command, &resource_paths);

    let mut child = command.spawn().map_err(|error| {
        PandocError::new(
            PandocErrorCode::ConversionFailed,
            "Failed to start Pandoc export.",
        )
        .with_detail(error.to_string())
    })?;
    let mut stdin = child.stdin.take().ok_or_else(|| {
        PandocError::new(
            PandocErrorCode::ConversionFailed,
            "Failed to open Pandoc input.",
        )
    })?;
    let source = request.source.into_bytes();
    let writer = tokio::spawn(async move {
        stdin.write_all(&source).await?;
        stdin.shutdown().await
    });

    let output = match timeout(export_timeout, child.wait_with_output()).await {
        Ok(result) => result.map_err(|error| {
            PandocError::new(
                PandocErrorCode::ConversionFailed,
                "Failed while waiting for Pandoc export.",
            )
            .with_detail(error.to_string())
        })?,
        Err(_) => {
            writer.abort();
            return Err(PandocError::new(
                PandocErrorCode::TimedOut,
                "Pandoc export timed out after 120 seconds.",
            ));
        }
    };

    writer
        .await
        .map_err(|error| {
            PandocError::new(
                PandocErrorCode::ConversionFailed,
                "Pandoc input task failed.",
            )
            .with_detail(error.to_string())
        })?
        .map_err(|error| {
            PandocError::new(
                PandocErrorCode::ConversionFailed,
                "Failed to send Markdown to Pandoc.",
            )
            .with_detail(error.to_string())
        })?;

    if !output.status.success() {
        return Err(PandocError::new(
            PandocErrorCode::ConversionFailed,
            "Pandoc could not convert the document.",
        )
        .with_detail(String::from_utf8_lossy(&output.stderr))
        .with_exit_code(output.status.code()));
    }

    let generated_metadata = fs::metadata(&temp_path).map_err(|error| {
        PandocError::new(
            PandocErrorCode::OutputCommitFailed,
            "Pandoc did not create the expected output file.",
        )
        .with_detail(error.to_string())
    })?;
    if generated_metadata.len() == 0 {
        return Err(PandocError::new(
            PandocErrorCode::OutputCommitFailed,
            "Pandoc created an empty output file.",
        ));
    }

    fs::File::open(&temp_path)
        .and_then(|file| file.sync_all())
        .map_err(|error| {
            PandocError::new(
                PandocErrorCode::OutputCommitFailed,
                "Failed to sync the generated export file.",
            )
            .with_detail(error.to_string())
        })?;
    commit_temp_output(temp_path, &output_path)?;
    verify_committed_output(&output_path)?;

    Ok(PandocExportResult {
        output_path: output_path.to_string_lossy().into_owned(),
        warnings: warnings_from_stderr(&output.stderr),
    })
}

#[tauri::command]
pub async fn probe_pandoc(executable_path: Option<String>) -> PandocInfo {
    probe(executable_path).await
}

#[tauri::command]
pub async fn export_markdown_with_pandoc(
    request: PandocExportRequest,
) -> Result<PandocExportResult, PandocError> {
    export_with_timeout(request, EXPORT_TIMEOUT).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_version_and_formats() {
        assert_eq!(
            parse_version("pandoc 3.10.1\nFeatures: +server"),
            Some("3.10.1".into())
        );
        assert_eq!(parse_version("not-pandoc"), None);

        let formats = parse_format_list("docx\n\nodt\nepub3\n");
        assert!(formats.contains("docx"));
        assert!(formats.contains("odt"));
        assert!(!formats.contains("epub"));
    }

    #[test]
    fn validates_output_extension_and_resource_order() {
        let directory = tempfile::tempdir().unwrap();
        assert!(validate_output_path(
            &directory.path().join("report.docx"),
            PandocOutputFormat::Docx
        )
        .is_ok());
        assert_eq!(
            validate_output_path(
                &directory.path().join("report.pdf"),
                PandocOutputFormat::Docx
            )
            .unwrap_err()
            .code,
            PandocErrorCode::OutputCommitFailed
        );

        let resources = dedupe_existing_resource_paths(&[
            directory.path().to_string_lossy().into_owned(),
            directory.path().to_string_lossy().into_owned(),
            directory
                .path()
                .join("missing")
                .to_string_lossy()
                .into_owned(),
        ]);
        assert_eq!(resources, vec![directory.path().to_path_buf()]);

        let first = directory.path().join("document");
        let second = directory.path().join("workspace");
        let mut command = Command::new("pandoc");
        append_resource_arguments(&mut command, &[first.clone(), second.clone()]);
        let arguments = command
            .as_std()
            .get_args()
            .map(PathBuf::from)
            .collect::<Vec<_>>();
        assert_eq!(
            arguments,
            vec![
                PathBuf::from("--resource-path"),
                second,
                PathBuf::from("--resource-path"),
                first,
            ]
        );
    }

    #[test]
    fn rejects_non_whitelisted_output_formats() {
        assert!(serde_json::from_str::<PandocOutputFormat>("\"pdf\"").is_err());
        assert!(serde_json::from_str::<PandocOutputFormat>("\"html\"").is_err());
        assert_eq!(
            serde_json::from_str::<PandocOutputFormat>("\"epub\"").unwrap(),
            PandocOutputFormat::Epub
        );
    }

    #[test]
    fn rejects_missing_empty_and_non_file_committed_outputs() {
        let directory = tempfile::tempdir().unwrap();
        let missing = directory.path().join("missing.docx");
        let missing_error = verify_committed_output(&missing).unwrap_err();
        assert_eq!(missing_error.code, PandocErrorCode::OutputCommitFailed);
        assert!(missing_error
            .detail
            .as_deref()
            .unwrap()
            .contains("missing.docx"));

        let empty = directory.path().join("empty.docx");
        fs::write(&empty, []).unwrap();
        assert_eq!(
            verify_committed_output(&empty).unwrap_err().code,
            PandocErrorCode::OutputCommitFailed
        );

        let not_a_file = directory.path().join("folder.docx");
        fs::create_dir(&not_a_file).unwrap();
        assert_eq!(
            verify_committed_output(&not_a_file).unwrap_err().code,
            PandocErrorCode::OutputCommitFailed
        );
    }

    #[tokio::test]
    async fn configured_invalid_path_does_not_fall_back_to_auto_detection() {
        let directory = tempfile::tempdir().unwrap();
        let missing = directory.path().join("missing-pandoc");
        let info = probe(Some(missing.to_string_lossy().into_owned())).await;

        assert!(!info.available);
        assert_eq!(info.error.unwrap().code, PandocErrorCode::InvalidExecutable);
    }

    #[cfg(unix)]
    fn write_fake_pandoc(directory: &Path, conversion_body: &str) -> PathBuf {
        use std::os::unix::fs::PermissionsExt;

        let path = directory.join("pandoc");
        let script = format!(
            r#"#!/bin/sh
if [ "$1" = "--version" ]; then
  echo "pandoc 3.10.1"
  exit 0
fi
if [ "$1" = "--list-input-formats" ]; then
  echo "commonmark_x"
  exit 0
fi
if [ "$1" = "--list-output-formats" ]; then
  printf "docx\nodt\nepub\n"
  exit 0
fi
output=""
while [ "$#" -gt 0 ]; do
  if [ "$1" = "--output" ]; then
    shift
    output="$1"
  fi
  shift
done
{conversion_body}
"#
        );
        fs::write(&path, script).unwrap();
        let mut permissions = fs::metadata(&path).unwrap().permissions();
        permissions.set_mode(0o755);
        fs::set_permissions(&path, permissions).unwrap();
        path
    }

    #[cfg(unix)]
    fn request(executable: &Path, output: &Path) -> PandocExportRequest {
        PandocExportRequest {
            source: "# 标题\n\n- [x] task".into(),
            format: PandocOutputFormat::Docx,
            output_path: output.to_string_lossy().into_owned(),
            executable_path: Some(executable.to_string_lossy().into_owned()),
            resource_paths: vec![output.parent().unwrap().to_string_lossy().into_owned()],
        }
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn probes_and_exports_with_warnings() {
        let directory = tempfile::tempdir().unwrap();
        let executable = write_fake_pandoc(
            directory.path(),
            "cat > \"$output\"\necho \"[WARNING] missing image\" >&2\nexit 0",
        );
        let info = probe(Some(executable.to_string_lossy().into_owned())).await;
        assert!(info.available);
        assert!(info.compatible);
        assert_eq!(info.version.as_deref(), Some("3.10.1"));
        assert_eq!(info.supported_formats.len(), 3);

        let output = directory.path().join("report.docx");
        fs::write(&output, "previous export").unwrap();
        let mut request = request(&executable, &output);
        request.source = include_str!("../tests/fixtures/pandoc-export/fixture.md").into();
        let result = export_with_timeout(request, Duration::from_secs(1))
            .await
            .unwrap();
        assert_eq!(
            fs::read_to_string(&output).unwrap(),
            include_str!("../tests/fixtures/pandoc-export/fixture.md")
        );
        assert_eq!(result.warnings, vec!["[WARNING] missing image"]);
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn output_commit_failure_preserves_existing_target() {
        let directory = tempfile::tempdir().unwrap();
        let executable = write_fake_pandoc(directory.path(), "cat > \"$output\"\nexit 0");
        let output = directory.path().join("report.docx");
        fs::create_dir(&output).unwrap();

        let error = export_with_timeout(request(&executable, &output), Duration::from_secs(1))
            .await
            .unwrap_err();
        assert_eq!(error.code, PandocErrorCode::OutputCommitFailed);
        assert!(output.is_dir());
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn failed_export_preserves_existing_target() {
        let directory = tempfile::tempdir().unwrap();
        let executable = write_fake_pandoc(
            directory.path(),
            "echo \"conversion failed\" >&2\nprintf \"partial\" > \"$output\"\nexit 7",
        );
        let output = directory.path().join("report.docx");
        fs::write(&output, "original").unwrap();

        let error = export_with_timeout(request(&executable, &output), Duration::from_secs(1))
            .await
            .unwrap_err();
        assert_eq!(error.code, PandocErrorCode::ConversionFailed);
        assert_eq!(error.exit_code, Some(7));
        assert_eq!(fs::read_to_string(output).unwrap(), "original");
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn timed_out_export_preserves_existing_target() {
        let directory = tempfile::tempdir().unwrap();
        let executable = write_fake_pandoc(
            directory.path(),
            "sleep 1\nprintf \"late\" > \"$output\"\nexit 0",
        );
        let output = directory.path().join("report.docx");
        fs::write(&output, "original").unwrap();

        let error = export_with_timeout(request(&executable, &output), Duration::from_millis(20))
            .await
            .unwrap_err();
        assert_eq!(error.code, PandocErrorCode::TimedOut);
        assert_eq!(fs::read_to_string(output).unwrap(), "original");
    }

    #[tokio::test]
    async fn exports_fixture_with_real_pandoc_when_available() {
        let info = probe(None).await;
        if !info.compatible {
            return;
        }

        let directory = tempfile::tempdir().unwrap();
        let fixture_directory = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("tests")
            .join("fixtures")
            .join("pandoc-export");
        for format in [
            PandocOutputFormat::Docx,
            PandocOutputFormat::Odt,
            PandocOutputFormat::Epub,
        ] {
            let output = directory
                .path()
                .join(format!("中英文-export.{}", format.extension()));
            let result = export_with_timeout(
                PandocExportRequest {
                    source: include_str!("../tests/fixtures/pandoc-export/fixture.md").into(),
                    format,
                    output_path: output.to_string_lossy().into_owned(),
                    executable_path: info.executable_path.clone(),
                    resource_paths: vec![fixture_directory.to_string_lossy().into_owned()],
                },
                Duration::from_secs(30),
            )
            .await
            .unwrap();

            assert_eq!(result.output_path, output.to_string_lossy());
            assert!(fs::metadata(output).unwrap().len() > 100);
        }
    }
}
