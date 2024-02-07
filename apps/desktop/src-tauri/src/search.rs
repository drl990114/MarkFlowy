use serde::{Deserialize, Serialize};

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct SearchOptions {
    content_case_sensitive: bool,
}

impl Default for SearchOptions {
    fn default() -> Self {
        Self {
            content_case_sensitive: false,
        }
    }
}

pub mod cmd {
    use file_search::{
        manager,
        options::{ContentOptions, Options},
        search::Search,
    };
    use std::{sync::mpsc::channel, thread::spawn};
    use tauri::{command, AppHandle, EventTarget, Manager};

    use super::SearchOptions;

    #[command]
    pub fn search_files(_app: AppHandle, query: Search, options: SearchOptions) {
        let (s, r) = channel();
        let default_options = Options::default();
        let opts = Options {
            name: default_options.name,
            content: ContentOptions {
                case_sensitive: options.content_case_sensitive,
            },
            sort: default_options.sort,
            last_dir: default_options.last_dir,
            name_history: default_options.name_history,
            content_history: default_options.content_history,
        };

        let mut man = manager::Manager::new(s, opts);
        man.search(query);

        spawn(move || loop {
            let mess = r.recv();
            if mess.is_err() {
                break;
            }
            let mess = mess.unwrap();
            match mess {
                manager::SearchResult::FinalResults(fi) => {
                    let _ = _app.emit_to(
                        EventTarget::any(),
                        "search_channel_final",
                        Some(fi),
                    );
                }
                manager::SearchResult::InterimResult(_fi) => {
                    // let _ = tauri::Manager::get_window(&_app, "main").unwrap().emit("search_channel_unit", Some(fi));
                }
                manager::SearchResult::SearchErrors(fi) => {
                    let _ = _app.emit_to(
                        EventTarget::any(),
                        "search_channel_error",
                        Some(fi),
                    );
                }
            }
        });
    }
}
