mod create_theme;
mod delete_theme;
mod find_all_themes;
mod find_theme_by_id;
mod update_theme;

#[derive(Debug, Clone)]
pub struct Repository {}

impl Repository {
    pub fn new() -> Repository {
        Repository {}
    }
}

impl Default for Repository {
    fn default() -> Self {
        Self::new()
    }
}
