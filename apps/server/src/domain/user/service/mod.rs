mod check_useremail_exists;
mod create_user;
mod delete_user;
mod find_user_by_id;
mod find_user_by_email;
mod find_users;
mod notify_user;
mod update_user;

use frunk::LabelledGeneric;

use super::repository::Repository;
use crate::{db::DB, driver::Mailer};

#[derive(Debug)]
pub struct Service {
    repo: Repository,
    pub db: DB,
    mailer: Mailer,
}

impl Service {
    pub fn new(db: DB, mailer: Mailer) -> Self {
        let repo = Repository::new();
        Self { repo, db, mailer }
    }
}

#[derive(Debug, LabelledGeneric)]
pub struct CreateUserInput {
    pub name: String,
    pub email: String,
    pub password: String,
}

#[derive(Debug, LabelledGeneric)]
pub struct UpdateSelfInput {
    pub name: String,
    pub email: String,
    pub password: String,
}
