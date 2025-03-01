use sqlx;

use super::Repository;
use crate::{
    db::Queryer,
    domain::theme::{entities, Error},
};

impl Repository {
    pub async fn find_theme_by_id<'c, C: Queryer<'c>>(
        &self,
        db: C,
        user_id: uuid::Uuid,
    ) -> Result<entities::Theme, crate::Error> {
        const QUERY: &str = "SELECT * FROM theme_ WHERE id = $1";

        match sqlx::query_as::<_, entities::Theme>(QUERY)
            .bind(user_id)
            .fetch_optional(db)
            .await
        {
            Err(err) => {
                tracing::error!("{}", &err);
                Err(err.into())
            }
            Ok(None) => Err(Error::NotFound.into()),
            Ok(Some(res)) => Ok(res),
        }
    }
}
