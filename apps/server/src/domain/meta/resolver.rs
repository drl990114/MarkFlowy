use std::sync::Arc;

use async_graphql::{Context, Error, FieldResult, Object};
use frunk_core::labelled::Transmogrifier;

use super::model;
use crate::context::ServerContext;

#[derive(Default)]
pub struct MetaQuery;

#[Object]
impl MetaQuery {
    pub async fn meta(&self, ctx: &Context<'_>) -> FieldResult<model::Meta> {
        let server_ctx = ctx.data::<Arc<ServerContext>>()?;

        let result = server_ctx.meta_service.get_meta().await;
        match result {
            Ok(res) => Ok(res.transmogrify()),
            Err(err) => Err(Error::new(err.to_string())),
        }
    }
}
