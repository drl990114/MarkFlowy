use sqlx::PgPool;
use uuid::Uuid;

use super::super::entities::Settings;
use super::super::error::Error;

impl super::Repository {
    pub async fn find_settings_by_user_id(
        &self,
        pool: &PgPool,
        user_id: Uuid,
    ) -> Result<Settings, Error> {
        let settings = sqlx::query_as::<_, Settings>(
            r#"
            SELECT *
            FROM settings
            WHERE user_id = $1
            "#,
        )
        .bind(user_id)
        .fetch_one(pool)
        .await
        .map_err(|e| {
            match e {
                sqlx::Error::RowNotFound => Error::NotFound,
                other => Error::Database(other),
            }
        })?;

        Ok(settings)
    }
}
