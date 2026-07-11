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

pub mod cmd {
    use mf_file_search::{
        manager,
        options::{ContentOptions, Options},
        search::Search,
    };
    use std::sync::mpsc::channel;
    use tauri::command;

    use super::SearchOptions;

    #[command]
    pub async fn search_files_async(
        query: Search,
        options: SearchOptions,
    ) -> Result<manager::FinalResults, Vec<String>> {
        tokio::task::spawn_blocking(move || search_files(query, options))
            .await
            .map_err(|_| vec!["search task spawn error".to_string()])?
    }

    fn search_files(
        query: Search,
        options: SearchOptions,
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

        let mut manager = manager::Manager::new(sender, search_options);
        manager.search(query);

        let mut errors = Vec::new();
        loop {
            match receiver.recv() {
                Ok(manager::SearchResult::FinalResults(results)) => return Ok(results),
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
        async fn search_uses_the_shared_blocking_pool() {
            let directory = tempfile::tempdir().unwrap();
            let expected_path = directory.path().join("needle.md");
            std::fs::write(&expected_path, "content").unwrap();

            let results = search_files_async(
                Search {
                    dir: directory.path().to_string_lossy().into_owned(),
                    name_text: "needle".to_string(),
                    contents_text: String::new(),
                },
                SearchOptions::default(),
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
