//! Read-only AppKit geometry check: no application, WebView, print job or PDF.
//! A standard Rust test harness runs tests on worker threads, so this target
//! deliberately has a main function and calls the production helper directly.
#[cfg(target_os = "macos")]
#[path = "../src/pdf_export/native/macos_paper.rs"]
mod paper;

#[cfg(target_os = "macos")]
fn main() {
    use objc2::{AllocAnyThread, MainThreadMarker};
    use objc2_app_kit::{NSPrintInfo, NSPrintingPaginationMode};
    assert!(MainThreadMarker::new().is_some());
    let info = NSPrintInfo::init(NSPrintInfo::alloc());
    for (label, width, height) in [("A4", 210.0 / 25.4, 297.0 / 25.4), ("Letter", 8.5, 11.0)] {
        for landscape in [false, true] {
            paper::configure(&info, width, height, landscape).unwrap();
            let (expected_width, expected_height) = if landscape {
                (height * 72.0, width * 72.0)
            } else {
                (width * 72.0, height * 72.0)
            };
            let size = info.paperSize();
            assert!(
                (size.width - expected_width).abs() < 0.000_001,
                "{label} landscape={landscape}: {size:?}"
            );
            assert!(
                (size.height - expected_height).abs() < 0.000_001,
                "{label} landscape={landscape}: {size:?}"
            );
            assert_eq!(
                (
                    info.leftMargin(),
                    info.rightMargin(),
                    info.topMargin(),
                    info.bottomMargin()
                ),
                (0.0, 0.0, 0.0, 0.0)
            );
            assert_eq!(info.scalingFactor(), 1.0);
            assert_eq!(info.horizontalPagination(), NSPrintingPaginationMode::Clip);
            assert_eq!(
                info.verticalPagination(),
                NSPrintingPaginationMode::Automatic
            );
            assert!(!info.isHorizontallyCentered() && !info.isVerticallyCentered());
            let imageable = info.imageablePageBounds();
            assert!(
                imageable.origin.x.abs() < 0.000_001 && imageable.origin.y.abs() < 0.000_001,
                "{imageable:?}"
            );
            assert!(
                (imageable.size.width - expected_width).abs() < 0.000_001
                    && (imageable.size.height - expected_height).abs() < 0.000_001,
                "{imageable:?}"
            );
            println!(
                "PASS {label} landscape={landscape}: {} x {} pt; full printable area, 100% scale",
                size.width, size.height
            );
        }
    }
}

#[cfg(not(target_os = "macos"))]
fn main() {
    println!("AppKit paper geometry is only applicable to macOS.");
}
