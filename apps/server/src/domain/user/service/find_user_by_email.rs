use super::Service;
use crate::domain::user::entities;

impl Service {
    pub async fn find_user_by_email(&self, email: &str) -> Result<entities::User, crate::Error> {
        let user = self.repo.find_user_by_email(&self.db, email).await?;

        Ok(user)
    }
}
