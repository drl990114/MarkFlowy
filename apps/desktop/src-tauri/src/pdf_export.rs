//! Local Chromium PDF export. Preparation never replaces the selected output:
//! the caller first validates its PDF and then explicitly commits the job.
use base64::{engine::general_purpose::STANDARD, Engine};
use chromiumoxide::cdp::browser_protocol::{
    accessibility::GetFullAxTreeParams,
    dom::DescribeNodeParams,
    emulation::{SetEmulatedMediaParams, SetScriptExecutionDisabledParams},
    network::EnableParams,
    page::{PrintToPdfParams, SetDocumentContentParams},
};
use chromiumoxide::cdp::js_protocol::runtime::EvaluateParams;
// This stable command also supports older Chromium versions with PDF outlines.
#[allow(deprecated)]
use chromiumoxide::cdp::browser_protocol::network::EmulateNetworkConditionsParams;
use chromiumoxide::{Browser, BrowserConfig};
use futures::{StreamExt, TryStreamExt};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{Duration, Instant};
use tempfile::TempPath;
use tokio::sync::Notify;
use tokio::time::timeout;

const EXPORT_TIMEOUT: Duration = Duration::from_secs(120);
const PROBE_TIMEOUT: Duration = Duration::from_secs(30);
const JOB_TTL: Duration = Duration::from_secs(300);
const MAX_HTML_BYTES: usize = 32 * 1024 * 1024;
const MAX_PDF_BYTES: usize = 100 * 1024 * 1024;
const PROBE_HTML: &str = "<!doctype html><html><head><meta charset='utf-8'><style>@page{margin:16mm} .next-page{break-before:page}</style></head><body><h1>MarkFlowy PDF probe</h1><h2>Nested heading</h2><p>Page one.</p><h1 class='next-page'>Next page</h1><p>Page two.</p></body></html>";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PdfExportError {
    code: &'static str,
    message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    detail: Option<String>,
}

impl PdfExportError {
    fn new(code: &'static str, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
            detail: None,
        }
    }
    fn detail(mut self, detail: impl ToString) -> Self {
        self.detail = Some(detail.to_string().chars().take(4_000).collect());
        self
    }
}

fn browser_error(error: impl ToString) -> PdfExportError {
    PdfExportError::new(
        "browser_failed",
        "The local browser could not generate a PDF.",
    )
    .detail(error)
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PdfBrowserInfo {
    available: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    executable_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<PdfExportError>,
    #[serde(skip_serializing_if = "Option::is_none")]
    probe_pdf_base64: Option<String>,
}

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PaperSize {
    A4,
    Letter,
}

impl PaperSize {
    fn inches(self) -> (f64, f64) {
        match self {
            Self::A4 => (210.0 / 25.4, 297.0 / 25.4),
            Self::Letter => (8.5, 11.0),
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PdfExportRequest {
    job_id: String,
    html: String,
    output_path: String,
    source_path: Option<String>,
    executable_path: String,
    paper_size: PaperSize,
    landscape: bool,
    include_outline: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreparedPdfExport {
    job_id: String,
    pdf_base64: String,
    heading_count: usize,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PdfExportResult {
    output_path: String,
}

struct PreparedOutput {
    temporary: TempPath,
    output: PathBuf,
    source: Option<PathBuf>,
}

enum JobState {
    Running,
    Prepared(PreparedOutput),
    Finished,
}

struct ExportJob {
    owner: String,
    expires_at: Instant,
    cancelled: AtomicBool,
    cancellation: Notify,
    rendered: AtomicBool,
    render_done: Notify,
    state: Mutex<JobState>,
}

impl ExportJob {
    fn new(owner: String) -> Self {
        Self {
            owner,
            expires_at: Instant::now() + JOB_TTL,
            cancelled: AtomicBool::new(false),
            cancellation: Notify::new(),
            rendered: AtomicBool::new(false),
            render_done: Notify::new(),
            state: Mutex::new(JobState::Running),
        }
    }
    async fn cancelled(&self) {
        let notified = self.cancellation.notified();
        if !self.cancelled.load(Ordering::Acquire) {
            notified.await;
        }
    }
    fn cancel(&self) {
        self.cancelled.store(true, Ordering::Release);
        self.cancellation.notify_waiters();
        *self.state.lock().unwrap_or_else(|p| p.into_inner()) = JobState::Finished;
    }
    fn finish_render(&self) {
        self.rendered.store(true, Ordering::Release);
        self.render_done.notify_waiters();
    }
    async fn wait_for_render(&self) {
        let notified = self.render_done.notified();
        if !self.rendered.load(Ordering::Acquire) {
            notified.await;
        }
    }
}

#[derive(Default)]
struct JobRegistry {
    active: HashMap<String, Arc<ExportJob>>,
    // Retain a short cancellation receipt even if IPC delivered cancel before
    // prepare. It must not block a different job from the same editor window.
    cancelled: HashMap<(String, String), Instant>,
}
impl std::ops::Deref for JobRegistry {
    type Target = HashMap<String, Arc<ExportJob>>;
    fn deref(&self) -> &Self::Target {
        &self.active
    }
}
impl std::ops::DerefMut for JobRegistry {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.active
    }
}
type Jobs = Mutex<JobRegistry>;
static JOBS: OnceLock<Jobs> = OnceLock::new();
fn jobs() -> &'static Jobs {
    JOBS.get_or_init(|| Mutex::new(JobRegistry::default()))
}

fn editor_window(label: &str) -> bool {
    // Same main-window convention used by the application quit lifecycle;
    // empty dynamic editor windows need not have an entry in WINDOW_INSTANCES.
    label == "main" || label.starts_with("main_")
}

fn require_editor_window(label: &str) -> Result<(), PdfExportError> {
    if editor_window(label) {
        Ok(())
    } else {
        Err(PdfExportError::new(
            "access_denied",
            "PDF export is only available in editor windows.",
        ))
    }
}

fn register_job(registry: &Jobs, id: &str, owner: &str) -> Result<Arc<ExportJob>, PdfExportError> {
    if id.is_empty()
        || id.len() > 128
        || !id
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || c == b'-' || c == b'_')
    {
        return Err(PdfExportError::new(
            "invalid_request",
            "Invalid PDF export job identifier.",
        ));
    }
    let mut entries = registry.lock().unwrap_or_else(|p| p.into_inner());
    entries
        .cancelled
        .retain(|_, expiry| *expiry > Instant::now());
    if entries.cancelled.contains_key(&(owner.into(), id.into())) {
        return Err(PdfExportError::new(
            "cancelled",
            "PDF export was cancelled.",
        ));
    }
    if entries.contains_key(id) || entries.values().any(|job| job.owner == owner) {
        return Err(PdfExportError::new(
            "busy",
            "A PDF export is already pending in this window.",
        ));
    }
    let job = Arc::new(ExportJob::new(owner.into()));
    entries.insert(id.into(), job.clone());
    Ok(job)
}

fn remove_job(registry: &Jobs, id: &str, job: &Arc<ExportJob>) {
    let mut entries = registry.lock().unwrap_or_else(|p| p.into_inner());
    if entries
        .get(id)
        .is_some_and(|current| Arc::ptr_eq(current, job))
    {
        entries.remove(id);
    }
}

fn expire_job(registry: &Jobs, id: &str, job: &Arc<ExportJob>) {
    let mut entries = registry.lock().unwrap_or_else(|p| p.into_inner());
    if entries
        .get(id)
        .is_some_and(|current| Arc::ptr_eq(current, job))
    {
        entries.remove(id);
        job.cancel();
    }
}

struct PreparationGuard {
    id: String,
    job: Arc<ExportJob>,
    prepared: bool,
}
impl Drop for PreparationGuard {
    fn drop(&mut self) {
        self.job.finish_render();
        if !self.prepared {
            remove_job(jobs(), &self.id, &self.job);
            self.job.cancel();
        }
    }
}

fn normalize_executable(path: &Path) -> Result<PathBuf, PdfExportError> {
    let mut candidate = path.to_path_buf();
    #[cfg(target_os = "macos")]
    if candidate
        .extension()
        .is_some_and(|extension| extension.eq_ignore_ascii_case("app"))
    {
        let bundle_name = candidate.file_stem().and_then(|s| s.to_str()).unwrap_or("");
        let binary = match bundle_name {
            "Google Chrome"
            | "Google Chrome Beta"
            | "Google Chrome Canary"
            | "Microsoft Edge"
            | "Microsoft Edge Beta"
            | "Microsoft Edge Dev"
            | "Microsoft Edge Canary"
            | "Chromium" => bundle_name,
            _ => {
                return Err(PdfExportError::new(
                    "invalid_executable",
                    "Select a Chrome, Edge or Chromium application.",
                ))
            }
        };
        candidate = candidate.join("Contents/MacOS").join(binary);
    }
    let candidate = fs::canonicalize(&candidate).map_err(|e| {
        PdfExportError::new(
            "invalid_executable",
            "The selected browser executable does not exist.",
        )
        .detail(e)
    })?;
    if !candidate.is_file() {
        return Err(PdfExportError::new(
            "invalid_executable",
            "The selected browser executable is not a file.",
        ));
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if fs::metadata(&candidate)
            .map_err(browser_error)?
            .permissions()
            .mode()
            & 0o111
            == 0
        {
            return Err(PdfExportError::new(
                "invalid_executable",
                "The selected browser file is not executable.",
            ));
        }
    }
    Ok(candidate)
}

fn browser_candidates() -> Vec<PathBuf> {
    let mut candidates = Vec::new();
    #[cfg(target_os = "macos")]
    for root in [
        Some(PathBuf::from("/Applications")),
        std::env::var_os("HOME").map(|home| PathBuf::from(home).join("Applications")),
    ]
    .into_iter()
    .flatten()
    {
        for name in [
            "Google Chrome",
            "Microsoft Edge",
            "Chromium",
            "Google Chrome Beta",
            "Microsoft Edge Beta",
            "Google Chrome Canary",
        ] {
            candidates.push(root.join(format!("{name}.app")));
        }
    }
    #[cfg(windows)]
    {
        use winreg::{
            enums::{
                HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE, KEY_READ, KEY_WOW64_32KEY, KEY_WOW64_64KEY,
            },
            RegKey,
        };
        for root in [HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE] {
            for flags in [KEY_READ | KEY_WOW64_64KEY, KEY_READ | KEY_WOW64_32KEY] {
                for name in ["chrome.exe", "msedge.exe", "chromium.exe"] {
                    if let Ok(key) = RegKey::predef(root).open_subkey_with_flags(
                        format!("SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\{name}"),
                        flags,
                    ) {
                        if let Ok(value) = key.get_value::<String, _>("") {
                            candidates.push(PathBuf::from(value.trim_matches('"')));
                        }
                    }
                }
            }
        }
        for variable in ["LOCALAPPDATA", "ProgramFiles", "ProgramFiles(x86)"] {
            if let Some(root) = std::env::var_os(variable) {
                for relative in [
                    "Google/Chrome/Application/chrome.exe",
                    "Microsoft/Edge/Application/msedge.exe",
                    "Chromium/Application/chrome.exe",
                ] {
                    candidates.push(PathBuf::from(&root).join(relative));
                }
            }
        }
    }
    if let Some(path) = std::env::var_os("PATH") {
        for directory in std::env::split_paths(&path) {
            #[cfg(windows)]
            for name in ["chrome.exe", "msedge.exe", "chromium.exe"] {
                candidates.push(directory.join(name));
            }
            #[cfg(not(windows))]
            for name in [
                "google-chrome",
                "google-chrome-stable",
                "chromium",
                "chromium-browser",
                "microsoft-edge",
                "microsoft-edge-stable",
            ] {
                candidates.push(directory.join(name));
            }
        }
    }
    #[cfg(target_os = "linux")]
    for path in [
        "/usr/bin/google-chrome",
        "/usr/bin/chromium",
        "/usr/bin/chromium-browser",
        "/usr/bin/microsoft-edge",
        "/snap/bin/chromium",
    ] {
        candidates.push(PathBuf::from(path));
    }
    let mut seen = HashSet::new();
    candidates
        .into_iter()
        .filter_map(|path| normalize_executable(&path).ok())
        .filter(|path| seen.insert(path.clone()))
        .collect()
}

fn exclude_browser_candidates(candidates: Vec<PathBuf>, excluded: &[String]) -> Vec<PathBuf> {
    let excluded: HashSet<_> = excluded
        .iter()
        .map(|path| normalize_executable(Path::new(path)).unwrap_or_else(|_| PathBuf::from(path)))
        .collect();
    candidates
        .into_iter()
        .filter(|path| !excluded.contains(path))
        .collect()
}

fn prepare_document_expression() -> &'static str {
    r#"(async () => {
        // Force style/font selection before observing FontFaceSet.ready.
        void document.body.offsetHeight;
        await document.fonts.ready;
        const loaded = await Promise.all(Array.from(document.images, async image => {
            if (!image.complete) await new Promise(resolve => { image.onload = resolve; image.onerror = resolve; });
            if (!image.naturalWidth) return false;
            try { await image.decode(); } catch {}
            return image.naturalWidth > 0;
        }));
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        await document.fonts.ready;
        const fontErrors = Array.from(document.fonts).filter(font => font.status === 'error').map(font => font.family);
        const isVisible = element => {
            if (!Array.from(element.getClientRects()).some(rect => rect.width > 0 && rect.height > 0)) return false;
            for (let ancestor = element; ancestor; ancestor = ancestor.parentElement) {
                if (ancestor.hasAttribute('hidden') || ancestor.hasAttribute('inert') || (ancestor.getAttribute('aria-hidden') || '').trim().toLowerCase() === 'true') return false;
                const style = getComputedStyle(ancestor);
                if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse' || Number(style.opacity) === 0 || style.contentVisibility === 'hidden') return false;
                if (ancestor.tagName === 'DETAILS' && !ancestor.open) {
                    const summary = Array.from(ancestor.children).find(child => child.tagName === 'SUMMARY');
                    if (!summary || !summary.contains(element)) return false;
                }
            }
            return true;
        };
        // Author-provided markers cannot participate in the trusted inspection.
        for (const element of document.querySelectorAll('[data-mf-pdf-heading]')) element.removeAttribute('data-mf-pdf-heading');
        for (const heading of document.querySelectorAll('h1,h2,h3,h4,h5,h6')) {
            const role = (heading.getAttribute('role') || '').trim().toLowerCase();
            if (role && role !== 'heading') continue;
            if (heading.hasAttribute('aria-level') && !/^[1-6]$/.test(heading.getAttribute('aria-level').trim())) continue;
            if (isVisible(heading)) heading.setAttribute('data-mf-pdf-heading', 'true');
        }
        return { resourcesReady: loaded.every(Boolean) && fontErrors.length === 0, fontErrors };
    })()"#
}

async fn accessible_heading_count(page: &chromiumoxide::Page) -> Result<usize, PdfExportError> {
    // Use Chromium's accessible names, the same source that its PDF outline uses.
    // innerText misses named images/SVG and includes aria-hidden decoration.
    let tree = page
        .execute(GetFullAxTreeParams::default())
        .await
        .map_err(browser_error)?;
    let headings = tree.result.nodes.into_iter().filter_map(|node| {
        if node.ignored
            || node
                .role
                .as_ref()
                .and_then(|value| value.value.as_ref())
                .and_then(serde_json::Value::as_str)
                != Some("heading")
            || !node
                .name
                .as_ref()
                .and_then(|value| value.value.as_ref())
                .and_then(serde_json::Value::as_str)
                .is_some_and(|name| !name.trim().is_empty())
        {
            return None;
        }
        node.backend_dom_node_id
    });
    // Bound parallel CDP queries instead of issuing one round trip per heading.
    futures::stream::iter(headings.map(|backend_id| async move {
        let node = page
            .execute(
                DescribeNodeParams::builder()
                    .backend_node_id(backend_id)
                    .depth(0)
                    .build(),
            )
            .await
            .map_err(browser_error)?
            .result
            .node;
        let marked = node.attributes.as_ref().is_some_and(|attributes| {
            attributes
                .chunks_exact(2)
                .any(|attribute| attribute[0] == "data-mf-pdf-heading" && attribute[1] == "true")
        });
        Ok::<usize, PdfExportError>(usize::from(marked))
    }))
    .buffer_unordered(16)
    .try_fold(0, |count, marked| async move { Ok(count + marked) })
    .await
}

fn validate_output(output: &Path, source: Option<&Path>) -> Result<PathBuf, PdfExportError> {
    let invalid = || {
        PdfExportError::new(
            "output_commit_failed",
            "Select an existing folder and a PDF file distinct from the source document.",
        )
    };
    if !output.is_absolute()
        || !output
            .extension()
            .is_some_and(|extension| extension.eq_ignore_ascii_case("pdf"))
    {
        return Err(invalid());
    }
    let parent = output.parent().ok_or_else(invalid)?;
    let parent = fs::canonicalize(parent).map_err(|e| invalid().detail(e))?;
    if !parent.is_dir() {
        return Err(invalid());
    }
    let normalized = parent.join(output.file_name().ok_or_else(invalid)?);
    if let Ok(metadata) = fs::symlink_metadata(&normalized) {
        if metadata.is_dir() {
            return Err(invalid());
        }
    }
    if let Some(source) = source {
        let source_normalized = fs::canonicalize(source).ok().or_else(|| {
            let parent = fs::canonicalize(source.parent()?).ok()?;
            Some(parent.join(source.file_name()?))
        });
        let output_resolved = fs::canonicalize(&normalized).unwrap_or_else(|_| normalized.clone());
        if source_normalized.as_ref() == Some(&output_resolved)
            || same_file::is_same_file(source, &normalized).unwrap_or(false)
        {
            return Err(invalid());
        }
    }
    Ok(normalized)
}

fn validate_pdf(bytes: &[u8]) -> Result<(), PdfExportError> {
    if bytes.len() < 16 || bytes.len() > MAX_PDF_BYTES || !bytes.starts_with(b"%PDF-") {
        return Err(PdfExportError::new(
            "browser_failed",
            "The browser returned an invalid or empty PDF.",
        ));
    }
    Ok(())
}

fn prepare_output(
    bytes: &[u8],
    output: PathBuf,
    source: Option<PathBuf>,
) -> Result<PreparedOutput, PdfExportError> {
    validate_pdf(bytes)?;
    let mut temporary = tempfile::Builder::new()
        .prefix(".markflowy-pdf-")
        .suffix(".pdf")
        .tempfile_in(output.parent().unwrap())
        .map_err(|e| {
            PdfExportError::new(
                "output_commit_failed",
                "Could not create the temporary PDF.",
            )
            .detail(e)
        })?;
    temporary
        .write_all(bytes)
        .and_then(|_| temporary.as_file().sync_all())
        .map_err(|e| {
            PdfExportError::new("output_commit_failed", "Could not write the temporary PDF.")
                .detail(e)
        })?;
    Ok(PreparedOutput {
        temporary: temporary.into_temp_path(),
        output,
        source,
    })
}

fn commit_output(prepared: PreparedOutput) -> Result<PdfExportResult, PdfExportError> {
    let output = validate_output(&prepared.output, prepared.source.as_deref())?;
    if output != prepared.output {
        return Err(PdfExportError::new(
            "output_commit_failed",
            "The output folder changed while exporting.",
        ));
    }
    let bytes = fs::read(&prepared.temporary).map_err(|e| {
        PdfExportError::new("output_commit_failed", "The temporary PDF is unavailable.").detail(e)
    })?;
    validate_pdf(&bytes)?;
    persist_output(prepared.temporary, &output)?;
    let actual = fs::read(&output).map_err(|e| {
        PdfExportError::new("output_commit_failed", "The saved PDF is unavailable.").detail(e)
    })?;
    if actual != bytes {
        return Err(PdfExportError::new(
            "output_commit_failed",
            "The saved PDF does not match the generated PDF.",
        ));
    }
    Ok(PdfExportResult {
        output_path: output.to_string_lossy().into_owned(),
    })
}

#[cfg(not(windows))]
fn persist_output(temporary: TempPath, output: &Path) -> Result<(), PdfExportError> {
    temporary.persist(output).map_err(|e| {
        PdfExportError::new("output_commit_failed", "Could not commit the PDF.").detail(e.error)
    })?;
    Ok(())
}

#[cfg(windows)]
fn persist_output(temporary: TempPath, output: &Path) -> Result<(), PdfExportError> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::{
        MoveFileExW, MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH,
    };
    let from: Vec<_> = temporary.as_os_str().encode_wide().chain(Some(0)).collect();
    let to: Vec<_> = output.as_os_str().encode_wide().chain(Some(0)).collect();
    if unsafe {
        MoveFileExW(
            from.as_ptr(),
            to.as_ptr(),
            MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
        )
    } == 0
    {
        return Err(
            PdfExportError::new("output_commit_failed", "Could not commit the PDF.")
                .detail(std::io::Error::last_os_error()),
        );
    }
    Ok(())
}

#[allow(deprecated)]
async fn render_pdf(
    executable: &Path,
    html: &str,
    paper: PaperSize,
    landscape: bool,
    outline: bool,
    cancellation: &ExportJob,
    deadline: Duration,
) -> Result<(Vec<u8>, String, usize), PdfExportError> {
    let profile = tempfile::Builder::new()
        .prefix("markflowy-pdf-profile-")
        .tempdir()
        .map_err(browser_error)?;
    // Never call no_sandbox(), enable fetcher or reuse a user's browser profile.
    let config = BrowserConfig::builder()
        .chrome_executable(executable)
        .user_data_dir(profile.path())
        .new_headless_mode()
        .launch_timeout(Duration::from_secs(15))
        .request_timeout(Duration::from_secs(20))
        .arg("--disable-background-networking")
        .build()
        .map_err(browser_error)?;
    let (mut browser, mut handler) = tokio::select! {
        _ = cancellation.cancelled() => return Err(PdfExportError::new("cancelled", "PDF export was cancelled.")),
        result = timeout(deadline, Browser::launch(config)) => result.map_err(|_| PdfExportError::new("timed_out", "The browser did not start in time."))?.map_err(browser_error)?,
    };
    let handler_task = tokio::spawn(async move {
        while let Some(event) = handler.next().await {
            if event.is_err() {
                break;
            }
        }
    });
    let render = async {
        let version = browser.version().await.map_err(browser_error)?.product;
        let page = browser
            .new_page("about:blank")
            .await
            .map_err(browser_error)?;
        page.execute(EnableParams::default())
            .await
            .map_err(browser_error)?;
        page.execute(EmulateNetworkConditionsParams::new(true, 0.0, -1.0, -1.0))
            .await
            .map_err(browser_error)?;
        page.execute(SetScriptExecutionDisabledParams::new(true))
            .await
            .map_err(browser_error)?;
        page.execute(SetEmulatedMediaParams::builder().media("print").build())
            .await
            .map_err(browser_error)?;
        let frame = page
            .mainframe()
            .await
            .map_err(browser_error)?
            .ok_or_else(|| browser_error("Missing main frame"))?;
        // Install the restrictive policy before parsing any supplied content.
        let secured = format!("<!doctype html><html><head><meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:; script-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'\"></head><body>{html}</body></html>");
        page.execute(SetDocumentContentParams::new(frame, secured))
            .await
            .map_err(browser_error)?;
        // CSP continues to forbid all document scripts and inline handlers.
        // Enable the execution engine for our trusted CDP resource/layout wait;
        // disabling it also suppresses requestAnimationFrame callbacks.
        page.execute(SetScriptExecutionDisabledParams::new(false))
            .await
            .map_err(browser_error)?;
        let ready = page
            .execute(
                EvaluateParams::builder()
                    .expression(prepare_document_expression())
                    .await_promise(true)
                    .return_by_value(true)
                    .build()
                    .map_err(browser_error)?,
            )
            .await
            .map_err(browser_error)?;
        let preparation = ready.result.result.value.as_ref();
        if ready.result.exception_details.is_some()
            || preparation
                .and_then(|value| value.get("resourcesReady"))
                .and_then(serde_json::Value::as_bool)
                != Some(true)
        {
            return Err(browser_error(format!(
                "The static document resources did not finish loading. Font errors: {}",
                preparation
                    .and_then(|value| value.get("fontErrors"))
                    .unwrap_or(&serde_json::Value::Null)
            )));
        }
        let heading_count = accessible_heading_count(&page).await?;
        let (width, height) = paper.inches();
        let bytes = page
            .pdf(
                PrintToPdfParams::builder()
                    .paper_width(width)
                    .paper_height(height)
                    .landscape(landscape)
                    .print_background(true)
                    .display_header_footer(false)
                    .prefer_css_page_size(false)
                    .margin_top(16.0 / 25.4)
                    .margin_bottom(16.0 / 25.4)
                    .margin_left(16.0 / 25.4)
                    .margin_right(16.0 / 25.4)
                    .generate_tagged_pdf(true)
                    .generate_document_outline(outline)
                    .build(),
            )
            .await
            .map_err(browser_error)?;
        validate_pdf(&bytes)?;
        Ok((bytes, version, heading_count))
    };
    let result = tokio::select! {
        _ = cancellation.cancelled() => Err(PdfExportError::new("cancelled", "PDF export was cancelled.")),
        result = timeout(deadline, render) => result.unwrap_or_else(|_| Err(PdfExportError::new("timed_out", "PDF export timed out."))),
    };
    // Keep the handler alive until browser shutdown; kill/wait is the bounded fallback.
    let _ = timeout(Duration::from_secs(3), browser.close()).await;
    if !matches!(
        timeout(Duration::from_secs(3), browser.wait()).await,
        Ok(Ok(_))
    ) {
        let _ = timeout(Duration::from_secs(3), browser.kill()).await;
    }
    handler_task.abort();
    let _ = handler_task.await;
    result
}

#[tauri::command]
pub async fn probe_pdf_browser(
    window: tauri::WebviewWindow,
    executable_path: Option<String>,
    excluded_executables: Option<Vec<String>>,
) -> Result<PdfBrowserInfo, PdfExportError> {
    require_editor_window(window.label())?;
    let candidates = match executable_path.filter(|path| !path.trim().is_empty()) {
        Some(path) => match normalize_executable(Path::new(path.trim())) {
            Ok(path) => vec![path],
            Err(error) => {
                return Ok(PdfBrowserInfo {
                    available: false,
                    executable_path: None,
                    version: None,
                    error: Some(error),
                    probe_pdf_base64: None,
                })
            }
        },
        None => exclude_browser_candidates(
            browser_candidates(),
            &excluded_executables.unwrap_or_default(),
        ),
    };
    let mut info = PdfBrowserInfo {
        available: false,
        executable_path: None,
        version: None,
        error: Some(PdfExportError::new(
            "not_found",
            "Install Chrome, Edge or Chromium to export a PDF with an outline.",
        )),
        probe_pdf_base64: None,
    };
    for candidate in candidates {
        info.executable_path = Some(candidate.to_string_lossy().into_owned());
        let job = ExportJob::new(window.label().into());
        match render_pdf(
            &candidate,
            PROBE_HTML,
            PaperSize::A4,
            false,
            true,
            &job,
            PROBE_TIMEOUT,
        )
        .await
        {
            Ok((bytes, version, _)) => {
                return Ok(PdfBrowserInfo {
                    available: true,
                    executable_path: info.executable_path,
                    version: Some(version),
                    error: None,
                    probe_pdf_base64: Some(STANDARD.encode(bytes)),
                })
            }
            Err(error) => info.error = Some(error),
        }
    }
    Ok(info)
}

#[tauri::command]
pub async fn prepare_pdf_export(
    window: tauri::WebviewWindow,
    request: PdfExportRequest,
) -> Result<PreparedPdfExport, PdfExportError> {
    require_editor_window(window.label())?;
    if request.html.is_empty() || request.html.len() > MAX_HTML_BYTES {
        return Err(PdfExportError::new(
            "invalid_request",
            "The document is empty or too large for PDF export.",
        ));
    }
    let executable = normalize_executable(Path::new(&request.executable_path))?;
    let source = request.source_path.map(PathBuf::from);
    let output = validate_output(Path::new(&request.output_path), source.as_deref())?;
    let job = register_job(jobs(), &request.job_id, window.label())?;
    let mut guard = PreparationGuard {
        id: request.job_id.clone(),
        job: job.clone(),
        prepared: false,
    };
    let expiry_id = request.job_id.clone();
    let expiring = Arc::downgrade(&job);
    tokio::spawn(async move {
        tokio::time::sleep(JOB_TTL).await;
        if let Some(job) = expiring.upgrade() {
            expire_job(jobs(), &expiry_id, &job);
        }
    });
    let (bytes, _, heading_count) = render_pdf(
        &executable,
        &request.html,
        request.paper_size,
        request.landscape,
        request.include_outline,
        &job,
        EXPORT_TIMEOUT,
    )
    .await?;
    let prepared = prepare_output(&bytes, output, source)?;
    {
        let entries = jobs().lock().unwrap_or_else(|p| p.into_inner());
        if job.cancelled.load(Ordering::Acquire)
            || !entries
                .get(&request.job_id)
                .is_some_and(|current| Arc::ptr_eq(current, &job))
        {
            return Err(PdfExportError::new(
                "cancelled",
                "PDF export was cancelled.",
            ));
        }
        *job.state.lock().unwrap_or_else(|p| p.into_inner()) = JobState::Prepared(prepared);
        guard.prepared = true;
    }
    Ok(PreparedPdfExport {
        job_id: request.job_id,
        pdf_base64: STANDARD.encode(bytes),
        heading_count,
    })
}

fn commit_job(registry: &Jobs, id: &str, owner: &str) -> Result<PdfExportResult, PdfExportError> {
    // Serialize commit/cancel/expiry through the registry lock: after cancellation
    // returns, a late prepare or commit cannot recreate or replace an output.
    let mut entries = registry.lock().unwrap_or_else(|p| p.into_inner());
    let job = entries.get(id).ok_or_else(|| {
        PdfExportError::new("job_not_found", "The PDF export expired or was cancelled.")
    })?;
    if job.owner != owner {
        return Err(PdfExportError::new(
            "access_denied",
            "This PDF export belongs to another window.",
        ));
    }
    if Instant::now() >= job.expires_at {
        job.cancel();
        entries.remove(id);
        return Err(PdfExportError::new(
            "job_not_found",
            "The PDF export expired.",
        ));
    }
    let mut state = job.state.lock().unwrap_or_else(|p| p.into_inner());
    if !matches!(*state, JobState::Prepared(_)) {
        return Err(PdfExportError::new(
            "busy",
            "The PDF export is not ready to commit.",
        ));
    }
    let JobState::Prepared(output) = std::mem::replace(&mut *state, JobState::Finished) else {
        unreachable!()
    };
    let result = commit_output(output);
    drop(state);
    entries.remove(id);
    result
}

fn cancel_job(
    registry: &Jobs,
    id: &str,
    owner: &str,
) -> Result<Option<Arc<ExportJob>>, PdfExportError> {
    let mut entries = registry.lock().unwrap_or_else(|p| p.into_inner());
    if let Some(job) = entries.get(id) {
        if job.owner != owner {
            return Err(PdfExportError::new(
                "access_denied",
                "This PDF export belongs to another window.",
            ));
        }
    }
    entries
        .cancelled
        .insert((owner.into(), id.into()), Instant::now() + JOB_TTL);
    let job = entries.remove(id);
    if let Some(job) = &job {
        job.cancel();
    }
    Ok(job)
}

#[tauri::command]
pub async fn commit_pdf_export(
    window: tauri::WebviewWindow,
    job_id: String,
) -> Result<PdfExportResult, PdfExportError> {
    require_editor_window(window.label())?;
    commit_job(jobs(), &job_id, window.label())
}

#[tauri::command]
pub async fn cancel_pdf_export(
    window: tauri::WebviewWindow,
    job_id: String,
) -> Result<(), PdfExportError> {
    require_editor_window(window.label())?;
    // The cancel command's cleanup task also expires receipts for jobs which
    // never registered, without depending on another export being requested.
    tokio::spawn(async {
        tokio::time::sleep(JOB_TTL).await;
        jobs()
            .lock()
            .unwrap_or_else(|p| p.into_inner())
            .cancelled
            .retain(|_, expiry| *expiry > Instant::now());
    });
    if let Some(job) = cancel_job(jobs(), &job_id, window.label())? {
        let _ = timeout(Duration::from_secs(12), job.wait_for_render()).await;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    const PDF: &[u8] = b"%PDF-1.7\nvalidated PDF fixture\n%%EOF\n";
    fn registry() -> Jobs {
        Mutex::new(JobRegistry::default())
    }
    fn ready(registry: &Jobs, id: &str, output: &Path, source: Option<&Path>) -> Arc<ExportJob> {
        let job = register_job(registry, id, "main").unwrap();
        *job.state.lock().unwrap() = JobState::Prepared(
            prepare_output(
                PDF,
                validate_output(output, source).unwrap(),
                source.map(PathBuf::from),
            )
            .unwrap(),
        );
        job.finish_render();
        job
    }
    #[test]
    fn restricts_commands_to_editor_windows() {
        assert!(require_editor_window("main").is_ok());
        assert!(require_editor_window("main_123").is_ok());
        for label in ["conf", "mf-pdf-print-main-123", "untrusted"] {
            assert_eq!(
                require_editor_window(label).unwrap_err().code,
                "access_denied"
            );
        }
    }
    #[test]
    fn validates_destination_and_rejects_source_hard_links() {
        let directory = tempfile::tempdir().unwrap();
        let source = directory.path().join("source.md");
        fs::write(&source, "source").unwrap();
        let alias = directory.path().join("alias.pdf");
        fs::hard_link(&source, &alias).unwrap();
        assert!(validate_output(&alias, Some(&source)).is_err());
        assert!(validate_output(&directory.path().join("missing/output.pdf"), None).is_err());
        assert!(validate_output(&directory.path().join("output.md"), None).is_err());
        assert!(validate_output(Path::new("relative.pdf"), None).is_err());
        assert!(validate_output(&directory.path().join("output.PDF"), Some(&source)).is_ok());
    }
    #[cfg(unix)]
    #[test]
    fn rejects_source_symlink_alias() {
        use std::os::unix::fs::symlink;
        let directory = tempfile::tempdir().unwrap();
        let source = directory.path().join("source.md");
        fs::write(&source, "source").unwrap();
        let alias = directory.path().join("alias.pdf");
        symlink(&source, &alias).unwrap();
        assert!(validate_output(&alias, Some(&source)).is_err());
    }
    #[test]
    fn rejects_non_pdf_bytes_without_touching_existing_output() {
        let directory = tempfile::tempdir().unwrap();
        let output = directory.path().join("output.pdf");
        fs::write(&output, "previous").unwrap();
        assert!(prepare_output(b"not a PDF", output.clone(), None).is_err());
        assert_eq!(fs::read(output).unwrap(), b"previous");
    }
    #[test]
    fn pending_pdf_only_replaces_destination_after_commit() {
        let registry = registry();
        let directory = tempfile::tempdir().unwrap();
        let output = directory.path().join("output.pdf");
        fs::write(&output, "previous").unwrap();
        ready(&registry, "job", &output, None);
        assert_eq!(fs::read(&output).unwrap(), b"previous");
        assert_eq!(
            commit_job(&registry, "job", "main").unwrap().output_path,
            fs::canonicalize(&output).unwrap().to_string_lossy()
        );
        assert_eq!(fs::read(&output).unwrap(), PDF);
        assert!(registry.lock().unwrap().is_empty());
    }
    #[test]
    fn cancelling_pending_pdf_removes_temp_and_preserves_destination() {
        let registry = registry();
        let directory = tempfile::tempdir().unwrap();
        let output = directory.path().join("output.pdf");
        fs::write(&output, "previous").unwrap();
        let job = ready(&registry, "job", &output, None);
        let temp = match &*job.state.lock().unwrap() {
            JobState::Prepared(output) => output.temporary.to_path_buf(),
            _ => unreachable!(),
        };
        cancel_job(&registry, "job", "main").unwrap();
        assert!(!temp.exists());
        assert_eq!(fs::read(output).unwrap(), b"previous");
        assert_eq!(
            commit_job(&registry, "job", "main").unwrap_err().code,
            "job_not_found"
        );
    }
    #[test]
    fn expiry_reclaims_pending_temp_and_prevents_late_commit() {
        let registry = registry();
        let directory = tempfile::tempdir().unwrap();
        let output = directory.path().join("output.pdf");
        fs::write(&output, "previous").unwrap();
        let job = ready(&registry, "job", &output, None);
        expire_job(&registry, "job", &job);
        assert_eq!(fs::read(&output).unwrap(), b"previous");
        assert_eq!(fs::read_dir(directory.path()).unwrap().count(), 1);
        assert_eq!(
            commit_job(&registry, "job", "main").unwrap_err().code,
            "job_not_found"
        );
    }
    #[test]
    fn commit_rejects_expiry_even_before_the_cleanup_task_runs() {
        let registry = registry();
        let directory = tempfile::tempdir().unwrap();
        let output = validate_output(&directory.path().join("output.pdf"), None).unwrap();
        fs::write(&output, "previous").unwrap();
        let mut expired = ExportJob::new("main".into());
        expired.expires_at = Instant::now() - Duration::from_secs(1);
        expired.state = Mutex::new(JobState::Prepared(
            prepare_output(PDF, output.clone(), None).unwrap(),
        ));
        registry
            .lock()
            .unwrap()
            .insert("job".into(), Arc::new(expired));
        assert_eq!(
            commit_job(&registry, "job", "main").unwrap_err().code,
            "job_not_found"
        );
        assert_eq!(fs::read(&output).unwrap(), b"previous");
        assert_eq!(fs::read_dir(directory.path()).unwrap().count(), 1);
    }
    #[test]
    fn commit_and_cancel_are_serialized_without_a_late_output_write() {
        let registry = Arc::new(registry());
        let directory = tempfile::tempdir().unwrap();
        let output = directory.path().join("output.pdf");
        fs::write(&output, "previous").unwrap();
        ready(&registry, "job", &output, None);
        let barrier = Arc::new(std::sync::Barrier::new(2));
        let commit_registry = registry.clone();
        let commit_barrier = barrier.clone();
        let commit = std::thread::spawn(move || {
            commit_barrier.wait();
            commit_job(&commit_registry, "job", "main")
        });
        let cancel_registry = registry.clone();
        let cancel = std::thread::spawn(move || {
            barrier.wait();
            cancel_job(&cancel_registry, "job", "main")
                .unwrap()
                .is_some()
        });
        let committed = commit.join().unwrap();
        if cancel.join().unwrap() {
            assert!(committed.is_err());
            assert_eq!(fs::read(&output).unwrap(), b"previous");
        } else {
            assert!(committed.is_ok());
            assert_eq!(fs::read(&output).unwrap(), PDF);
        }
        assert!(registry.lock().unwrap().is_empty());
    }
    #[tokio::test]
    async fn cancellation_wakes_running_export_and_cannot_remove_successor() {
        let registry = registry();
        let old = register_job(&registry, "job", "main").unwrap();
        cancel_job(&registry, "job", "main").unwrap();
        timeout(Duration::from_millis(50), old.cancelled())
            .await
            .unwrap();
        // Reusing a cancelled identifier is allowed only after its receipt expires.
        registry.lock().unwrap().cancelled.insert(
            ("main".into(), "job".into()),
            Instant::now() - Duration::from_secs(1),
        );
        let successor = register_job(&registry, "job", "main").unwrap();
        remove_job(&registry, "job", &old);
        assert!(Arc::ptr_eq(
            registry.lock().unwrap().get("job").unwrap(),
            &successor
        ));
    }
    #[test]
    fn cancel_before_prepare_prevents_late_registration_and_allows_a_new_job() {
        let registry = registry();
        assert!(cancel_job(&registry, "late", "main").unwrap().is_none());
        assert_eq!(
            register_job(&registry, "late", "main").err().unwrap().code,
            "cancelled"
        );
        assert!(register_job(&registry, "new", "main").is_ok());
    }
    #[test]
    fn jobs_are_window_owned_and_duplicate_jobs_are_rejected() {
        let registry = registry();
        register_job(&registry, "job", "main").unwrap();
        assert_eq!(
            register_job(&registry, "another", "main")
                .err()
                .unwrap()
                .code,
            "busy"
        );
        assert_eq!(
            cancel_job(&registry, "job", "main_other")
                .err()
                .unwrap()
                .code,
            "access_denied"
        );
        assert_eq!(
            commit_job(&registry, "job", "main_other").unwrap_err().code,
            "access_denied"
        );
        assert_eq!(
            commit_job(&registry, "job", "main").unwrap_err().code,
            "busy"
        );
    }
    #[test]
    fn commit_rechecks_source_identity_and_preserves_old_file_on_failure() {
        let registry = registry();
        let directory = tempfile::tempdir().unwrap();
        let source = directory.path().join("source.md");
        fs::write(&source, "source").unwrap();
        let output = directory.path().join("output.pdf");
        ready(&registry, "job", &output, Some(&source));
        fs::hard_link(&source, &output).unwrap();
        assert!(commit_job(&registry, "job", "main").is_err());
        assert_eq!(fs::read(&output).unwrap(), b"source");
        assert_eq!(fs::read(&source).unwrap(), b"source");
        assert_eq!(fs::read_dir(directory.path()).unwrap().count(), 2);
    }
    #[test]
    fn rejects_invalid_browser_file() {
        let directory = tempfile::tempdir().unwrap();
        assert!(normalize_executable(directory.path()).is_err());
        assert!(normalize_executable(&directory.path().join("missing")).is_err());
    }
    #[test]
    fn automatic_probe_excludes_canonical_browser_paths() {
        let directory = tempfile::tempdir().unwrap();
        let chrome = directory.path().join("chrome");
        let edge = directory.path().join("edge");
        for path in [&chrome, &edge] {
            fs::write(path, "browser fixture").unwrap();
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                fs::set_permissions(path, fs::Permissions::from_mode(0o700)).unwrap();
            }
        }
        let candidates = vec![
            normalize_executable(&chrome).unwrap(),
            normalize_executable(&edge).unwrap(),
        ];
        assert_eq!(
            exclude_browser_candidates(candidates, &[chrome.to_string_lossy().into_owned()]),
            vec![normalize_executable(&edge).unwrap()]
        );
    }
    fn test_browser() -> PathBuf {
        normalize_executable(Path::new(
            &std::env::var("MARKFLOWY_PDF_TEST_BROWSER")
                .expect("Set MARKFLOWY_PDF_TEST_BROWSER to a local Chrome/Edge executable"),
        ))
        .unwrap()
    }
    #[tokio::test]
    #[ignore = "requires an explicitly selected local browser"]
    async fn prepared_heading_count_uses_final_visible_document() {
        let html = "<h1>Visible</h1><details><summary><h2 role='heading' aria-level='2'>Visible summary</h2></summary><h2>Closed detail</h2></details><section hidden><h2>Hidden</h2></section><section inert><h2>Inert</h2></section><section aria-hidden='true'><h2>Aria hidden</h2></section><h2 style='display:none'>Display none</h2><h2 style='visibility:hidden'>Visibility hidden</h2><h2 style='opacity:0'>Opacity hidden</h2><section style='content-visibility:hidden'><h2>Content visibility</h2></section><h2> </h2><h2 style='width:0;height:0;overflow:hidden'>No rectangle</h2><h2 role='button'>Button</h2><h2 aria-level='7'>Unsupported level</h2>";
        let (_, _, count) = render_pdf(
            &test_browser(),
            html,
            PaperSize::A4,
            false,
            true,
            &ExportJob::new("main".into()),
            PROBE_TIMEOUT,
        )
        .await
        .unwrap();
        assert_eq!(count, 2);
    }
    #[tokio::test]
    #[ignore = "requires an explicitly selected local browser"]
    async fn used_font_decode_failure_is_rejected_but_unused_font_is_allowed() {
        let executable = test_browser();
        let used = "<style>@font-face{font-family:BrokenFont;src:url(data:font/woff2;base64,AAAA)}</style><h1 style='font-family:BrokenFont'>Heading</h1>";
        let error = render_pdf(
            &executable,
            used,
            PaperSize::A4,
            false,
            true,
            &ExportJob::new("main".into()),
            PROBE_TIMEOUT,
        )
        .await
        .unwrap_err();
        assert_eq!(error.code, "browser_failed");
        assert!(error.detail.unwrap_or_default().contains("BrokenFont"));
        let unused = "<style>@font-face{font-family:UnusedFont;src:url(data:font/woff2;base64,AAAA)}</style><h1>Heading</h1>";
        let (_, _, count) = render_pdf(
            &executable,
            unused,
            PaperSize::A4,
            false,
            true,
            &ExportJob::new("main".into()),
            PROBE_TIMEOUT,
        )
        .await
        .unwrap();
        assert_eq!(count, 1);
    }
    #[tokio::test]
    #[ignore = "requires an explicitly selected local browser"]
    async fn named_svg_heading_is_counted_but_unnamed_svg_is_not() {
        let html = "<h1><svg xmlns='http://www.w3.org/2000/svg' role='img' aria-label='Named SVG' width='20' height='20'><rect width='20' height='20'/></svg></h1><h1><svg xmlns='http://www.w3.org/2000/svg' width='20' height='20'><rect width='20' height='20'/></svg></h1><h1><span aria-hidden='true'>Decoration</span></h1><h1><span inert>Inert decoration</span></h1>";
        let (bytes, _, count) = render_pdf(
            &test_browser(),
            html,
            PaperSize::A4,
            false,
            true,
            &ExportJob::new("main".into()),
            PROBE_TIMEOUT,
        )
        .await
        .unwrap();
        assert_eq!(count, 1);
        assert!(bytes
            .windows(b"/Title (Named SVG)".len())
            .any(|part| part == b"/Title (Named SVG)"));
    }
    #[tokio::test]
    #[ignore = "requires an explicitly selected local browser"]
    async fn renders_outline_probe_with_local_browser() {
        let executable = normalize_executable(Path::new(
            &std::env::var("MARKFLOWY_PDF_TEST_BROWSER")
                .expect("Set MARKFLOWY_PDF_TEST_BROWSER to a local Chrome/Edge executable"),
        ))
        .unwrap();
        let job = ExportJob::new("main".into());
        let html = std::env::var_os("MARKFLOWY_PDF_TEST_HTML")
            .map(|path| fs::read_to_string(path).unwrap())
            .unwrap_or_else(|| PROBE_HTML.into());
        let outline = std::env::var("MARKFLOWY_PDF_TEST_OUTLINE").as_deref() != Ok("false");
        let paper = if std::env::var("MARKFLOWY_PDF_TEST_PAPER").as_deref() == Ok("letter") {
            PaperSize::Letter
        } else {
            PaperSize::A4
        };
        let landscape = std::env::var("MARKFLOWY_PDF_TEST_LANDSCAPE").as_deref() == Ok("true");
        let (bytes, version, heading_count) = render_pdf(
            &executable,
            &html,
            paper,
            landscape,
            outline,
            &job,
            PROBE_TIMEOUT,
        )
        .await
        .unwrap();
        validate_pdf(&bytes).unwrap();
        assert!(!version.is_empty());
        if let Some(output) = std::env::var_os("MARKFLOWY_PDF_TEST_OUTPUT") {
            fs::write(output, &bytes).unwrap();
        }
        if let Some(output) = std::env::var_os("MARKFLOWY_PDF_TEST_METADATA_OUT") {
            fs::write(
                output,
                serde_json::to_vec_pretty(
                    &serde_json::json!({"headingCount": heading_count, "version": version}),
                )
                .unwrap(),
            )
            .unwrap();
        }
        println!(
            "Generated {} bytes with {} ({} visible headings)",
            bytes.len(),
            version,
            heading_count
        );
    }
}
