use grep::{
    regex::{RegexMatcher, RegexMatcherBuilder},
    searcher::{BinaryDetection, Searcher, SearcherBuilder, Sink, SinkMatch},
};
use std::{
    collections::HashSet,
    ffi::OsString,
    fs::File,
    io::{self, Read},
    path::Path,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
};
use walkdir::WalkDir;

use crate::exclude::{build_exclude_matcher, is_excluded_path};
use crate::fileinfo::{FileInfo, Match};
use crate::options::ContentOptions;

pub fn content_matcher(pattern: &str, ops: &ContentOptions) -> Result<RegexMatcher, String> {
    RegexMatcherBuilder::new()
        .case_insensitive(!ops.case_sensitive)
        .build(pattern)
        .map_err(|error| error.to_string())
}

/// Ripgrep's reusable buffers belong to a traversal worker, not an individual file.
pub struct ContentSearcher(Searcher);

impl Default for ContentSearcher {
    fn default() -> Self {
        Self(
            SearcherBuilder::new()
                .binary_detection(BinaryDetection::quit(b'\x00'))
                .line_number(true)
                .build(),
        )
    }
}

struct CancelableReader<'a, R> {
    reader: R,
    canceled: &'a AtomicBool,
}

impl<R: Read> Read for CancelableReader<'_, R> {
    fn read(&mut self, buffer: &mut [u8]) -> io::Result<usize> {
        if self.canceled.load(Ordering::Relaxed) {
            return Err(io::Error::other("Search canceled"));
        }
        self.reader.read(buffer)
    }
}

struct MatchSink<'a> {
    matches: &'a mut Vec<Match>,
    canceled: &'a AtomicBool,
}

impl Sink for MatchSink<'_> {
    type Error = io::Error;

    fn matched(&mut self, _: &Searcher, mat: &SinkMatch<'_>) -> io::Result<bool> {
        if self.canceled.load(Ordering::Relaxed) {
            return Ok(false);
        }
        let bytes = mat.bytes();
        let content = bytes.strip_suffix(b"\n").unwrap_or(bytes);
        self.matches.push(Match {
            id: uuid::Uuid::new_v4().to_string(),
            line: mat.line_number().unwrap_or(0) as usize,
            content: String::from_utf8_lossy(content).into_owned(),
        });
        Ok(true)
    }
}

impl ContentSearcher {
    pub fn search_file(
        &mut self,
        matcher: &RegexMatcher,
        path: &Path,
        canceled: &AtomicBool,
    ) -> io::Result<Vec<Match>> {
        if canceled.load(Ordering::Relaxed) {
            return Ok(Vec::new());
        }
        let reader = CancelableReader {
            reader: File::open(path)?,
            canceled,
        };
        let mut matches = Vec::new();
        let result = self.0.search_reader(
            matcher,
            reader,
            MatchSink {
                matches: &mut matches,
                canceled,
            },
        );
        if canceled.load(Ordering::Relaxed) {
            return Ok(Vec::new());
        }
        result?;
        Ok(matches)
    }
}

pub fn file_info(path: &Path, root: &Path, matches: Vec<Match>) -> FileInfo {
    FileInfo {
        id: uuid::Uuid::new_v4().to_string(),
        path: path.to_string_lossy().into_owned(),
        relative_path: path
            .strip_prefix(root)
            .unwrap_or(path)
            .to_string_lossy()
            .into_owned(),
        name: path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .into_owned(),
        ext: path
            .extension()
            .unwrap_or_default()
            .to_string_lossy()
            .into_owned(),
        matches,
        is_folder: path.is_dir(),
    }
}

#[derive(Default)]
pub struct ContentResults {
    pub results: Vec<FileInfo>,
    pub errors: Vec<String>,
}

pub fn search_contents(
    pattern: &str,
    paths: &[OsString],
    allowed_files: Option<HashSet<String>>,
    ops: ContentOptions,
    must_stop: Arc<AtomicBool>,
) -> ContentResults {
    let mut output = ContentResults::default();
    let matcher = match content_matcher(pattern, &ops) {
        Ok(matcher) => matcher,
        Err(error) => {
            output.errors.push(error);
            return output;
        }
    };
    let mut searcher = ContentSearcher::default();
    let mut search_file = |path: &Path, root: &Path, output: &mut ContentResults| match searcher
        .search_file(&matcher, path, &must_stop)
    {
        Ok(matches) if !matches.is_empty() => output.results.push(file_info(path, root, matches)),
        Ok(_) => (),
        Err(error) => output.errors.push(error.to_string()),
    };
    if let Some(allowed_files) = allowed_files {
        let exclude_matchers: Vec<_> = paths
            .iter()
            .map(|path| build_exclude_matcher(path, &ops.exclude_patterns))
            .collect();
        for path in allowed_files {
            if must_stop.load(Ordering::Relaxed) {
                return ContentResults::default();
            }
            if exclude_matchers
                .iter()
                .any(|matcher| is_excluded_path(matcher, &path, false))
            {
                continue;
            }
            search_file(
                Path::new(&path),
                paths.first().map(Path::new).unwrap_or(Path::new("")),
                &mut output,
            );
        }
    } else {
        for root in paths {
            let exclude = build_exclude_matcher(root, &ops.exclude_patterns);
            for entry in WalkDir::new(root).into_iter().filter_entry(|entry| {
                !is_excluded_path(&exclude, entry.path(), entry.file_type().is_dir())
            }) {
                if must_stop.load(Ordering::Relaxed) {
                    return ContentResults::default();
                }
                match entry {
                    Ok(entry) if entry.file_type().is_file() => {
                        search_file(entry.path(), Path::new(root), &mut output)
                    }
                    Ok(_) => (),
                    Err(error) => output.errors.push(error.to_string()),
                }
            }
        }
    }
    output
}

#[cfg(test)]
mod tests {
    use super::*;

    struct TempDirectory(std::path::PathBuf);
    impl TempDirectory {
        fn new() -> Self {
            let path = std::env::temp_dir().join(format!("mf-search-{}", uuid::Uuid::new_v4()));
            std::fs::create_dir(&path).unwrap();
            Self(path)
        }
    }
    impl Drop for TempDirectory {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn reused_searcher_keeps_unicode_line_numbers_and_literal_separator_text() {
        let dir = TempDirectory::new();
        let a = dir.0.join("a.md");
        let b = dir.0.join("b.md");
        std::fs::write(&a, "other\n针 NEEDLE\\0\\1\\2\\3\\4\r\nneedle").unwrap();
        std::fs::write(&b, "needle again\n").unwrap();
        let matcher = content_matcher("needle", &ContentOptions::default()).unwrap();
        let mut searcher = ContentSearcher::default();
        let canceled = AtomicBool::new(false);
        let first = searcher.search_file(&matcher, &a, &canceled).unwrap();
        assert_eq!(
            first.iter().map(|item| item.line).collect::<Vec<_>>(),
            [2, 3]
        );
        assert_eq!(first[0].content, "针 NEEDLE\\0\\1\\2\\3\\4\r");
        let second = searcher.search_file(&matcher, &b, &canceled).unwrap();
        assert_eq!(second.len(), 1);
        assert_eq!(second[0].line, 1);
        assert_eq!(second[0].content, "needle again");
        let matcher = content_matcher(
            "needle",
            &ContentOptions {
                case_sensitive: true,
                ..Default::default()
            },
        )
        .unwrap();
        assert_eq!(
            searcher.search_file(&matcher, &a, &canceled).unwrap().len(),
            1
        );
    }

    #[test]
    fn content_walk_respects_exclusions_and_cancellation() {
        let dir = TempDirectory::new();
        std::fs::create_dir(dir.0.join("ignored")).unwrap();
        for path in ["a.md", "skip.tmp", "keep.tmp", "ignored/a.md"] {
            std::fs::write(dir.0.join(path), "needle").unwrap();
        }
        let ops = ContentOptions {
            exclude_patterns: "*.tmp\n!keep.tmp\nignored/".into(),
            ..Default::default()
        };
        let paths = [dir.0.as_os_str().to_owned()];
        let token = Arc::new(AtomicBool::new(false));
        let output = search_contents("needle", &paths, None, ops.clone(), token.clone());
        let mut names: Vec<_> = output
            .results
            .iter()
            .map(|file| file.name.as_str())
            .collect();
        names.sort();
        assert_eq!(names, ["a.md", "keep.tmp"]);
        assert!(output.errors.is_empty());
        token.store(true, Ordering::Relaxed);
        assert!(search_contents("needle", &paths, None, ops, token)
            .results
            .is_empty());
    }

    #[test]
    fn cancellation_interrupts_reader_even_without_a_matching_line() {
        struct Reader<'a> {
            token: &'a AtomicBool,
            reads: usize,
        }
        impl Read for Reader<'_> {
            fn read(&mut self, buffer: &mut [u8]) -> io::Result<usize> {
                self.reads += 1;
                assert_eq!(
                    self.reads, 1,
                    "the canceled scan must not read another buffer"
                );
                buffer.fill(b'x');
                self.token.store(true, Ordering::Relaxed);
                Ok(buffer.len())
            }
        }
        let token = AtomicBool::new(false);
        let matcher = content_matcher("never found", &ContentOptions::default()).unwrap();
        let reader = CancelableReader {
            reader: Reader {
                token: &token,
                reads: 0,
            },
            canceled: &token,
        };
        let mut matches = Vec::new();
        let error = ContentSearcher::default()
            .0
            .search_reader(
                &matcher,
                reader,
                MatchSink {
                    matches: &mut matches,
                    canceled: &token,
                },
            )
            .unwrap_err();
        assert_eq!(error.kind(), io::ErrorKind::Other);
        assert!(matches.is_empty());
    }

    #[test]
    fn binary_and_pre_canceled_files_do_not_produce_matches() {
        let dir = TempDirectory::new();
        let path = dir.0.join("binary.md");
        std::fs::write(&path, b"\x00needle\n").unwrap();
        let matcher = content_matcher("needle", &ContentOptions::default()).unwrap();
        let mut searcher = ContentSearcher::default();
        assert!(searcher
            .search_file(&matcher, &path, &AtomicBool::new(false))
            .unwrap()
            .is_empty());
        assert!(searcher
            .search_file(&matcher, &dir.0.join("missing"), &AtomicBool::new(true))
            .unwrap()
            .is_empty());
    }
}
