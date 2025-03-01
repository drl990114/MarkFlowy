use uuid::Uuid;

use super::Service;
use crate::domain::theme::entities;

impl Service {
    pub async fn delete_theme(&self, theme_id: Uuid) -> Result<entities::Theme, crate::Error> {
        let user = self.repo.delete_theme(&self.db, theme_id).await?;

        Ok(user)
    }
}
