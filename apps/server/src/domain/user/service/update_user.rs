use chrono::Utc;

use super::{Service, UpdateUserInput};
use crate::domain::user::{entities, Error};

impl Service {
    pub async fn update_user(
        &self,
        input: UpdateUserInput,
    ) -> Result<entities::User, crate::Error> {
        let username_exists = self.check_username_exists(&self.db, &input.name).await?;
        if username_exists {
            return Err(Error::UsernameAlreadyExists.into());
        }

        let user_input = entities::User {
            id: input.id,
            name: input.name,
            email: input.email,
            password: input.password,
            updated_at: Utc::now(),
            // FIXME
            created_at: Utc::now(),
        };

        let user = self.repo.update_user(&self.db, &user_input).await?;

        Ok(user)
    }
}
