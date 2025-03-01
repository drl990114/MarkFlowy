use uuid::Uuid;

use super::Service;
use crate::domain::theme::entities;

impl Service {
    pub async fn find_theme_by_id(&self, id: Uuid) -> Result<entities::Theme, crate::Error> {
        let user = self.repo.find_theme_by_id(&self.db, id).await?;

        Ok(user)
    }
}
