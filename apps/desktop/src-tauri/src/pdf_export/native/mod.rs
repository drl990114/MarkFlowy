//! Native printing paints the application's already paginated physical-page DOM.
//! Each job owns a hidden WebView and a scratch directory, never the destination.
use super::{ExportJob, PaperSize, PdfExportError, EXPORT_TIMEOUT, MAX_PDF_BYTES};
use std::path::Path;
use std::sync::{Arc, Mutex};
use tauri::{webview::PageLoadEvent, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};
use tokio::sync::oneshot;

mod links;
mod outline;

#[cfg(target_os = "linux")]
mod linux;
#[cfg(target_os = "macos")]
mod macos;
#[cfg(target_os = "windows")]
mod windows;

#[cfg(target_os = "linux")]
use linux as platform;
#[cfg(target_os = "macos")]
use macos as platform;
#[cfg(target_os = "windows")]
use windows as platform;

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ReadyDocument {
    title: String,
    page_count: usize,
    headings: Vec<outline::Heading>,
    links: Vec<links::InternalLink>,
}

type ReadySender = Arc<Mutex<Option<oneshot::Sender<Result<ReadyDocument, PdfExportError>>>>>;

fn send_ready(sender: &ReadySender, result: Result<ReadyDocument, PdfExportError>) {
    if let Some(sender) = sender.lock().unwrap_or_else(|p| p.into_inner()).take() {
        let _ = sender.send(result);
    }
}

fn native_error(error: impl ToString) -> PdfExportError {
    PdfExportError::new(
        "native_failed",
        "The application could not generate the PDF.",
    )
    .detail(error)
}

fn secured_document(html: &str) -> String {
    // Install the policy before any supplied HTML is parsed. A later policy
    // cannot relax it. No document code, network access or child frames are used.
    format!(
        "<!doctype html><html><head><meta charset=\"utf-8\"><meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'\"></head><body>{html}</body></html>"
    )
}

fn readiness_script(
    token: &str,
    include_outline: bool,
    paper: PaperSize,
    landscape: bool,
) -> String {
    // Native eval runs trusted code outside document CSP. Do not wait for rAF:
    // a hidden WebView may never schedule animation frames. Layout is flushed
    // synchronously, and both fonts and image decoding are explicitly awaited.
    let ready = serde_json::to_string(&format!("{token}:ready")).unwrap();
    let metadata_key = serde_json::to_string(&format!("{token}:document")).unwrap();
    let failed = serde_json::to_string(&format!("{token}:failed")).unwrap();
    let (width, height) = paper.inches();
    let (width, height) = if landscape {
        (height * 96.0, width * 96.0)
    } else {
        (width * 96.0, height * 96.0)
    };
    let pages = format!(
        "({})({}, {}, {}, {}, {})",
        include_str!("paged_document.js"),
        include_outline,
        width,
        height,
        metadata_key,
        ready
    );
    format!(
        r#"(async () => {{
            try {{
                void document.body.offsetHeight;
                // Load embedded faces even when they are only used by print CSS.
                await Promise.all(Array.from(document.fonts, font => font.load()));
                await document.fonts.ready;
                await Promise.all(Array.from(document.images, async image => {{
                    if (!image.complete) await new Promise(resolve => {{ image.onload = resolve; image.onerror = resolve; }});
                    if (!image.naturalWidth) throw new Error('image');
                    try {{ await image.decode(); }} catch {{}}
                    if (!image.naturalWidth) throw new Error('image');
                }}));
                void document.body.offsetHeight;
                await document.fonts.ready;
                if (Array.from(document.fonts).some(font => font.status === 'error')) throw new Error('font');
                {pages};
            }} catch {{ document.title = {failed}; }}
        }})()"#
    )
}

// Keep the same total heading/page bounds as the trusted DOM collector, with
// a transport bound before parsing the callback's untrusted native string.
const MAX_READY_BYTES: usize = 8 * 1024 * 1024;
fn parse_ready_document(payload: &str) -> Result<ReadyDocument, PdfExportError> {
    if payload.len() > MAX_READY_BYTES {
        return Err(native_error("The prepared PDF metadata is too large."));
    }
    let document: ReadyDocument = serde_json::from_str(payload).map_err(native_error)?;
    if !(1..=10_000).contains(&document.page_count)
        || document.headings.len() > 10_000
        || document.title.chars().count() > 4096
    {
        return Err(native_error("The prepared PDF metadata is invalid."));
    }
    links::validate(&document.links, document.page_count)?;
    Ok(document)
}

fn printable_title(title: &str) -> String {
    let title = title.chars().take(128).collect::<String>();
    if title.is_empty() {
        "MarkFlowy PDF".into()
    } else {
        title
    }
}

struct ExportWindow(WebviewWindow);
impl Drop for ExportWindow {
    fn drop(&mut self) {
        // Bypass application close/session listeners for this ephemeral window.
        let _ = self.0.destroy();
    }
}

fn read_generated_pdf(path: &Path) -> Result<Vec<u8>, PdfExportError> {
    let size = std::fs::metadata(path).map_err(native_error)?.len();
    if size == 0 || size > MAX_PDF_BYTES as u64 {
        return Err(native_error("The generated PDF is empty or too large."));
    }
    let bytes = std::fs::read(path).map_err(native_error)?;
    super::validate_pdf(&bytes)?;
    Ok(bytes)
}

#[cfg(feature = "e2e")]
fn preserve_failed_print(
    scratch: &Path,
    expected_page_count: usize,
    paper: PaperSize,
    landscape: bool,
    include_outline: bool,
    error: &PdfExportError,
) {
    // The E2E environment validates its runner-owned root/UUID marker before
    // application startup. Never preserve document content in a user profile.
    let preserve = || -> Result<std::path::PathBuf, Box<dyn std::error::Error>> {
        let destination =
            crate::e2e::root().join(format!("native-pdf-failure-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir(&destination)?;
        for name in ["document.html", "document.pdf"] {
            let source = scratch.join(name);
            if source.is_file() {
                std::fs::copy(source, destination.join(name))?;
            }
        }
        let actual_page_count = lopdf::Document::load(scratch.join("document.pdf"))
            .ok()
            .map(|pdf| pdf.get_pages().len());
        std::fs::write(
            destination.join("diagnostic.json"),
            serde_json::to_vec_pretty(&serde_json::json!({
                "expectedPageCount": expected_page_count, "actualPageCount": actual_page_count,
                "paperSize": format!("{paper:?}"), "landscape": landscape, "includeOutline": include_outline,
                "error": error,
            }))?,
        )?;
        Ok(destination)
    };
    match preserve() {
        Ok(path) => log::warn!("E2E failed native PDF retained at {}", path.display()),
        Err(error) => log::warn!("Could not retain E2E native PDF diagnostic: {error}"),
    }
}

pub(super) async fn render(
    owner: &WebviewWindow,
    html: &str,
    paper: PaperSize,
    landscape: bool,
    include_outline: bool,
    job: &ExportJob,
) -> Result<(Vec<u8>, usize), PdfExportError> {
    let directory = Arc::new(
        tempfile::Builder::new()
            .prefix("markflowy-native-pdf-")
            .tempdir()
            .map_err(native_error)?,
    );
    let input = directory.path().join("document.html");
    let output = directory.path().join("document.pdf");
    std::fs::write(&input, secured_document(html)).map_err(native_error)?;
    let input = std::fs::canonicalize(input).map_err(native_error)?;
    let url = url::Url::from_file_path(&input)
        .map_err(|_| native_error("Invalid temporary document path."))?;
    let document_url = url.to_string();
    let token = format!("mf-native-pdf-{}", uuid::Uuid::new_v4());
    let (sender, receiver) = oneshot::channel();
    let ready_sender: ReadySender = Arc::new(Mutex::new(Some(sender)));
    let page_sender = ready_sender.clone();
    let script = readiness_script(&token, include_outline, paper, landscape);
    let expected_url = url.clone();
    let allowed_url = url.clone();
    let title_ready = format!("{token}:ready");
    let title_failed = format!("{token}:failed");
    let metadata_key = serde_json::to_string(&format!("{token}:document")).unwrap();
    let fetching_metadata = std::sync::atomic::AtomicBool::new(false);
    let restoring_title = Arc::new(Mutex::new(None::<(String, ReadyDocument)>));
    let (width, height) = paper.inches();
    let (width, height) = if landscape {
        (height, width)
    } else {
        (width, height)
    };
    let window = WebviewWindowBuilder::new(owner.app_handle(), &token, WebviewUrl::External(url))
        .title("PDF export")
        .visible(false)
        .focused(false)
        .focusable(false)
        .skip_taskbar(true)
        .decorations(false)
        .inner_size(width * 96.0, height * 96.0)
        .incognito(true)
        .disable_drag_drop_handler()
        .on_navigation(move |next| next == &allowed_url)
        .on_new_window(|_, _| tauri::webview::NewWindowResponse::Deny)
        .on_download(|_, _| false)
        .on_page_load(move |webview, payload| {
            if payload.event() == PageLoadEvent::Finished && payload.url() == &expected_url {
                if let Err(error) = webview.eval(&script) {
                    send_ready(&page_sender, Err(native_error(error)));
                }
            }
        })
        .on_document_title_changed(move |webview, title| {
            if title == title_ready {
                if fetching_metadata.swap(true, std::sync::atomic::Ordering::AcqRel) {
                    return;
                }
                let callback_sender = ready_sender.clone();
                let callback_title = restoring_title.clone();
                let callback_window = webview.clone();
                // Return an object, not JSON in document.title. Wry serializes
                // this result on WKWebView, WebView2 and WebKitGTK alike.
                let script = format!(
                    "(() => {{ const data = globalThis[{metadata_key}]; delete globalThis[{metadata_key}]; return data ?? null; }})()"
                );
                if let Err(error) = webview.eval_with_callback(script, move |payload| {
                    match parse_ready_document(&payload) {
                        Ok(document) => {
                            // Restore a short printable title and wait for its
                            // native acknowledgement. The full original title
                            // is written into the final PDF after printing.
                            let title = printable_title(&document.title);
                            let script = format!("document.title = {}", serde_json::to_string(&title).unwrap());
                            *callback_title.lock().unwrap_or_else(|p| p.into_inner()) = Some((title, document));
                            if let Err(error) = callback_window.eval(script) {
                                send_ready(&callback_sender, Err(native_error(error)));
                            }
                        }
                        Err(error) => send_ready(&callback_sender, Err(error)),
                    }
                }) {
                    send_ready(&ready_sender, Err(native_error(error)));
                }
            } else if title == title_failed {
                send_ready(
                    &ready_sender,
                    Err(native_error(
                        "The document, its resources, or heading bookmarks could not be prepared.",
                    )),
                );
            } else {
                let mut restoring = restoring_title.lock().unwrap_or_else(|p| p.into_inner());
                if restoring
                    .as_ref()
                    .is_some_and(|(expected, _)| expected == &title)
                {
                    if let Some((_, document)) = restoring.take() {
                        send_ready(&ready_sender, Ok(document));
                    }
                }
            }
        })
        .build()
        .map_err(native_error)?;
    let window = ExportWindow(window);

    let render = async {
        let document = receiver.await.map_err(native_error)??;
        #[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
        platform::print(&window.0, &output, paper, landscape, directory.clone()).await?;
        #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
        return Err(PdfExportError::new(
            "native_unavailable",
            "Native PDF export is unavailable on this platform.",
        ));
        let bytes = read_generated_pdf(&output)?;
        #[cfg(feature = "e2e")]
        let expected_page_count = document.page_count;
        let finalized = tokio::task::spawn_blocking(move || {
            outline::finish_pdf(
                &bytes,
                outline::Navigation {
                    page_count: document.page_count,
                    headings: &document.headings,
                    links: &document.links,
                    document_url: &document_url,
                },
                paper,
                landscape,
                include_outline,
                Some(&document.title),
            )
        })
        .await
        .map_err(native_error)?;
        #[cfg(feature = "e2e")]
        if let Err(error) = &finalized {
            preserve_failed_print(
                directory.path(),
                expected_page_count,
                paper,
                landscape,
                include_outline,
                error,
            );
        }
        finalized
    };
    let result = tokio::select! {
        _ = job.cancelled() => Err(PdfExportError::new("cancelled", "PDF export was cancelled.")),
        result = tokio::time::timeout(EXPORT_TIMEOUT, render) => result.unwrap_or_else(|_| Err(PdfExportError::new("timed_out", "PDF export timed out."))),
    };
    // Cancellation discards the result; some system print APIs cannot abort.
    // Their completion handlers keep a directory lease until native cleanup,
    // so closing this window never deletes files still being written.
    drop(window);
    drop(directory);
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn policy_precedes_untrusted_html_and_blocks_document_code_and_network() {
        let input = "<script>window.location='https://example.com'</script>";
        let document = secured_document(input);
        assert!(document.find("Content-Security-Policy").unwrap() < document.find(input).unwrap());
        assert!(document.contains("script-src 'none'"));
        assert!(document.contains("img-src data:"));
        assert!(document.contains("font-src data:"));
        assert!(document.contains("connect-src 'none'"));
    }

    #[test]
    fn incomplete_or_invalid_native_output_is_rejected() {
        let directory = tempfile::tempdir().unwrap();
        let output = directory.path().join("output.pdf");
        assert!(read_generated_pdf(&output).is_err());
        std::fs::write(&output, "<html>not a PDF</html>").unwrap();
        assert!(read_generated_pdf(&output).is_err());
        std::fs::write(&output, b"%PDF-1.7\nfixture\n%%EOF\n").unwrap();
        assert!(read_generated_pdf(&output).is_ok());
    }
    #[test]
    fn callback_metadata_preserves_large_payload_and_uses_only_a_short_title_ack() {
        let title = "中文📚".repeat(600);
        let headings = (0..300)
            .map(|index| {
                serde_json::json!({
                    "index": index, "title": format!("章节 {index} {}", "标题".repeat(20)),
                    "level": 2, "pageIndex": index / 30, "left": 0.1, "top": 0.2
                })
            })
            .collect::<Vec<_>>();
        let payload =
            serde_json::json!({"title":title,"pageCount":10,"headings":headings,"links":[]})
                .to_string();
        assert!(payload.len() > 1000);
        let ready = parse_ready_document(&payload).unwrap();
        assert_eq!(ready.title, title);
        assert_eq!(ready.headings.len(), 300);
        let printable = printable_title(&ready.title);
        assert_eq!(printable.chars().count(), 128);
        assert!(printable.encode_utf16().count() < 1000);
        assert_ne!(printable, ready.title);
        assert_eq!(printable_title(""), "MarkFlowy PDF");
        assert!(parse_ready_document(&payload[..999]).is_err());
        assert!(parse_ready_document("null").is_err());
        assert!(parse_ready_document(&" ".repeat(MAX_READY_BYTES + 1)).is_err());
        assert!(
            parse_ready_document(r#"{"title":"x","pageCount":0,"headings":[],"links":[]}"#)
                .is_err()
        );
    }
}
