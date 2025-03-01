use sqlx;

use super::Repository;
use crate::{
    db::Queryer,
    domain::user::{entities, Error},
};

impl Repository {
    pub async fn find_user_by_email<'c, C: Queryer<'c>>(
        &self,
        db: C,
        email: &str,
    ) -> Result<entities::User, crate::Error> {
        const QUERY: &str = "SELECT * FROM user_ WHERE email = $1";

        match sqlx::query_as::<_, entities::User>(QUERY)
            .bind(email)
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
