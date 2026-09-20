use std::{sync::OnceLock, time::Instant};

static NATIVE_ENTRY: OnceLock<Instant> = OnceLock::new();

pub(crate) fn record_native_entry() {
    NATIVE_ENTRY.get_or_init(Instant::now);
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct StartupTiming {
    native_elapsed_ms: f64,
    window_label: String,
}

/// The frontend brackets this sample with its own clock, keeping IPC latency
/// as an explicit uncertainty interval instead of mixing wall/monotonic clocks.
#[tauri::command]
pub(crate) fn get_startup_timing(window: tauri::WebviewWindow) -> StartupTiming {
    StartupTiming {
        native_elapsed_ms: NATIVE_ENTRY.get_or_init(Instant::now).elapsed().as_secs_f64() * 1000.0,
        window_label: window.label().to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn native_entry_is_not_reset_by_later_windows() {
        record_native_entry();
        let first = *NATIVE_ENTRY.get().unwrap();
        record_native_entry();
        assert_eq!(*NATIVE_ENTRY.get().unwrap(), first);
        let value = serde_json::to_value(StartupTiming {
            native_elapsed_ms: 12.5,
            window_label: "main".into(),
        }).unwrap();
        assert_eq!(value["nativeElapsedMs"], 12.5);
        assert_eq!(value["windowLabel"], "main");
    }
}
