use uuid::Uuid;

use crate::domain::settings::model::CreateSettingsInput;

use super::super::entities::Settings;
use super::super::error::Error;

impl super::Service {
    pub async fn create_settings(
        &self,
        user_id: Uuid,
        input: CreateSettingsInput,
    ) -> Result<Settings, Error> {
        let settings = self
            .repo
            .create_settings(&self.db, user_id, input.settings_json)
            .await?;

        Ok(settings)
    }
}
