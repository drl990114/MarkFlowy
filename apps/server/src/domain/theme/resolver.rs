use std::sync::Arc;

use async_graphql::{Context, Error, FieldResult, Object};
use frunk_core::labelled::Transmogrifier;
use uuid::Uuid;

use super::model::{self};
use crate::{context::ServerContext, scalar::Id};

#[derive(Default)]
pub struct ThemeQuery;

#[Object]
impl ThemeQuery {
    pub async fn themes(
        &self,
        ctx: &Context<'_>,
        first: Option<i32>,
        after: Option<String>,
        last: Option<i32>,
        before: Option<String>,
    ) -> FieldResult<model::ThemeConnection> {
        let server_ctx = ctx.data::<Arc<ServerContext>>()?;
        let theme_edges = server_ctx
            .theme_service
            .find_themes(first, after.as_deref(), last, before.as_deref())
            .await?;
        let edges: Vec<model::ThemeEdge> = theme_edges
            .into_iter()
            .map(frunk::labelled::Transmogrifier::transmogrify)
            .collect();

        let user_connection = model::ThemeConnection {
            edges,
            //
            after,
            before,
            first,
            last,
        };

        Ok(user_connection)
    }
    pub async fn theme(&self, ctx: &Context<'_>, id: Uuid) -> FieldResult<model::Theme> {
        let server_ctx = ctx.data::<Arc<ServerContext>>()?;

        let result = server_ctx.theme_service.find_theme_by_id(id).await;
        match result {
            Ok(res) => Ok(res.transmogrify()),
            Err(err) => Err(Error::new(err.to_string())),
        }
    }
}

#[derive(Default)]
pub struct ThemeMutation;

#[Object]
impl ThemeMutation {
    pub async fn create_theme(
        &self,
        ctx: &Context<'_>,
        input: model::input::CreateThemeInput,
    ) -> FieldResult<model::Theme> {
        let server_ctx = ctx.data::<Arc<ServerContext>>()?;

        let result = server_ctx
            .theme_service
            .create_theme(ctx, input.transmogrify())
            .await;
        match result {
            Ok(res) => Ok(res.transmogrify()),
            Err(err) => Err(Error::new(err.to_string())),
        }
    }
    pub async fn update_theme(
        &self,
        ctx: &Context<'_>,
        input: model::input::UpdateThemeInput,
    ) -> FieldResult<model::Theme> {
        let server_ctx = ctx.data::<Arc<ServerContext>>()?;

        let result = server_ctx
            .theme_service
            .update_theme(ctx, input)
            .await;
        match result {
            Ok(res) => Ok(res.transmogrify()),
            Err(err) => Err(Error::new(err.to_string())),
        }
    }
    pub async fn delete_theme(&self, ctx: &Context<'_>, id: Id) -> FieldResult<model::Theme> {
        let server_ctx = ctx.data::<Arc<ServerContext>>()?;

        let result = server_ctx.theme_service.delete_theme(id).await;
        match result {
            Ok(res) => Ok(res.transmogrify()),
            Err(err) => Err(Error::new(err.to_string())),
        }
    }
}
