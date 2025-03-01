mod create_theme;
mod delete_theme;
mod find_theme_by_id;
mod find_themes;
mod update_theme;

use frunk::LabelledGeneric;
use uuid::Uuid;

use super::repository::Repository;
use crate::db::DB;

#[derive(Debug)]
pub struct Service {
    repo: Repository,
    pub db: DB,
}

impl Service {
    pub fn new(db: DB) -> Self {
        let repo = Repository::new();
        Self { repo, db }
    }
}

#[derive(Debug, LabelledGeneric)]
pub struct CreateThemeInput {
    pub name: String,
    pub npm_package_name: String,
    pub cover_image_url: String,
}

#[derive(Debug, LabelledGeneric)]
pub struct UpdateThemeInput {
    pub id: Uuid,
    pub name: String,
    pub npm_package_name: String,
    pub cover_image_url: String,
}
