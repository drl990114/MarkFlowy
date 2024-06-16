use sqlx;

use super::Repository;
use crate::{
    db::Queryer,
    domain::user::{entities, Error},
};

impl Repository {
    pub async fn find_user_by_id<'c, C: Queryer<'c>>(
        &self,
        db: C,
        user_id: uuid::Uuid,
    ) -> Result<entities::User, crate::Error> {
        const QUERY: &str = "SELECT * FROM user_ WHERE id = $1";

        match sqlx::query_as::<_, entities::User>(QUERY)
            .bind(user_id)
            .fetch_optional(db)
            .await
        {
            Err(err) => {
                tracing::error!("{}", &err);
                Err(err.into())
            }
            Ok(None) => Err(Error::UserNotFound.into()),
            Ok(Some(res)) => Ok(res),
        }
    }
}
