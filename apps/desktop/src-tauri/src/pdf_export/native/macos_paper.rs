//! Exact physical paper for fixed-page PDF output. NSPrintInfo::setPaperSize
//! snaps A4 to the printer's rounded 595 x 842 pt preset; a custom PrintCore
//! paper preserves the requested 210 x 297 mm and a fully printable page.
use core_foundation::{base::TCFType, string::CFString};
use core_foundation_sys::string::CFStringRef;
use objc2::MainThreadMarker;
use objc2_app_kit::{NSPrintInfo, NSPrintingPaginationMode};
use std::{ffi::c_void, ptr::NonNull};

#[repr(C)]
struct PaperMargins {
    top: f64,
    left: f64,
    bottom: f64,
    right: f64,
}

// Public PrintCore declarations from the macOS SDK PMCore.h/PMDefinitions.h.
// PMOrientation is UInt16 and Boolean is UInt8. All calls stay on the main
// thread; created PMPaper and PMPageFormat values use PMRelease ownership.
#[link(name = "ApplicationServices", kind = "framework")]
extern "C" {
    fn PMPaperCreateCustom(
        printer: *mut c_void,
        identifier: CFStringRef,
        name: CFStringRef,
        width: f64,
        height: f64,
        margins: *const PaperMargins,
        paper: *mut *mut c_void,
    ) -> i32;
    fn PMCreatePageFormatWithPMPaper(format: *mut *mut c_void, paper: *mut c_void) -> i32;
    fn PMSetOrientation(format: *mut c_void, orientation: u16, locked: u8) -> i32;
    fn PMCopyPageFormat(source: *mut c_void, destination: *mut c_void) -> i32;
    fn PMRelease(object: *mut c_void) -> i32;
}

struct PrintObject(NonNull<c_void>);
impl Drop for PrintObject {
    fn drop(&mut self) {
        // SAFETY: Every instance wraps one successful PrintCore Create result.
        unsafe { PMRelease(self.0.as_ptr()) };
    }
}

fn status(result: i32, operation: &str) -> Result<(), String> {
    if result == 0 {
        Ok(())
    } else {
        Err(format!("{operation} failed ({result})."))
    }
}

pub(super) fn configure(
    info: &NSPrintInfo,
    width_inches: f64,
    height_inches: f64,
    landscape: bool,
) -> Result<(), String> {
    let _main = MainThreadMarker::new().ok_or("PDF paper must be prepared on the main thread.")?;
    let (width, height) = (width_inches * 72.0, height_inches * 72.0);
    if !width.is_finite() || !height.is_finite() || width <= 0.0 || height <= 0.0 {
        return Err("The requested physical paper dimensions are invalid.".into());
    }
    let identifier = CFString::new(&format!("org.markflowy.pdf.{width:.8}x{height:.8}"));
    let name = CFString::new("MarkFlowy PDF");
    let margins = PaperMargins {
        top: 0.0,
        left: 0.0,
        bottom: 0.0,
        right: 0.0,
    };
    let mut paper = std::ptr::null_mut();
    // SAFETY: A null printer means generic paper. Strings and margins remain
    // live for the call; the out pointer receives a newly owned PMPaper.
    status(
        unsafe {
            PMPaperCreateCustom(
                std::ptr::null_mut(),
                identifier.as_concrete_TypeRef(),
                name.as_concrete_TypeRef(),
                width,
                height,
                &margins,
                &mut paper,
            )
        },
        "Creating exact PDF paper",
    )?;
    let paper = PrintObject(NonNull::new(paper).ok_or("PrintCore returned no paper.")?);
    let mut format = std::ptr::null_mut();
    // SAFETY: The paper is live and format receives a newly owned page format.
    status(
        unsafe { PMCreatePageFormatWithPMPaper(&mut format, paper.0.as_ptr()) },
        "Creating the PDF page format",
    )?;
    let format = PrintObject(NonNull::new(format).ok_or("PrintCore returned no page format.")?);
    // SAFETY: The owned page format is live. These are PMDefinitions.h's
    // portrait/landscape constants; orientation is unlocked, not user state.
    status(
        unsafe { PMSetOrientation(format.0.as_ptr(), if landscape { 2 } else { 1 }, 0) },
        "Orienting the PDF paper",
    )?;
    // SAFETY: NSPrintInfo owns the destination PMPageFormat. Copy transfers
    // settings, and updateFromPMPageFormat synchronizes the AppKit properties.
    status(
        unsafe { PMCopyPageFormat(format.0.as_ptr(), info.PMPageFormat().as_ptr()) },
        "Configuring the PDF paper",
    )?;
    info.updateFromPMPageFormat();
    info.setLeftMargin(0.0);
    info.setRightMargin(0.0);
    info.setTopMargin(0.0);
    info.setBottomMargin(0.0);
    info.setScalingFactor(1.0);
    info.setHorizontallyCentered(false);
    info.setVerticallyCentered(false);
    // Fixed Paged.js pages already own overflow and line breaking. AppKit Fit
    // would add its own uniform scaling independently of scalingFactor.
    info.setHorizontalPagination(NSPrintingPaginationMode::Clip);
    info.setVerticalPagination(NSPrintingPaginationMode::Automatic);
    let actual = info.paperSize();
    let (expected_width, expected_height) = if landscape {
        (height, width)
    } else {
        (width, height)
    };
    if (actual.width - expected_width).abs() > 0.000_001
        || (actual.height - expected_height).abs() > 0.000_001
    {
        return Err("AppKit changed the requested physical PDF paper size.".into());
    }
    Ok(())
}
