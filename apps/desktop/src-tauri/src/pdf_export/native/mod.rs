//! Native printing consumes the same self-contained HTML as browser export.
//! Each job owns a hidden WebView and a scratch directory, never the destination.
use super::{ExportJob, PaperSize, PdfExportError, EXPORT_TIMEOUT, MAX_PDF_BYTES};
use std::path::Path;
use std::sync::{Arc, Mutex};
use tauri::{webview::PageLoadEvent, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};
use tokio::sync::oneshot;

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
#[serde(deny_unknown_fields)]
struct ReadyDocument {
    title: String,
    headings: Vec<outline::Heading>,
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

fn readiness_script(token: &str, include_outline: bool) -> String {
    // Native eval runs trusted code outside document CSP. Do not wait for rAF:
    // a hidden WebView may never schedule animation frames. Layout is flushed
    // synchronously, and both fonts and image decoding are explicitly awaited.
    let ready = serde_json::to_string(&format!("{token}:ready:")).unwrap();
    let failed = serde_json::to_string(&format!("{token}:failed")).unwrap();
    let headings = if include_outline {
        format!(
            "({})({})",
            include_str!("outline_document.js"),
            serde_json::to_string(token).unwrap()
        )
    } else {
        "[]".to_owned()
    };
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
                const headings = {headings};
                document.title = {ready} + JSON.stringify({{title: document.title, headings}});
            }} catch {{ document.title = {failed}; }}
        }})()"#
    )
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

pub(super) async fn render(
    owner: &WebviewWindow,
    html: &str,
    paper: PaperSize,
    landscape: bool,
    include_outline: bool,
    job: &ExportJob,
) -> Result<(Vec<u8>, usize), PdfExportError> {
    if include_outline && !cfg!(any(target_os = "macos", target_os = "windows")) {
        return Err(PdfExportError::new(
            "native_outline_unavailable",
            "This platform cannot export native PDF heading bookmarks. Use browser export instead.",
        ));
    }
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
    let token = format!("mf-native-pdf-{}", uuid::Uuid::new_v4());
    let (sender, receiver) = oneshot::channel();
    let ready_sender: ReadySender = Arc::new(Mutex::new(Some(sender)));
    let page_sender = ready_sender.clone();
    let script = readiness_script(&token, include_outline);
    let expected_url = url.clone();
    let allowed_url = url.clone();
    let title_ready = format!("{token}:ready:");
    let title_failed = format!("{token}:failed");
    let restoring_title = Mutex::new(None::<ReadyDocument>);
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
            if let Some(original) = title.strip_prefix(&title_ready) {
                match serde_json::from_str::<ReadyDocument>(original) {
                    Ok(original) => {
                        // The signal must not become the PDF metadata title. Wait
                        // for the original title's native change event before print.
                        let script = format!(
                            "document.title = {}",
                            serde_json::to_string(&original.title).unwrap()
                        );
                        *restoring_title.lock().unwrap_or_else(|p| p.into_inner()) = Some(original);
                        if let Err(error) = webview.eval(&script) {
                            send_ready(&ready_sender, Err(native_error(error)));
                        }
                    }
                    Err(error) => send_ready(&ready_sender, Err(native_error(error))),
                }
            } else if title == title_failed {
                send_ready(
                    &ready_sender,
                    Err(native_error("The document, its resources, or heading bookmarks could not be prepared.")),
                );
            } else {
                let mut restoring = restoring_title.lock().unwrap_or_else(|p| p.into_inner());
                if restoring
                    .as_ref()
                    .is_some_and(|document| document.title == title)
                {
                    if let Some(document) = restoring.take() {
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
        if include_outline {
            tokio::task::spawn_blocking(move || {
                outline::add_outline(&bytes, &token, &document.headings)
            })
            .await
            .map_err(native_error)?
        } else {
            Ok((bytes, 0))
        }
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
}
