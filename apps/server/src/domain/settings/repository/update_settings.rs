use sqlx::PgPool;
use uuid::Uuid;

use super::super::entities::Settings;
use super::super::error::Error;

impl super::Repository {
    pub async fn update_settings(
        &self,
        pool: &PgPool,
        id: Uuid,
        settings_json: String,
    ) -> Result<Settings, Error> {
        let now = chrono::Utc::now();

        let settings = sqlx::query_as::<_, Settings>(
            r#"
            UPDATE settings
            SET settings_json = $1, updated_at = $2
            WHERE id = $3
            RETURNING *
            "#,
        )
        .bind(settings_json)
        .bind(now)
        .bind(id)
        .fetch_one(pool)
        .await
        .map_err(Error::Database)?;

        Ok(settings)
    }
}
