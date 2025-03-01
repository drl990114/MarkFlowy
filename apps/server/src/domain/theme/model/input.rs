use async_graphql::InputObject;
use frunk::LabelledGeneric;

use crate::scalar::Id;

#[derive(InputObject, LabelledGeneric)]
pub struct CreateThemeInput {
    pub name: String,

    pub npm_package_name: String,

    pub cover_image_url: String,
}

#[derive(InputObject, LabelledGeneric)]
pub struct UpdateThemeInput {
    pub id: Id,

    pub name: Option<String>,

    pub npm_package_name: Option<String>,

    pub cover_image_url: Option<String>,
}

#[derive(InputObject, LabelledGeneric)]
pub struct DeleteThemeInput {
    pub id: Id,
}
