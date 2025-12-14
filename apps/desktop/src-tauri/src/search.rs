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
    use mf_file_search::{
        manager,
        options::{ContentOptions, Options},
        search::Search,
    };
    use std::{sync::mpsc::channel, thread::spawn};
    use tauri::{command, AppHandle, Emitter, EventTarget};

    use super::SearchOptions;

    #[command]
    pub async fn search_files_async(
        query: Search,
        options: SearchOptions,
    ) -> Result<manager::FinalResults, Vec<String>> {
        use crate::task_system::error::SystemError;
        use crate::task_system::system::System;
        use crate::task_system::task::{ExecStatus, Interrupter, Task, TaskId, TaskOutput};
        use async_trait::async_trait;
        use thiserror::Error;

        #[derive(Debug, Error)]
        enum SearchError {
            #[error("Search error: {0:?}")]
            SearchError(Vec<String>),
            #[error("System error: {0}")]
            SystemError(#[from] SystemError),
        }

        #[derive(Debug)]
        struct SearchTask {
            id: TaskId,
            query: Search,
            options: SearchOptions,
        }

        impl SearchTask {
            fn new(query: Search, options: SearchOptions) -> Self {
                Self {
                    id: TaskId::new_v4(),
                    query,
                    options,
                }
            }
        }

        #[async_trait]
        impl Task<SearchError> for SearchTask {
            fn id(&self) -> TaskId {
                self.id
            }

            fn with_priority(&self) -> bool {
                // 搜索任务通常需要优先处理
                true
            }

            async fn run(&mut self, _interrupter: &Interrupter) -> Result<ExecStatus, SearchError> {
                let query = self.query.clone();
                let options = self.options.clone();

                let search_result = tokio::task::spawn_blocking(move || {
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

                    let mut errors: Vec<String> = Vec::new();
                    loop {
                        match r.recv() {
                            Ok(manager::SearchResult::FinalResults(fi)) => return Ok(fi),
                            Ok(manager::SearchResult::InterimResult(_)) => {
                                // ignore interim results in async direct-return API
                            }
                            Ok(manager::SearchResult::SearchErrors(errs)) => {
                                errors.extend(errs);
                            }
                            Err(_) => break,
                        }
                    }

                    Err(SearchError::SearchError(errors))
                })
                .await
                .map_err(|_| {
                    SearchError::SearchError(vec!["search task spawn error".to_string()])
                })?;

                match search_result {
                    Ok(fi) => Ok(ExecStatus::Done(TaskOutput::Out(Box::new(fi)))),
                    Err(e) => Err(e),
                }
            }
        }

        // 创建任务系统实例
        let system = System::<SearchError>::new();

        // 创建搜索任务并分发
        let task = SearchTask::new(query, options);
        let handle = system
            .dispatch(task)
            .await
            .map_err(|_| vec!["search task dispatch error".to_string()])?;

        // 等待任务完成并处理结果
        match handle.await {
            Ok(crate::task_system::task::TaskStatus::Done((_, TaskOutput::Out(out)))) => {
                // 将AnyTaskOutput转换回FinalResults
                let results = out
                    .downcast::<manager::FinalResults>()
                    .map_err(|_| vec!["search task result conversion error".to_string()])?;
                Ok(*results)
            }
            Ok(crate::task_system::task::TaskStatus::Done((_, TaskOutput::Empty))) => {
                Err(vec!["search task returned empty result".to_string()])
            }
            Ok(crate::task_system::task::TaskStatus::Error(SearchError::SearchError(errs))) => {
                Err(errs)
            }
            Ok(crate::task_system::task::TaskStatus::Error(SearchError::SystemError(_))) => {
                Err(vec!["search task system error".to_string()])
            }
            Ok(crate::task_system::task::TaskStatus::Canceled) => {
                Err(vec!["search task was canceled".to_string()])
            }
            Ok(crate::task_system::task::TaskStatus::ForcedAbortion) => {
                Err(vec!["search task was forcibly aborted".to_string()])
            }
            Ok(crate::task_system::task::TaskStatus::Shutdown(_)) => {
                Err(vec!["search task was shutdown".to_string()])
            }
            Err(_) => Err(vec!["search task join error".to_string()]),
        }
    }
}
