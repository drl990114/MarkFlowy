use sqlx;

use super::Repository;
use crate::{db::Queryer, domain::theme::entities};

impl Repository {
    pub async fn create_theme<'c, C: Queryer<'c>>(
        &self,
        db: C,
        theme: &entities::Theme,
    ) -> Result<entities::Theme, crate::Error> {
        const QUERY: &str = "insert into theme_ (id, created_at, updated_at,
                              name, author_id, author_name, npm_package_name, cover_image_url) values ($1, $2, $3, $4, $5, $6, $7, $8) returning *";

        match sqlx::query_as::<_, entities::Theme>(QUERY)
            .bind(theme.id)
            .bind(theme.created_at)
            .bind(theme.updated_at)
            .bind(&theme.name)
            .bind(&theme.author_id)
            .bind(&theme.author_name)
            .bind(&theme.npm_package_name)
            .bind(&theme.cover_image_url)
            .fetch_one(db)
            .await
        {
            Err(err) => {
                tracing::error!("{}", &err);
                Err(err.into())
            }
            Ok(user) => Ok(user),
        }
    }
}
