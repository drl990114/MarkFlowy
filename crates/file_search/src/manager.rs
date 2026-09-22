use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::ffi::OsString;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{Receiver, Sender};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use arboard::Clipboard;
use ignore::WalkBuilder;

use crate::exclude::{build_exclude_matcher, is_excluded_path};
use crate::fileinfo::FileInfo;
use crate::options::{FTypes, Options, Sort};
use crate::rgtools::{self, ContentSearcher};
use crate::search::Search;

pub enum Message {
    File(FileInfo, usize),
    Done(usize, Duration),
    ContentFiles(Vec<FileInfo>, usize, Duration),
    StartSearch(usize),
    FileErrors(Vec<String>),
    Quit,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub enum SearchResult {
    FinalResults(FinalResults),
    InterimResult(FileInfo),
    SearchErrors(Vec<String>),
}
#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct FinalResults {
    pub data: Vec<FileInfo>,
    pub duration: Duration,
    pub id: usize,
}
pub struct Manager {
    internal_sender: Sender<Message>,
    id: usize,
    options: Arc<Mutex<Options>>,
    pub must_stop: Arc<AtomicBool>,
}

impl Manager {
    pub fn new(external_sender: Sender<SearchResult>, opt: Options) -> Self {
        Self::with_interim_results(external_sender, opt, true)
    }

    pub fn final_only(external_sender: Sender<SearchResult>, opt: Options) -> Self {
        Self::with_interim_results(external_sender, opt, false)
    }

    fn with_interim_results(
        external_sender: Sender<SearchResult>,
        opt: Options,
        interim: bool,
    ) -> Self {
        let ops = Arc::new(Mutex::new(opt));

        //internal channel that sends results inside
        let (s, r) = std::sync::mpsc::channel();
        let ops_for_receiver = ops.clone();
        thread::spawn(move || {
            message_receiver(r, external_sender, ops_for_receiver, interim);
        });
        Self {
            internal_sender: s,
            id: 0,
            options: ops,
            must_stop: Arc::new(AtomicBool::new(false)),
        }
    }
    pub fn stop(&mut self) {
        self.must_stop
            .store(true, std::sync::atomic::Ordering::Relaxed);
    }

    pub fn search(&mut self, search: Search) {
        self.search_with_cancellation(search, Arc::new(AtomicBool::new(false)));
    }

    pub fn search_with_cancellation(&mut self, search: Search, canceled: Arc<AtomicBool>) {
        self.stop();
        self.must_stop = canceled;
        let mut ops = self.options.lock().unwrap();
        self.id += 1;
        ops.last_dir = search.dir.clone();
        if !search.name_text.is_empty() && !ops.name_history.contains(&search.name_text) {
            ops.name_history.push(search.name_text.clone());
        }
        if !search.contents_text.is_empty() && !ops.content_history.contains(&search.contents_text)
        {
            ops.content_history.push(search.contents_text.clone());
        }
        drop(ops);
        self.spawn_search(search);
    }

    pub fn dir_is_valid(&self, dir: &str) -> bool {
        PathBuf::from(dir).exists()
    }

    pub fn set_options(&mut self, ops: Options) {
        *self.options.lock().unwrap() = ops;
    }

    pub fn get_options(&self) -> Options {
        self.options.lock().unwrap().clone()
    }

    pub fn set_sort(&mut self, sort: Sort) {
        self.options.lock().unwrap().sort = sort;
    }

    pub fn export(&self, paths: Vec<String>) {
        let r = Clipboard::new().and_then(|mut ctx| ctx.set_text(paths.join("\n")));
        if let Err(err) = r {
            eprintln!("Clip error: {}", err);
        }
    }

    fn spawn_search(&self, search: Search) {
        let message_number = self.id;

        let file_sender = self.internal_sender.clone();
        //reset search, and send type
        let res = file_sender.send(Message::StartSearch(self.id));
        if let Result::Err(err) = res {
            eprintln!("Error sending {err}");
        }

        if self.must_stop.load(Ordering::Relaxed)
            || (search.name_text.is_empty() && search.contents_text.is_empty())
        {
            let _ = file_sender.send(Message::Done(message_number, Duration::ZERO));
            return;
        }

        //do name search
        let must_stop1 = self.must_stop.clone();
        let search1 = search.clone();
        let file_sender1 = file_sender.clone();
        let options1 = self.options.lock().unwrap().clone();

        if !search.name_text.is_empty() {
            thread::spawn(move || {
                let start = Instant::now();
                Manager::find_names(
                    &search1,
                    options1,
                    message_number,
                    file_sender1.clone(),
                    must_stop1,
                );
                if let Err(err) = file_sender1.send(Message::Done(message_number, start.elapsed()))
                {
                    eprintln!("Manager: Could not send result {message_number} {err:?}");
                }
            });
        }

        //do content search (only if name is empty, otherwise it will be spawned after)
        let must_stop2 = self.must_stop.clone();
        let options2 = self.options.lock().unwrap().clone();
        if !search.contents_text.is_empty() && search.name_text.is_empty() {
            thread::spawn(move || {
                let start = Instant::now();
                let files = Manager::find_contents(
                    &search.contents_text,
                    &search.dir,
                    None,
                    options2,
                    must_stop2,
                );
                let _ = file_sender.send(Message::ContentFiles(
                    files.results,
                    message_number,
                    Duration::ZERO,
                ));
                let _ = file_sender.send(Message::FileErrors(files.errors));
                let _ = file_sender.send(Message::Done(message_number, start.elapsed()));
            });
        }
    }

    fn find_names(
        search: &Search,
        options: Options,
        id: usize,
        file_sender: Sender<Message>,
        must_stop: Arc<AtomicBool>,
    ) {
        let text = &search.name_text;
        let dir = &search.dir;
        let ftype = options.name.file_types;
        let sens = options.name.case_sensitive;
        let re = regex::RegexBuilder::new(text)
            .case_insensitive(!sens)
            .build();
        if re.is_err() {
            return;
        }
        let re = re.unwrap();
        let re = Arc::new(re);

        let content_matcher = if search.contents_text.is_empty() {
            None
        } else {
            match rgtools::content_matcher(&search.contents_text, &options.content) {
                Ok(matcher) => Some(Arc::new(matcher)),
                Err(error) => {
                    let _ = file_sender.send(Message::FileErrors(vec![error]));
                    return;
                }
            }
        };
        let content_exclude = Arc::new(build_exclude_matcher(
            dir,
            &options.content.exclude_patterns,
        ));
        let exclude_matcher = build_exclude_matcher(dir, &options.name.exclude_patterns);
        let mut walker_builder = WalkBuilder::new(dir);
        walker_builder
            .follow_links(options.name.follow_links)
            .same_file_system(options.name.same_filesystem)
            .threads(num_cpus::get())
            .hidden(options.name.ignore_dot)
            .git_ignore(options.name.use_gitignore);

        if !exclude_matcher.is_empty() {
            walker_builder.filter_entry(move |entry| {
                let is_dir = entry
                    .file_type()
                    .map(|file_type| file_type.is_dir())
                    .unwrap_or(false);
                !is_excluded_path(&exclude_matcher, entry.path(), is_dir)
            });
        }

        let walker = walker_builder.build_parallel();

        //walk dir
        walker.run(|| {
            let file_sender = file_sender.clone();
            let re = re.clone();

            let content_matcher = content_matcher.clone();
            let content_exclude = content_exclude.clone();
            let mut content_searcher = content_matcher.as_ref().map(|_| ContentSearcher::default());
            let must_stop = must_stop.clone();
            Box::new(move |result| {
                if must_stop.load(Ordering::Relaxed) {
                    return ignore::WalkState::Quit;
                }
                let dent = match result {
                    Ok(dent) => dent,
                    Err(err) => {
                        let _ = file_sender.send(Message::FileErrors(vec![err.to_string()]));
                        return ignore::WalkState::Continue;
                    }
                };

                let fs_type = dent.file_type();
                if fs_type.is_none() {
                    return ignore::WalkState::Continue;
                }
                let fs_type = fs_type.unwrap();

                //skip files if we dont want them
                match ftype {
                    FTypes::Files => {
                        if !fs_type.is_file() {
                            return ignore::WalkState::Continue;
                        }
                    }
                    FTypes::Directories => {
                        if !fs_type.is_dir() {
                            return ignore::WalkState::Continue;
                        }
                    }
                    _ => (),
                }

                let is_match = re.is_match(dent.file_name().to_str().unwrap_or_default());

                if is_match {
                    let mut must_add = true;
                    let mut matches = vec![];
                    if let Some(matcher) = &content_matcher {
                        if fs_type.is_dir()
                            || is_excluded_path(&content_exclude, dent.path(), false)
                        {
                            must_add = false;
                        } else {
                            match content_searcher.as_mut().unwrap().search_file(
                                matcher,
                                dent.path(),
                                &must_stop,
                            ) {
                                Ok(found) => {
                                    must_add = !found.is_empty();
                                    matches = found;
                                }
                                Err(error) => {
                                    must_add = false;
                                    let _ = file_sender
                                        .send(Message::FileErrors(vec![error.to_string()]));
                                }
                            }
                        }
                    }
                    if must_stop.load(Ordering::Relaxed) {
                        return ignore::WalkState::Quit;
                    }

                    if must_add {
                        let res = file_sender.send(Message::File(
                            FileInfo {
                                id: uuid::Uuid::new_v4().to_string(),
                                path: dent.path().to_string_lossy().to_string(),
                                relative_path: PathBuf::from(dent.path())
                                    .strip_prefix(dir)
                                    .unwrap_or(&PathBuf::from(dent.path()))
                                    .to_string_lossy()
                                    .to_string(),
                                name: dent.file_name().to_string_lossy().to_string(),
                                ext: PathBuf::from(dent.path())
                                    .extension()
                                    .unwrap_or(&OsString::from(""))
                                    .to_str()
                                    .unwrap_or_default()
                                    .into(),
                                matches,
                                is_folder: dent.file_type().unwrap().is_dir(),
                            },
                            id,
                        ));
                        if let Result::Err(err) = res {
                            eprintln!("Error sending {err}");
                        }
                    }
                }

                ignore::WalkState::Continue
            })
        });
    }

    fn find_contents(
        text: &str,
        dir: &str,
        allowed_files: Option<HashSet<String>>,
        options: Options,
        must_stop: Arc<AtomicBool>,
    ) -> ContentFileInfoResults {
        let content_results = rgtools::search_contents(
            text,
            &[OsString::from(dir)],
            allowed_files,
            options.content,
            must_stop,
        );
        ContentFileInfoResults {
            results: content_results.results,
            errors: content_results.errors,
        }
    }

    pub fn do_sort(vec: &mut [FileInfo], sort: Sort) {
        match sort {
            Sort::None => (),
            Sort::Path => vec.sort_by(|a, b| a.path.cmp(&b.path)),
            Sort::Name => vec.sort_by(|a, b| a.name.cmp(&b.name)),
            Sort::Extension => vec.sort_by(|a, b| a.ext.cmp(&b.ext)),
        };
    }
}

impl Drop for Manager {
    fn drop(&mut self) {
        self.stop();
        let _ = self.internal_sender.send(Message::Quit);
    }
}

#[derive(Default)]
pub struct ContentFileInfoResults {
    pub results: Vec<FileInfo>,
    pub errors: Vec<String>,
}

fn message_receiver(
    internal_receiver: Receiver<Message>,
    external_sender: Sender<SearchResult>,
    ops: Arc<Mutex<Options>>,
    interim: bool,
) {
    let mut final_names = vec![];
    let mut latest_number = 0;
    let mut tot_elapsed = Duration::from_secs(0);
    while let Ok(message) = internal_receiver.recv() {
        match message {
            Message::StartSearch(id) => {
                latest_number = id;
                tot_elapsed = Duration::from_secs(0);
                final_names.clear();
            }
            Message::ContentFiles(files, number, elapsed) => {
                if number != latest_number {
                    continue;
                }
                //only update if new update (old updates are discarded)
                for f in files {
                    final_names.push(f);
                }
                tot_elapsed += elapsed;
            }
            Message::File(file, number) => {
                //only update if new update (old updates are discarded)
                if number != latest_number {
                    continue;
                }
                //send to output
                if interim
                    && external_sender
                        .send(SearchResult::InterimResult(file.clone()))
                        .is_err()
                {
                    return;
                }
                final_names.push(file);
            }
            Message::Done(number, elapsed) => {
                if number != latest_number {
                    continue;
                }
                tot_elapsed += elapsed.to_owned();

                let sort_type = ops.lock().unwrap().sort;
                Manager::do_sort(&mut final_names, sort_type);
                let results = SearchResult::FinalResults(FinalResults {
                    id: latest_number,
                    data: std::mem::take(&mut final_names),
                    duration: tot_elapsed,
                });

                //send out to whoever is listening
                if external_sender.send(results).is_err() {
                    return;
                }
            }

            Message::Quit => break,
            Message::FileErrors(err) => {
                // eprintln!("Err: {err:?}");
                if !err.is_empty()
                    && external_sender
                        .send(SearchResult::SearchErrors(err))
                        .is_err()
                {
                    return;
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use std::sync::mpsc::channel;

    use super::*;

    #[test]
    fn receiver_exits_when_the_search_manager_is_dropped() {
        let (internal_sender, internal_receiver) = channel();
        let (external_sender, _external_receiver) = channel();
        let (finished_sender, finished_receiver) = channel();
        let receiver_thread = thread::spawn(move || {
            message_receiver(
                internal_receiver,
                external_sender,
                Arc::new(Mutex::new(Options::default())),
                true,
            );
            finished_sender.send(()).unwrap();
        });

        drop(internal_sender);
        finished_receiver
            .recv_timeout(Duration::from_secs(2))
            .expect("a completed search must not leave a spinning receiver thread");
        receiver_thread.join().unwrap();
    }

    #[test]
    fn final_only_search_returns_all_matches_without_interim_messages() {
        let dir = std::env::temp_dir().join(format!("mf-final-search-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir(&dir).unwrap();
        for n in 0..20 {
            std::fs::write(dir.join(format!("{n}.md")), "first\nneedle\n").unwrap();
        }
        let (sender, receiver) = channel();
        let mut manager = Manager::final_only(sender, Options::default());
        manager.search(Search {
            dir: dir.to_string_lossy().into_owned(),
            name_text: "md".into(),
            contents_text: "needle".into(),
        });
        let result = receiver.recv_timeout(Duration::from_secs(5)).unwrap();
        let SearchResult::FinalResults(result) = result else {
            panic!("only the final IPC result is requested");
        };
        assert_eq!(result.data.len(), 20);
        assert!(result
            .data
            .iter()
            .all(|file| file.matches.len() == 1 && file.matches[0].line == 2));
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn canceled_and_empty_searches_always_complete() {
        for canceled in [false, true] {
            let (sender, receiver) = channel();
            let mut manager = Manager::final_only(sender, Options::default());
            manager.search_with_cancellation(
                Search {
                    dir: "/nonexistent/search-root".into(),
                    name_text: if canceled { ".*".into() } else { String::new() },
                    contents_text: String::new(),
                },
                Arc::new(AtomicBool::new(canceled)),
            );
            let SearchResult::FinalResults(result) =
                receiver.recv_timeout(Duration::from_secs(2)).unwrap()
            else {
                panic!();
            };
            assert!(result.data.is_empty());
        }
    }

    #[test]
    fn find_names() {
        let mut dir = std::env::temp_dir();
        println!("Using Temporary directory: {}", dir.display());

        //create new directory in here, and create a file with the relevant text
        dir.push("rusltestdir");
        if dir.exists() {
            let _ = std::fs::remove_dir_all(&dir);
        }
        if std::fs::create_dir_all(&dir).is_err() {
            panic!("could not create temp dir");
        }

        let mut file1 = dir.clone();
        file1.push("temp.csv");

        if std::fs::write(&file1, "hello\nthere 41 go").is_err() {
            panic!("could not create file");
        }

        let (s, r) = channel();
        let mut man = Manager::new(s, Options::default());
        man.search(Search {
            dir: file1.to_string_lossy().to_string(),
            name_text: "temp.csv".to_string(),
            contents_text: "41".to_string(),
        });

        if let Ok(mess) = r.recv() {
            println!("{mess:?}");
            match mess {
                SearchResult::FinalResults(_) => panic!(),
                SearchResult::InterimResult(fi) => {
                    assert_eq!(fi.matches.len(), 1);
                }
                SearchResult::SearchErrors(_) => panic!(),
            }
        }
    }

    #[test]
    fn find_names_respects_exclude_patterns() {
        let mut dir = std::env::temp_dir();
        dir.push("markflowy_exclude_patterns_test");
        if dir.exists() {
            let _ = std::fs::remove_dir_all(&dir);
        }
        std::fs::create_dir_all(dir.join("ignored")).unwrap();
        std::fs::write(dir.join("visible.md"), "visible").unwrap();
        std::fs::write(dir.join("Thumbs.db"), "thumb").unwrap();
        std::fs::write(dir.join("draft.tmp"), "draft").unwrap();
        std::fs::write(dir.join("keep.tmp"), "keep").unwrap();
        std::fs::write(dir.join("ignored").join("nested.md"), "nested").unwrap();

        let (s, r) = channel();
        let mut options = Options::default();
        options.name.ignore_dot = false;
        options.name.use_gitignore = false;
        options.name.exclude_patterns = "Thumbs.db\n*.tmp\n!keep.tmp\nignored/".to_string();

        Manager::find_names(
            &Search {
                dir: dir.to_string_lossy().to_string(),
                name_text: ".*".to_string(),
                contents_text: "".to_string(),
            },
            options,
            1,
            s,
            Arc::new(AtomicBool::new(false)),
        );

        let names: Vec<String> = r
            .try_iter()
            .filter_map(|message| match message {
                Message::File(file, _) => Some(file.name),
                _ => None,
            })
            .collect();

        assert!(names.contains(&"visible.md".to_string()));
        assert!(names.contains(&"keep.tmp".to_string()));
        assert!(!names.contains(&"Thumbs.db".to_string()));
        assert!(!names.contains(&"draft.tmp".to_string()));
        assert!(!names.contains(&"ignored".to_string()));
        assert!(!names.contains(&"nested.md".to_string()));

        let _ = std::fs::remove_dir_all(&dir);
    }
}
