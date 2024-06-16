use sqlx;
use uuid::Uuid;

use super::Repository;
use crate::{db::Queryer, domain::user::entities};

impl Repository {
    pub async fn delete_user<'c, C: Queryer<'c>>(
        &self,
        db: C,
        user_id: Uuid,
    ) -> Result<entities::User, crate::Error> {
        const QUERY: &str = "delete from user_ where id = $1 returning *";

        match sqlx::query_as::<_, entities::User>(QUERY)
            .bind(user_id)
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
