use serde::{Deserialize, Serialize};

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct SearchOptions {
    #[serde(default)]
    content_case_sensitive: bool,
    #[serde(default)]
    file_exclude_patterns: Option<String>,
}

impl Default for SearchOptions {
    fn default() -> Self {
        Self {
            content_case_sensitive: false,
            file_exclude_patterns: None,
        }
    }
}

#[derive(Clone, Copy, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SearchScope {
    Global,
    QuickOpen,
}

impl SearchScope {
    fn key(self) -> &'static str {
        match self {
            Self::Global => "global",
            Self::QuickOpen => "quick_open",
        }
    }
}

fn sessions() -> &'static mf_file_search::cancellation::SearchSessions {
    static SESSIONS: std::sync::OnceLock<mf_file_search::cancellation::SearchSessions> =
        std::sync::OnceLock::new();
    SESSIONS.get_or_init(Default::default)
}

pub fn window_destroyed(label: &str) {
    sessions().remove_owner(label);
}

pub mod cmd {
    use mf_file_search::{
        manager,
        options::{ContentOptions, Options},
        search::Search,
    };
    use std::sync::{
        atomic::{AtomicBool, Ordering},
        mpsc::channel,
        Arc,
    };
    use tauri::command;

    use super::{sessions, SearchOptions, SearchScope};

    #[command]
    pub async fn search_files_async(
        window: tauri::WebviewWindow,
        query: Search,
        options: SearchOptions,
        request_id: Option<u64>,
        scope: Option<SearchScope>,
    ) -> Result<manager::FinalResults, Vec<String>> {
        let owner = window.label().to_owned();
        let token = match (request_id, scope) {
            (Some(id), Some(scope)) => sessions().begin(&owner, scope.key(), id),
            (None, None) => Arc::new(AtomicBool::new(false)),
            _ => return Err(vec!["Search request identity is incomplete".into()]),
        };
        let result = run_search(query, options, token).await;
        if let (Some(id), Some(scope)) = (request_id, scope) {
            sessions().finish(&owner, scope.key(), id);
        }
        result
    }

    #[command]
    pub fn cancel_file_search(window: tauri::WebviewWindow, request_id: u64, scope: SearchScope) {
        sessions().cancel(window.label(), scope.key(), request_id);
    }

    async fn run_search(
        query: Search,
        options: SearchOptions,
        canceled: Arc<AtomicBool>,
    ) -> Result<manager::FinalResults, Vec<String>> {
        tokio::task::spawn_blocking(move || search_files(query, options, canceled))
            .await
            .map_err(|_| vec!["search task spawn error".to_string()])?
    }

    fn search_files(
        query: Search,
        options: SearchOptions,
        canceled: Arc<AtomicBool>,
    ) -> Result<manager::FinalResults, Vec<String>> {
        let (sender, receiver) = channel();
        let default_options = Options::default();
        let mut name_options = default_options.name;
        let mut content_options = ContentOptions {
            case_sensitive: options.content_case_sensitive,
            ..Default::default()
        };

        if let Some(exclude_patterns) = options.file_exclude_patterns {
            name_options.exclude_patterns = exclude_patterns.clone();
            content_options.exclude_patterns = exclude_patterns;
        }

        let search_options = Options {
            name: name_options,
            content: content_options,
            sort: default_options.sort,
            last_dir: default_options.last_dir,
            name_history: default_options.name_history,
            content_history: default_options.content_history,
        };

        let mut manager = manager::Manager::final_only(sender, search_options);
        manager.search_with_cancellation(query, canceled.clone());

        let mut errors = Vec::new();
        loop {
            match receiver.recv() {
                Ok(manager::SearchResult::FinalResults(results)) => {
                    return if canceled.load(Ordering::Relaxed) {
                        Err(vec!["Search canceled".into()])
                    } else {
                        Ok(results)
                    };
                }
                Ok(manager::SearchResult::InterimResult(_)) => {
                    // Interim results are intentionally omitted from the direct-return IPC API.
                }
                Ok(manager::SearchResult::SearchErrors(search_errors)) => {
                    errors.extend(search_errors);
                }
                Err(_) => return Err(errors),
            }
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[tokio::test]
        async fn canceled_search_returns_no_stale_results() {
            let result = run_search(
                Search::default(),
                SearchOptions::default(),
                Arc::new(AtomicBool::new(true)),
            )
            .await;
            assert_eq!(result.unwrap_err(), ["Search canceled"]);
        }

        #[tokio::test]
        async fn search_uses_the_shared_blocking_pool() {
            let directory = tempfile::tempdir().unwrap();
            let expected_path = directory.path().join("needle.md");
            std::fs::write(&expected_path, "content").unwrap();

            let results = run_search(
                Search {
                    dir: directory.path().to_string_lossy().into_owned(),
                    name_text: "needle".to_string(),
                    contents_text: String::new(),
                },
                SearchOptions::default(),
                Arc::new(AtomicBool::new(false)),
            )
            .await
            .unwrap();

            assert!(results
                .data
                .iter()
                .any(|file| file.path == expected_path.to_string_lossy()));
        }
    }
}
