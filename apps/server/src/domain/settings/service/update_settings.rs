use crate::domain::settings::model::UpdateSettingsInput;

use super::super::entities::Settings;
use super::super::error::Error;

impl super::Service {
    pub async fn update_settings(
        &self,
        input: UpdateSettingsInput,
    ) -> Result<Settings, Error> {
        let settings = self
            .repo
            .update_settings(&self.db, input.id, input.settings_json)
            .await?;

        Ok(settings.into())
    }
}
