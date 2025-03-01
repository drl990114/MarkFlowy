use async_graphql::Context;
use axum::Extension;
use chrono::Utc;

use super::Service;
use crate::domain::{theme::{entities, model}, user::model::User};

impl Service {
    pub async fn update_theme(
        &self,
        ctx: &Context<'_>,
        input: model::input::UpdateThemeInput,
    ) -> Result<entities::Theme, crate::Error> {
        let user = ctx.data::<Extension<User>>().unwrap();

        let old = self.repo.find_theme_by_id(&self.db, input.id).await?;

        let new_theme = entities::Theme {
            id: input.id,
            name: input.name.unwrap_or(old.name.clone()),
            author_id: user.id,
            author_name: user.name.clone(),
            npm_package_name: input.npm_package_name.unwrap_or(old.npm_package_name.clone()),
            cover_image_url: input.cover_image_url.unwrap_or(old.cover_image_url.clone()),
            created_at: old.created_at,
            updated_at: Utc::now(),
        };

        let user = self.repo.update_theme(&self.db, &new_theme).await?;

        Ok(user)
    }
}
