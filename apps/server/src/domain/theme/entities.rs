use async_graphql::SimpleObject;
use serde::{Deserialize, Serialize};
use sqlx;

use frunk::LabelledGeneric;
use uuid::Uuid;

use crate::{
    relay::Base64Cursor,
    scalar::{Id, Time},
};

#[derive(Debug, Clone,Serialize, Deserialize, sqlx::FromRow, LabelledGeneric)]
pub struct Theme {
    pub id: Id,
    pub name: String,
    pub author_id: Uuid,
    pub author_name: String,
    pub npm_package_name: String,
    pub cover_image_url: String,
    pub created_at: Time,
    pub updated_at: Time,
}

#[derive(Debug, Clone,Serialize, Deserialize, SimpleObject, sqlx::FromRow, LabelledGeneric)]
pub struct ThemeOutput {
    pub id: Id,
    pub name: String,
    pub author_id: Uuid,
    pub author_name: String,
    pub npm_package_name: String,
    pub cover_image_url: String,
    pub author_email: String,
    pub created_at: Time,
    pub updated_at: Time,
}

#[derive(Debug, LabelledGeneric)]
pub struct ThemeEdge {
    pub node: ThemeOutput,
    pub cursor: String,
}

impl From<ThemeOutput> for ThemeEdge {
    fn from(user: ThemeOutput) -> Self {
        let cursor = Base64Cursor::new(user.id).encode();
        Self { node: user, cursor }
    }
}

#[derive(Debug, LabelledGeneric)]
pub struct ThemePageInfo {
    pub end_cursor: Option<String>,
    pub has_next_page: bool,
    pub start_cursor: Option<String>,
    pub has_previous_page: bool,
}
