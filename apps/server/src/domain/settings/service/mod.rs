mod create_settings;
mod delete_settings;
mod find_settings_by_user_id;
mod update_settings;

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
