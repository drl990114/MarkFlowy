use serde::{Deserialize, Serialize};
use sqlx;

use frunk::LabelledGeneric;

use crate::{
    relay::Base64Cursor,
    scalar::{Id, Time},
};

#[derive(Debug, Clone,Serialize, Deserialize, sqlx::FromRow, LabelledGeneric)]
pub struct User {
    pub id: Id,
    pub name: String,
    pub email: String,
    pub password: String,
    pub created_at: Time,
    pub updated_at: Time,
}

#[derive(Debug, LabelledGeneric)]
pub struct UserEdge {
    pub node: User,
    pub cursor: String,
}

impl From<User> for UserEdge {
    fn from(user: User) -> Self {
        let cursor = Base64Cursor::new(user.id).encode();
        Self { node: user, cursor }
    }
}

#[derive(Debug, LabelledGeneric)]
pub struct PageInfo {
    pub end_cursor: Option<String>,
    pub has_next_page: bool,
    pub start_cursor: Option<String>,
    pub has_previous_page: bool,
}
