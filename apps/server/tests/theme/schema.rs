use serde::Deserialize;
use uuid::Uuid;

//
// Themes
//

#[derive(Debug, Deserialize)]
pub struct ThemesResponse {
    pub data: ThemeConnectionWrapper,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all(deserialize = "camelCase"))]
pub struct ThemeConnectionWrapper {
    pub themes: ThemeConnection,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all(deserialize = "camelCase"))]
pub struct ThemeConnection {
    pub total_count: i32,
    pub edges: Vec<ThemeEdge>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all(deserialize = "camelCase"))]
pub struct ThemeEdge {
    pub node: Theme,
    pub cursor: String,
}

//
// Create Theme
//

#[derive(Debug, Deserialize)]
pub struct CreateThemeResponse {
    pub data: CreateThemeWrapper,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all(deserialize = "camelCase"))]
pub struct CreateThemeWrapper {
    pub create_theme: Theme,
}

//
// Update Theme
//

#[derive(Debug, Deserialize)]
pub struct UpdateThemeResponse {
    pub data: UpdateThemeWrapper,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all(deserialize = "camelCase"))]
pub struct UpdateThemeWrapper {
    pub update_theme: Theme,
}

//
// Delete Theme
//

#[derive(Debug, Deserialize)]
pub struct DeleteThemeResponse {
    pub data: DeleteThemeWrapper,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all(deserialize = "camelCase"))]
pub struct DeleteThemeWrapper {
    pub delete_theme: Theme,
}

//
// Shared struct
//

#[derive(Debug, Deserialize)]
#[serde(rename_all(deserialize = "camelCase"))]
pub struct Theme {
    pub id: Uuid,
    pub name: String,
    pub npm_package_name: String,
    pub cover_image_url: String,
}