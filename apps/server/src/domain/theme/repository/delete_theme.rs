use sqlx;
use uuid::Uuid;

use super::Repository;
use crate::{db::Queryer, domain::theme::entities};

impl Repository {
    pub async fn delete_theme<'c, C: Queryer<'c>>(
        &self,
        db: C,
        id: Uuid,
    ) -> Result<entities::Theme, crate::Error> {
        const QUERY: &str = "delete from theme_ where id = $1 returning *";

        match sqlx::query_as::<_, entities::Theme>(QUERY)
            .bind(id)
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
