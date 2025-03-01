use chrono::Utc;
use ulid::Ulid;

use super::{CreateUserInput, Service};
use crate::domain::user::{entities, Error};

impl Service {
    pub async fn create_user(
        &self,
        input: CreateUserInput,
    ) -> Result<entities::User, crate::Error> {
        let user_input = entities::User {
            id: Ulid::new().into(),
            name: input.name,
            email: input.email,
            password: input.password,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        let user = self.repo.create_user(&self.db, &user_input).await?;
        self.notify_user(&user.email).await?;

        Ok(user)
    }
}
