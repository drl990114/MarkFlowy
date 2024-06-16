use serde::Deserialize;

use super::graphql::queries::Health;

#[derive(Debug, Deserialize)]
pub struct HealthResponse {
    pub data: HealthWrapper,
}

#[derive(Debug, Deserialize)]
pub struct HealthWrapper {
    pub health: Health,
}
