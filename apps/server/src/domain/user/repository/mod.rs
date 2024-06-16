mod create_user;
mod delete_user;
mod find_all_users;
mod find_user_by_id;
mod find_user_by_name;
mod update_user;

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
