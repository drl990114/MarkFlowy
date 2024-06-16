use async_graphql::SimpleObject;
use frunk::LabelledGeneric;
use serde::Serialize;
use utoipa::ToSchema;

#[derive(Debug, SimpleObject, Serialize, ToSchema, LabelledGeneric)]
pub struct Health {
    pub status: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct HealthResponse {
    pub data: Health,
}
