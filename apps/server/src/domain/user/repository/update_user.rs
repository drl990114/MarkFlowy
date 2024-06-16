use sqlx;

use super::Repository;
use crate::{db, domain::user::entities};

impl Repository {
    pub async fn update_user<'c, C: db::Queryer<'c>>(
        &self,
        db: C,
        user: &entities::User,
    ) -> Result<entities::User, crate::Error> {
        const QUERY: &str = "update user_ set
              updated_at = $2,
              name = $3,
              email = $4,
              password = COALESCE($5, password)
           where id = $1 returning *";

        match sqlx::query_as::<_, entities::User>(QUERY)
            .bind(user.id)
            .bind(user.updated_at)
            //
            .bind(&user.name)
            .bind(&user.email)
            .bind(&user.password)
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
