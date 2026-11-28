mod focus_manager;
mod policy_manager;
mod user_alert;

pub use focus_manager::FocusManager;
pub use policy_manager::PolicyManager;
pub use user_alert::{async_pop_dialog, sync_pop_dialog};

use objc2::rc::Retained;
use objc2::MainThreadMarker;
use objc2_app_kit::{NSApplication, NSView, NSWindow};
use objc2_foundation::NSThread;
use raw_window_handle::RawWindowHandle;

pub fn activate_cocoa_multithreading() {
    let thread = NSThread::new();
    unsafe { thread.start() };
}

pub fn run_on_main<R: Send, F: FnOnce(MainThreadMarker) -> R + Send>(run: F) -> R {
    if let Some(mtm) = MainThreadMarker::new() {
        run(mtm)
    } else {
        let mtm = unsafe { MainThreadMarker::new_unchecked() };
        let app = NSApplication::sharedApplication(mtm);
        if unsafe { app.isRunning() } {
            dispatch2::run_on_main(run)
        } else {
            panic!("You are running RFD in NonWindowed environment, it is impossible to spawn dialog from thread different than main in this env.");
        }
    }
}

pub fn window_from_raw_window_handle(h: &RawWindowHandle) -> Retained<NSWindow> {
    // TODO: Move this requirement up
    let _mtm = unsafe { MainThreadMarker::new_unchecked() };
    match h {
        RawWindowHandle::AppKit(h) => {
            let view = h.ns_view.as_ptr() as *mut NSView;
            let view = unsafe { Retained::retain(view).unwrap() };
            view.window().expect("NSView to be inside a NSWindow")
        }
        _ => unreachable!("unsupported window handle, expected: MacOS"),
    }
}
