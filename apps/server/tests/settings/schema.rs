use serde::Deserialize;
use uuid::Uuid;

//
// Settings
//

#[derive(Debug, Deserialize)]
pub struct SettingsResponse {
    pub data: SettingsConnectionWrapper,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all(deserialize = "camelCase"))]
pub struct SettingsConnectionWrapper {
    pub settings: SettingsConnection,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all(deserialize = "camelCase"))]
pub struct SettingsConnection {
    pub total_count: i32,
    pub edges: Vec<SettingsEdge>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all(deserialize = "camelCase"))]
pub struct SettingsEdge {
    pub node: Settings,
    pub cursor: String,
}

//
// Create Settings
//

#[derive(Debug, Deserialize)]
pub struct CreateSettingsResponse {
    pub data: CreateSettingsWrapper,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all(deserialize = "camelCase"))]
pub struct CreateSettingsWrapper {
    pub create_settings: Settings,
}

//
// Update Settings
//

#[derive(Debug, Deserialize)]
pub struct UpdateSettingsResponse {
    pub data: UpdateSettingsWrapper,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all(deserialize = "camelCase"))]
pub struct UpdateSettingsWrapper {
    pub update_settings: Settings,
}

//
// Delete Settings
//

#[derive(Debug, Deserialize)]
pub struct DeleteSettingsResponse {
    pub data: DeleteSettingsWrapper,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all(deserialize = "camelCase"))]
pub struct DeleteSettingsWrapper {
    pub delete_settings: Settings,
}

//
// Shared struct
//

#[derive(Debug, Deserialize)]
#[serde(rename_all(deserialize = "camelCase"))]
pub struct Settings {
    pub id: Uuid,
    pub settings_json: String,
}