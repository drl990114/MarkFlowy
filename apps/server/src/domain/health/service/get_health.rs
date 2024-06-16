use super::Service;
use crate::domain::health::entities;

impl Service {
    pub async fn get_health(&self) -> Result<entities::Health, crate::Error> {
        let health = entities::Health {
            status: "running".to_string(),
        };
        Ok(health)
    }
}
