use uuid::Uuid;

use super::super::entities::Settings;
use super::super::error::Error;

impl super::Service {
    pub async fn find_settings_by_user_id(
        &self,
        user_id: Uuid,
    ) -> Result<Settings, Error> {
        let settings = self
            .repo
            .find_settings_by_user_id(&self.db, user_id)
            .await?;

        Ok(settings)
    }
}
