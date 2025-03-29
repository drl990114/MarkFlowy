use uuid::Uuid;

use super::Service;
use crate::domain::settings::error::Error;

impl Service {
    pub async fn delete_settings(&self, id: Uuid) -> Result<(), Error> {
        self.repo.delete_settings(&self.db, id).await?;
        Ok(())
    }
}
