use std::path::Path;

use ignore::gitignore::{Gitignore, GitignoreBuilder};

pub type ExcludeMatcher = Gitignore;

pub fn build_exclude_matcher<P: AsRef<Path>>(root: P, patterns: &str) -> Gitignore {
    let mut builder = GitignoreBuilder::new(&root);

    for line in patterns.lines() {
        let _ = builder.add_line(None, line);
    }

    builder.build().unwrap_or_else(|err| {
        eprintln!(
            "Failed to build gitignore exclude matcher for {:?}: {}",
            root.as_ref(),
            err
        );
        Gitignore::empty()
    })
}

pub fn is_excluded_path<P: AsRef<Path>>(matcher: &Gitignore, path: P, is_dir: bool) -> bool {
    matcher.matched(path, is_dir).is_ignore()
}
