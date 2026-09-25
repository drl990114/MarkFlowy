use std::{
    sync::{Mutex, OnceLock},
    time::Instant,
};

static NATIVE_ENTRY: OnceLock<Instant> = OnceLock::new();
static TIMELINE: Mutex<StartupTimeline> = Mutex::new(StartupTimeline { stages: Vec::new() });

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct NativeStartupStage {
    name: &'static str,
    elapsed_ms: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    window_label: Option<String>,
}

struct StartupTimeline {
    stages: Vec<NativeStartupStage>,
}

impl StartupTimeline {
    fn record(&mut self, name: &'static str, window_label: Option<&str>, elapsed_ms: f64) {
        if name == "page-load-start" {
            self.stages.retain(|stage| {
                stage.name != "page-load-finished" || stage.window_label.as_deref() != window_label
            });
        }
        // Page events may repeat on reload. Keep the latest event per live
        // window, with no paths, URLs or unbounded navigation history.
        if let Some(existing) = self
            .stages
            .iter_mut()
            .find(|stage| stage.name == name && stage.window_label.as_deref() == window_label)
        {
            existing.elapsed_ms = elapsed_ms;
        } else {
            self.stages.push(NativeStartupStage {
                name,
                elapsed_ms,
                window_label: window_label.map(str::to_owned),
            });
        }
    }

    fn snapshot(&self, window_label: &str) -> Vec<NativeStartupStage> {
        let mut stages: Vec<_> = self
            .stages
            .iter()
            .filter(|stage| {
                stage.window_label.is_none() || stage.window_label.as_deref() == Some(window_label)
            })
            .cloned()
            .collect();
        stages.sort_by(|left, right| left.elapsed_ms.total_cmp(&right.elapsed_ms));
        stages
    }

    fn forget_window(&mut self, window_label: &str) {
        self.stages
            .retain(|stage| stage.window_label.as_deref() != Some(window_label));
    }
}

fn native_elapsed_ms() -> f64 {
    NATIVE_ENTRY
        .get_or_init(Instant::now)
        .elapsed()
        .as_secs_f64()
        * 1000.0
}

pub(crate) fn record_native_entry() {
    NATIVE_ENTRY.get_or_init(Instant::now);
}

pub(crate) fn record_stage(name: &'static str, window_label: Option<&str>) {
    TIMELINE
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .record(name, window_label, native_elapsed_ms());
}

pub(crate) fn forget_window(window_label: &str) {
    TIMELINE
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .forget_window(window_label);
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct StartupTiming {
    native_elapsed_ms: f64,
    window_label: String,
    process_session_id: &'static str,
    host_version: &'static str,
    build_kind: &'static str,
    stages: Vec<NativeStartupStage>,
}

/// The frontend brackets this sample with its own clock, keeping IPC latency
/// as an explicit uncertainty interval instead of mixing wall/monotonic clocks.
#[tauri::command]
pub(crate) fn get_startup_timing(window: tauri::WebviewWindow) -> StartupTiming {
    let mut stages = vec![NativeStartupStage {
        name: "native-entry",
        elapsed_ms: 0.0,
        window_label: None,
    }];
    stages.extend(
        TIMELINE
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .snapshot(window.label()),
    );
    StartupTiming {
        native_elapsed_ms: native_elapsed_ms(),
        window_label: window.label().to_string(),
        process_session_id: super::window_manager::app_session_id(),
        host_version: env!("CARGO_PKG_VERSION"),
        build_kind: if cfg!(debug_assertions) {
            "debug"
        } else {
            "release"
        },
        stages,
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
            process_session_id: super::super::window_manager::app_session_id(),
            host_version: "0.7.0",
            build_kind: "debug",
            stages: vec![NativeStartupStage {
                name: "window-built",
                elapsed_ms: 10.0,
                window_label: Some("main".into()),
            }],
        })
        .unwrap();
        assert_eq!(value["nativeElapsedMs"], 12.5);
        assert_eq!(value["windowLabel"], "main");
        assert_eq!(
            value["processSessionId"],
            super::super::window_manager::app_session_id()
        );
        assert!(!value["processSessionId"].as_str().unwrap().is_empty());
        assert_eq!(value["hostVersion"], "0.7.0");
        assert_eq!(value["buildKind"], "debug");
        assert_eq!(value["stages"][0]["elapsedMs"], 10.0);
    }

    #[test]
    fn snapshot_is_ordered_and_scoped_to_the_current_window() {
        let mut timeline = StartupTimeline { stages: Vec::new() };
        timeline.record("setup-start", None, 10.0);
        timeline.record("window-built", Some("main"), 50.0);
        timeline.record("window-start", Some("main"), 20.0);
        timeline.record("window-built", Some("main_other"), 70.0);
        let snapshot = timeline.snapshot("main");
        assert_eq!(
            snapshot.iter().map(|stage| stage.name).collect::<Vec<_>>(),
            ["setup-start", "window-start", "window-built"]
        );
        assert_eq!(timeline.snapshot("main_other").len(), 2);
    }

    #[test]
    fn reload_and_window_close_do_not_grow_the_timeline() {
        let mut timeline = StartupTimeline { stages: Vec::new() };
        timeline.record("setup-end", None, 10.0);
        for index in 0..100 {
            timeline.record("page-load-start", Some("main"), 20.0 + index as f64);
            assert!(!timeline
                .snapshot("main")
                .iter()
                .any(|stage| stage.name == "page-load-finished"));
            timeline.record("page-load-finished", Some("main"), 21.0 + index as f64);
        }
        assert_eq!(timeline.snapshot("main").len(), 3);
        assert_eq!(timeline.snapshot("main")[1].elapsed_ms, 119.0);
        timeline.forget_window("main");
        assert_eq!(timeline.snapshot("main").len(), 1);
        assert_eq!(timeline.snapshot("main")[0].name, "setup-end");
    }
}
