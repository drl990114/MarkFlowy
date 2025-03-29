use sqlx::PgPool;
use uuid::Uuid;

use crate::domain::settings::entities::Settings;

use super::super::error::Error;

impl super::Repository {
    pub async fn create_settings(
        &self,
        pool: &PgPool,
        user_id: Uuid,
        settings_json: String,
    ) -> Result<Settings, Error> {
        let id = Uuid::new_v4();
        let now = chrono::Utc::now();

        let settings = sqlx::query_as::<_, Settings>(
            r#"
            INSERT INTO settings (id, user_id, settings_json, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(user_id)
        .bind(settings_json)
        .bind(now)
        .bind(now)
        .fetch_one(pool)
        .await
        .map_err(Error::Database)?;

        Ok(settings)
    }
}
