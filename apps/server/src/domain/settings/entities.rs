use async_graphql::SimpleObject;
use serde::{Deserialize, Serialize};
use sqlx;

use frunk::LabelledGeneric;
use uuid::Uuid;

use crate::{
    relay::Base64Cursor,
    scalar::{Id, Time},
};

#[derive(Debug, Clone, Serialize, Deserialize, SimpleObject, sqlx::FromRow, LabelledGeneric)]
pub struct Settings {
    pub id: Id,
    pub user_id: Uuid,
    pub settings_json: String,
    pub created_at: Time,
    pub updated_at: Time,
}

#[derive(Debug, LabelledGeneric)]
pub struct SettingsEdge {
    pub node: Settings,
    pub cursor: String,
}

impl From<Settings> for SettingsEdge {
    fn from(settings: Settings) -> Self {
        let cursor = Base64Cursor::new(settings.id).encode();
        Self {
            node: settings,
            cursor,
        }
    }
}
