use super::Service;
use crate::{domain::user::{entities, model::{self, User}}, utils::crypto};

use async_graphql::Context;
use axum::Extension;
use chrono::Utc;
impl Service {
    pub async fn update_user(
        &self,
        ctx: &Context<'_>,
        input: model::input::UpdateUserInput,
    ) -> Result<entities::User, crate::Error> {
        let user = ctx.data::<Extension<User>>().unwrap();

        let mut new_user = entities::User {
            id: user.id,
            name: input.name.unwrap_or(user.name.clone()),
            email: input.email.unwrap_or(user.email.clone()),
            password: user.password.clone(),
            created_at: user.created_at,
            updated_at: Utc::now(),
        };

        if let Some(password) = input.password {
            let hash = crypto::hash(password).await;

            if let Err(e) = hash {
                return Err(crate::Error::Internal(e.to_string()));
            }

            let hash = hash.unwrap();
            new_user.password = hash;
        }

        let user = self.repo.update_user(&self.db, &new_user).await?;

        Ok(user)
    }
}
