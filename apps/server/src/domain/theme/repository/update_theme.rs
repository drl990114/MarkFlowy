use sqlx;

use super::Repository;
use crate::{db, domain::theme::entities};

impl Repository {
    pub async fn update_theme<'c, C: db::Queryer<'c>>(
        &self,
        db: C,
        theme: &entities::Theme,
    ) -> Result<entities::Theme, crate::Error> {
        const QUERY: &str = "update theme_ set
              updated_at = $2,
              name = $3,
              npm_package_name = $4,
              cover_image_url = $5
           where id = $1 returning *";

        match sqlx::query_as::<_, entities::Theme>(QUERY)
            .bind(theme.id)
            .bind(theme.updated_at)
            .bind(&theme.name)
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
