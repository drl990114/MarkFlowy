use async_graphql::Context;
use axum::Extension;
use chrono::Utc;
use ulid::Ulid;

use super::{CreateThemeInput, Service};
use crate::domain::{theme::entities, user::model::User};

impl Service {
    pub async fn create_theme(
        &self,
        ctx: &Context<'_>,
        input: CreateThemeInput,
    ) -> Result<entities::Theme, crate::Error> {
        let user = ctx.data::<Extension<User>>().unwrap();

        let new_theme = entities::Theme {
            id: Ulid::new().into(),
            name: input.name,
            npm_package_name: input.npm_package_name,
            cover_image_url: input.cover_image_url,
            author_id: user.id,
            author_name: user.name.clone(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        let theme = self.repo.create_theme(&self.db, &new_theme).await?;

        Ok(theme)
    }
}
