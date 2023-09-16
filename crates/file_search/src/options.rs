use serde::{Deserialize, Serialize};

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct Options {
    //general options
    #[serde(default)]
    pub sort: Sort,
    #[serde(default)]
    pub last_dir: String,
    #[serde(default)]
    pub name_history: Vec<String>,
    #[serde(default)]
    pub content_history: Vec<String>,
    #[serde(default)]
    pub name: NameOptions,
    #[serde(default)]
    pub content: ContentOptions,
}

impl Default for Options {
    fn default() -> Self {
        Self {
            sort: Sort::None,
            last_dir: ".".to_string(),
            name_history: vec![],
            content_history: vec![],
            name: Default::default(),
            content: Default::default(),
        }
    }
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct NameOptions {
    #[serde(default)]
    pub case_sensitive: bool,
    #[serde(default)]
    pub file_types: FTypes,
    #[serde(default)]
    pub same_filesystem: bool,
    #[serde(default)]
    pub follow_links: bool,
    #[serde(default = "bool_true")]
    pub ignore_dot: bool,
    #[serde(default = "bool_true")]
    pub use_gitignore: bool,
}

fn bool_true() -> bool {
    true
}

impl Default for NameOptions {
    fn default() -> Self {
        Self {
            case_sensitive: false,
            file_types: FTypes::All,
            same_filesystem: false,
            follow_links: false,
            ignore_dot: true,
            use_gitignore: true,
        }
    }
}

#[derive(Clone, Serialize, Deserialize, Debug, Default)]
pub struct ContentOptions {
    pub case_sensitive: bool,
}

#[derive(Clone, Copy, Serialize, Deserialize, Debug, Default)]
pub enum Sort {
    #[default]
    None,
    Path,
    Name,
    Extension,
}

#[derive(PartialEq, Eq, Clone, Copy, Serialize, Deserialize, Debug, Default)]
pub enum FTypes {
    Files,
    Directories,
    #[default]
    All,
}
