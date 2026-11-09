//! Paginated PDF output through the application's existing WKWebView.
//! `createPDF(rect)` captures a web region; AppKit's print operation is used
//! here so long documents are laid out on real A4/Letter pages instead.

use std::ffi::c_void;
use std::path::Path;
use std::sync::Arc;

use objc2::rc::Retained;
use objc2::runtime::ProtocolObject;
use objc2::{define_class, msg_send, sel, AllocAnyThread, MainThreadMarker, MainThreadOnly};
use objc2_app_kit::{
    NSPrintAllPages, NSPrintHeaderAndFooter, NSPrintInfo, NSPrintJobSavingURL, NSPrintOperation,
    NSPrintSaveJob, NSPrintSelectionOnly, NSWindow,
};
use objc2_foundation::{NSNumber, NSObject, NSObjectProtocol, NSURL};
use objc2_web_kit::WKWebView;
use tokio::sync::oneshot;

use super::{PaperSize, PdfExportError};

#[path = "macos_paper.rs"]
mod paper;

type PrintResult = Result<(), PdfExportError>;

// AppKit doesn't promise to retain the completion delegate. The context owns
// every native object until the completion selector runs, even if cancellation
// has already dropped the Rust receiver and closed the hidden export window.
struct PrintContext {
    completion: oneshot::Sender<PrintResult>,
    _delegate: Retained<PdfPrintDelegate>,
    _operation: Retained<NSPrintOperation>,
    _webview: Retained<WKWebView>,
    _window: Retained<NSWindow>,
    // Cancellation discards the result, but AppKit may still be writing. Keep
    // its temporary destination alive until the native completion callback.
    _scratch: Arc<tempfile::TempDir>,
}

define_class!(
    // SAFETY: NSObject imposes no additional subclassing requirements. All
    // instances and their callbacks stay on AppKit's main thread.
    #[unsafe(super = NSObject)]
    #[thread_kind = MainThreadOnly]
    struct PdfPrintDelegate;

    unsafe impl NSObjectProtocol for PdfPrintDelegate {}

    impl PdfPrintDelegate {
        // SAFETY: This is the completion signature specified by
        // runOperationModalForWindow:delegate:didRunSelector:contextInfo:.
        #[unsafe(method(printOperationDidRun:success:contextInfo:))]
        fn did_run(
            &self,
            _operation: &NSPrintOperation,
            success: bool,
            context: *mut c_void,
        ) {
            // SAFETY: The only caller is the one AppKit completion registered
            // below. It returns the exact Box pointer once; keeping the box
            // alive also retains self until this callback has finished.
            let context = unsafe { Box::from_raw(context.cast::<PrintContext>()) };
            let result = if success {
                Ok(())
            } else {
                Err(PdfExportError::new(
                    "native_failed",
                    "The application could not save the PDF.",
                ))
            };
            let _ = context.completion.send(result);
        }
    }
);

impl PdfPrintDelegate {
    fn new(mtm: MainThreadMarker) -> Retained<Self> {
        let this = Self::alloc(mtm).set_ivars(());
        // SAFETY: NSObject's init takes no arguments and returns this object.
        unsafe { msg_send![super(this), init] }
    }
}

pub(super) async fn print(
    window: &tauri::WebviewWindow,
    output: &Path,
    paper: PaperSize,
    landscape: bool,
    scratch: Arc<tempfile::TempDir>,
) -> PrintResult {
    let output = output.to_owned();
    let (completion, result) = oneshot::channel();
    window
        .with_webview(move |native| {
            if completion.is_closed() {
                return;
            }
            let prepared = (|| {
                let mtm = MainThreadMarker::new().ok_or_else(|| {
                    PdfExportError::new("native_failed", "PDF export must run on the main thread.")
                })?;
                if NSPrintOperation::currentOperation(mtm).is_some() {
                    return Err(PdfExportError::new(
                        "busy",
                        "Another print operation is already in progress.",
                    ));
                }
                // SAFETY: with_webview runs on the main thread and exposes
                // live WKWebView/NSWindow pointers, documented by Tauri.
                let webview = unsafe { Retained::retain(native.inner().cast::<WKWebView>()) }
                    .ok_or_else(|| {
                        PdfExportError::new(
                            "native_unavailable",
                            "The export WebView is unavailable.",
                        )
                    })?;
                let native_window =
                    unsafe { Retained::retain(native.ns_window().cast::<NSWindow>()) }.ok_or_else(
                        || {
                            PdfExportError::new(
                                "native_unavailable",
                                "The export window is unavailable.",
                            )
                        },
                    )?;
                if !webview.respondsToSelector(sel!(printOperationWithPrintInfo:)) {
                    return Err(PdfExportError::new(
                        "native_unavailable",
                        "This macOS version does not support application PDF export.",
                    ));
                }
                let destination = NSURL::from_file_path(&output).ok_or_else(|| {
                    PdfExportError::new("invalid_output", "The PDF output path is invalid.")
                })?;
                let info = NSPrintInfo::init(NSPrintInfo::alloc());
                let (width, height) = paper.inches();
                paper::configure(&info, width, height, landscape).map_err(|error| {
                    PdfExportError::new("native_failed", "Could not prepare exact PDF paper.")
                        .detail(error)
                })?;
                // SAFETY: These are AppKit's typed keys and values, and the
                // dictionary receives an NSURL for its documented saving key.
                unsafe {
                    info.setJobDisposition(NSPrintSaveJob);
                    let settings = info.dictionary();
                    settings.setObject_forKey(
                        &destination,
                        ProtocolObject::from_ref(NSPrintJobSavingURL),
                    );
                    settings.setObject_forKey(
                        &NSNumber::numberWithBool(true),
                        ProtocolObject::from_ref(NSPrintAllPages),
                    );
                    for key in [NSPrintSelectionOnly, NSPrintHeaderAndFooter] {
                        settings.setObject_forKey(
                            &NSNumber::numberWithBool(false),
                            ProtocolObject::from_ref(key),
                        );
                    }
                }
                // SAFETY: The retained WKWebView is live on the main thread,
                // its document is ready, and NSPrintInfo has valid settings.
                let operation = unsafe { webview.printOperationWithPrintInfo(&info) };
                operation.setShowsPrintPanel(false);
                operation.setShowsProgressPanel(false);
                operation.setCanSpawnSeparateThread(true);
                let delegate = PdfPrintDelegate::new(mtm);
                Ok((webview, native_window, operation, delegate))
            })();
            match prepared {
                Err(error) => {
                    let _ = completion.send(Err(error));
                }
                Ok((webview, native_window, operation, delegate)) => {
                    let context = Box::new(PrintContext {
                        completion,
                        _delegate: delegate.clone(),
                        _operation: operation.clone(),
                        _webview: webview,
                        _window: native_window.clone(),
                        _scratch: scratch,
                    });
                    // SAFETY: The selector and context have matching types.
                    // AppKit calls it once when printing finishes. The boxed
                    // context owns the delegate and operation until then.
                    // No print/save panel is shown, and SaveJob explicitly
                    // targets the supplied temporary URL, never a printer.
                    unsafe {
                        operation.runOperationModalForWindow_delegate_didRunSelector_contextInfo(
                            &native_window,
                            Some(&delegate),
                            Some(sel!(printOperationDidRun:success:contextInfo:)),
                            Box::into_raw(context).cast(),
                        );
                    }
                }
            }
        })
        .map_err(|error| {
            PdfExportError::new("native_failed", "Could not start application PDF export.")
                .detail(error)
        })?;
    result.await.map_err(|_| {
        PdfExportError::new(
            "native_failed",
            "The PDF export window closed before completion.",
        )
    })?
}
