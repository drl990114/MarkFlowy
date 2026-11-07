use super::{PaperSize, PdfExportError};
use gtk::prelude::WidgetExt;
use std::cell::RefCell;
use std::ffi::{c_char, c_int, c_void, CStr};
use std::path::Path;
use std::rc::Rc;
use std::sync::Arc;
use tempfile::TempDir;
use tokio::sync::oneshot;
use webkit2gtk::{PrintOperation, PrintOperationExt, SettingsExt, WebViewExt};

// gtk-rs does not expose GTK3's Unix printer enumeration API. These functions
// belong to the same GTK3 library used by Tauri, not an additional print engine.
#[link(name = "gtk-3")]
extern "C" {
    fn gtk_enumerate_printers(
        callback: Option<unsafe extern "C" fn(*mut c_void, *mut c_void) -> c_int>,
        data: *mut c_void,
        destroy: Option<unsafe extern "C" fn(*mut c_void)>,
        wait: c_int,
    );
    fn gtk_printer_get_backend(printer: *mut c_void) -> *mut c_void;
    fn gtk_printer_get_name(printer: *mut c_void) -> *const c_char;
}

fn print_error(error: impl ToString) -> PdfExportError {
    PdfExportError::new(
        "native_failed",
        "The native WebView could not generate a PDF.",
    )
    .detail(error)
}

// Match WebKit's own file-printer discovery. Its visible name is translated, so
// hardcoding "Print to File" can fail on non-English desktops. An explicit file
// printer is mandatory: never fall back to a physical or default printer.
// https://github.com/WebKit/WebKit/blob/main/Source/WebKit/UIProcess/API/gtk/WebKitPrintOperation.cpp
fn file_printer_name() -> Option<String> {
    unsafe extern "C" fn find_file_printer(printer: *mut c_void, data: *mut c_void) -> c_int {
        if printer.is_null() || data.is_null() {
            return 0;
        }
        let backend = gtk_printer_get_backend(printer);
        if backend.is_null() {
            return 0;
        }
        let backend_type = gtk::glib::gobject_ffi::g_type_name_from_instance(backend.cast());
        if backend_type.is_null()
            || CStr::from_ptr(backend_type).to_bytes() != b"GtkPrintBackendFile"
        {
            return 0;
        }
        let name = gtk_printer_get_name(printer);
        if name.is_null() {
            return 0;
        }
        let Ok(name) = CStr::from_ptr(name).to_str() else {
            return 0;
        };
        if name.is_empty() {
            return 0;
        }
        *(data.cast::<Option<String>>()) = Some(name.to_owned());
        1
    }

    let mut printer = None;
    // wait=TRUE keeps the stack context alive for all callbacks; returning TRUE
    // stops enumeration as soon as the file backend is found.
    unsafe {
        gtk_enumerate_printers(
            Some(find_file_printer),
            (&mut printer as *mut Option<String>).cast(),
            None,
            1,
        );
    }
    printer
}

struct PrintState {
    operation: Option<PrintOperation>,
    sender: Option<oneshot::Sender<Result<(), PdfExportError>>>,
    failure: Option<String>,
}

pub(super) async fn print(
    window: &tauri::WebviewWindow,
    output: &Path,
    paper: PaperSize,
    landscape: bool,
    scratch: Arc<TempDir>,
) -> Result<(), PdfExportError> {
    let output = url::Url::from_file_path(output)
        .map_err(|_| print_error("The PDF output path must be an absolute local file path."))?;
    let (sender, receiver) = oneshot::channel();

    window
        .with_webview(move |raw| {
            if sender.is_closed() {
                return;
            }
            let Some(printer) = file_printer_name() else {
                let _ = sender.send(Err(PdfExportError::new(
                    "native_unavailable",
                    "The GTK Print to File backend is unavailable.",
                )));
                return;
            };
            // Enumeration can run a nested GTK loop. Cancellation may have
            // closed the export window while discovering printers.
            if sender.is_closed() {
                return;
            }
            let webview = raw.inner();
            if let Some(settings) = WebViewExt::settings(&webview) {
                settings.set_print_backgrounds(true);
            }
            let orientation = if landscape {
                gtk::PageOrientation::Landscape
            } else {
                gtk::PageOrientation::Portrait
            };
            let paper = gtk::PaperSize::new(Some(match paper {
                PaperSize::A4 => "iso_a4",
                PaperSize::Letter => "na_letter",
            }));
            let page = gtk::PageSetup::new();
            page.set_paper_size(&paper);
            page.set_orientation(orientation);
            page.set_top_margin(16.0, gtk::Unit::Mm);
            page.set_bottom_margin(16.0, gtk::Unit::Mm);
            page.set_left_margin(16.0, gtk::Unit::Mm);
            page.set_right_margin(16.0, gtk::Unit::Mm);

            let settings = gtk::PrintSettings::new();
            settings.set_printer(&printer);
            settings.set("output-file-format", Some("pdf"));
            settings.set("output-uri", Some(output.as_str()));
            settings.set_paper_size(&paper);
            settings.set_orientation(orientation);
            settings.set_n_copies(1);
            settings.set_scale(100.0);
            settings.set_print_pages(gtk::PrintPages::All);

            let operation = PrintOperation::new(&webview);
            operation.set_page_setup(&page);
            operation.set_print_settings(&settings);
            let state = Rc::new(RefCell::new(PrintState {
                operation: Some(operation.clone()),
                sender: Some(sender),
                failure: None,
            }));

            let failed_state = Rc::clone(&state);
            let failed_scratch = Arc::clone(&scratch);
            operation.connect_failed(move |_, error| {
                // Keep storage owned by the native operation's handlers, not
                // the waiting future or the lifetime of its export window.
                let _scratch = &failed_scratch;
                failed_state
                    .borrow_mut()
                    .failure
                    .get_or_insert_with(|| error.to_string());
            });
            let finished_state = Rc::clone(&state);
            operation.connect_finished(move |_| {
                let _scratch = &scratch;
                // WebKit emits finished after failed, too. Send success only
                // when no failure was recorded, and complete at most once.
                let (operation, sender, failure) = {
                    let mut state = finished_state.borrow_mut();
                    (
                        state.operation.take(),
                        state.sender.take(),
                        state.failure.take(),
                    )
                };
                // Release native objects outside the borrow: their teardown can
                // emit further signals synchronously.
                drop(operation);
                if let Some(sender) = sender {
                    let result = failure.map_or(Ok(()), |e| Err(print_error(e)));
                    let _ = sender.send(result);
                }
            });
            webview.connect_destroy(move |_| {
                let (operation, sender) = {
                    let mut state = state.borrow_mut();
                    (state.operation.take(), state.sender.take())
                };
                // Release our operation reference on cancellation. WebKit keeps
                // its own reference during rendering and GtkPrintJob delivery;
                // its handlers keep scratch alive until that native work ends.
                // No GTK object crosses a thread.
                drop(operation);
                if let Some(sender) = sender {
                    let _ = sender.send(Err(print_error(
                        "The WebView closed before PDF export completed.",
                    )));
                }
            });
            operation.print();
        })
        .map_err(print_error)?;

    receiver
        .await
        .map_err(|_| print_error("The WebView closed before PDF export completed."))?
}
