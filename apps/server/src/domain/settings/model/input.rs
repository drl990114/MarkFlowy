use async_graphql::InputObject;
use frunk::LabelledGeneric;

use crate::scalar::Id;

#[derive(InputObject, LabelledGeneric)]
pub struct CreateSettingsInput {
    pub settings_json: String,
}

#[derive(InputObject, LabelledGeneric)]
pub struct UpdateSettingsInput {
    pub id: Id,
    pub settings_json: String,
}

#[derive(InputObject, LabelledGeneric)]
pub struct DeleteSettingsInput {
    pub id: Id,
}