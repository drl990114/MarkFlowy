use uuid::Uuid;

use super::Service;
use crate::domain::user::entities;

impl Service {
    pub async fn delete_user(&self, user_id: Uuid) -> Result<entities::User, crate::Error> {
        let user = self.repo.delete_user(&self.db, user_id).await?;

        Ok(user)
    }
}
