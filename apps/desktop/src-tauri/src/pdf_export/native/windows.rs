use super::{PaperSize, PdfExportError};
use std::cell::RefCell;
use std::os::windows::ffi::OsStrExt;
use std::path::Path;
use std::rc::Rc;
use std::sync::Arc;
use tempfile::TempDir;
use tokio::sync::oneshot;
use webview2_com::Microsoft::Web::WebView2::Win32::{
    ICoreWebView2Environment6, ICoreWebView2_7, COREWEBVIEW2_PRINT_ORIENTATION_LANDSCAPE,
    COREWEBVIEW2_PRINT_ORIENTATION_PORTRAIT,
};
use webview2_com::PrintToPdfCompletedHandler;
use windows::core::{Interface, PCWSTR};

fn print_error(error: impl ToString) -> PdfExportError {
    PdfExportError::new(
        "native_failed",
        "The native WebView could not generate a PDF.",
    )
    .detail(error)
}

pub(super) async fn print(
    window: &tauri::WebviewWindow,
    output: &Path,
    paper: PaperSize,
    landscape: bool,
    scratch: Arc<TempDir>,
) -> Result<(), PdfExportError> {
    // Use the native path representation so non-ASCII Windows paths survive intact.
    let mut output: Vec<u16> = output.as_os_str().encode_wide().collect();
    if output.contains(&0) {
        return Err(print_error(
            "The PDF output path contains a null character.",
        ));
    }
    output.push(0);
    let (sender, receiver) = oneshot::channel();

    window
        .with_webview(move |raw| {
            if sender.is_closed() {
                return;
            }
            // COM objects and the completion handler stay on the WebView UI thread.
            let completion = Rc::new(RefCell::new(Some(sender)));
            let result = (|| {
                let webview = unsafe { raw.controller().CoreWebView2() }.map_err(print_error)?;
                let printable = webview.cast::<ICoreWebView2_7>().map_err(|error| {
                    PdfExportError::new(
                        "native_unavailable",
                        "This WebView2 runtime does not support PDF export.",
                    )
                    .detail(error)
                })?;
                let environment = raw
                    .environment()
                    .cast::<ICoreWebView2Environment6>()
                    .map_err(print_error)?;
                // Settings must come from this WebView's environment.
                let settings = unsafe { environment.CreatePrintSettings() }.map_err(print_error)?;
                let (width, height) = paper.inches();
                (|| -> windows::core::Result<()> {
                    unsafe {
                        settings.SetOrientation(if landscape {
                            COREWEBVIEW2_PRINT_ORIENTATION_LANDSCAPE
                        } else {
                            COREWEBVIEW2_PRINT_ORIENTATION_PORTRAIT
                        })?;
                        settings.SetPageWidth(width)?;
                        settings.SetPageHeight(height)?;
                        settings.SetScaleFactor(1.0)?;
                        settings.SetMarginTop(0.0)?;
                        settings.SetMarginBottom(0.0)?;
                        settings.SetMarginLeft(0.0)?;
                        settings.SetMarginRight(0.0)?;
                        settings.SetShouldPrintBackgrounds(true)?;
                        settings.SetShouldPrintSelectionOnly(false)?;
                        settings.SetShouldPrintHeaderAndFooter(false)
                    }
                })()
                .map_err(print_error)?;

                let callback_completion = Rc::clone(&completion);
                let callback =
                    PrintToPdfCompletedHandler::create(Box::new(move |error, success| {
                        // Dropping the waiting future does not necessarily stop
                        // native I/O. Retain its directory until this completion
                        // callback runs, or WebView2 releases the handler.
                        let _scratch = scratch;
                        let result = error.map_err(print_error).and_then(|()| {
                            if success {
                                Ok(())
                            } else {
                                Err(print_error("WebView2 reported an unsuccessful PDF export."))
                            }
                        });
                        if let Some(sender) = callback_completion.borrow_mut().take() {
                            // Cancellation destroys the export window and drops the receiver.
                            let _ = sender.send(result);
                        }
                        Ok(())
                    }));
                unsafe { printable.PrintToPdf(PCWSTR(output.as_ptr()), &settings, &callback) }
                    .map_err(print_error)
            })();

            if let Err(error) = result {
                if let Some(sender) = completion.borrow_mut().take() {
                    let _ = sender.send(Err(error));
                }
            }
        })
        .map_err(print_error)?;

    receiver
        .await
        .map_err(|_| print_error("The WebView closed before PDF export completed."))?
}
