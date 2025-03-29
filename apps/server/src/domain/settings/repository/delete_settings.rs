use sqlx::PgPool;
use uuid::Uuid;

use super::super::error::Error;

impl super::Repository {
    pub async fn delete_settings(
        &self,
        pool: &PgPool,
        id: Uuid,
    ) -> Result<(), Error> {
        sqlx::query(
            r#"
            DELETE FROM settings
            WHERE id = $1
            "#,
        )
        .bind(id)
        .execute(pool)
        .await
        .map_err(Error::Database)?;

        Ok(())
    }
}