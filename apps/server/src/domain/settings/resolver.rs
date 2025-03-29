use async_graphql::{Context, Object, Result};
use uuid::Uuid;

use super::{
    entities::Settings,
    error::Error,
    model::input::{CreateSettingsInput, DeleteSettingsInput, UpdateSettingsInput},
    service::Service,
};

#[derive(Default)]
pub struct SettingsQuery;

#[Object]
impl SettingsQuery {
    async fn settings(&self, ctx: &Context<'_>, user_id: Uuid) -> Result<Settings, Error> {
        let service = ctx.data::<Service>()?;
        service.find_settings_by_user_id(user_id).await
    }
}

#[derive(Default)]
pub struct SettingsMutation;

#[Object]
impl SettingsMutation {
    async fn create_settings(
        &self,
        ctx: &Context<'_>,
        user_id: Uuid,
        input: CreateSettingsInput,
    ) -> Result<Settings, Error> {
        let service = ctx.data::<Service>()?;
        service.create_settings(user_id, input).await
    }

    async fn update_settings(
        &self,
        ctx: &Context<'_>,
        input: UpdateSettingsInput,
    ) -> Result<Settings, Error> {
        let service = ctx.data::<Service>()?;
        service.update_settings(input).await
    }

    async fn delete_settings(
        &self,
        ctx: &Context<'_>,
        input: DeleteSettingsInput,
    ) -> Result<bool, Error> {
        let service = ctx.data::<Service>()?;
        service.delete_settings(input.id).await?;
        Ok(true)
    }
}
