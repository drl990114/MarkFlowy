pub mod input;
use std::sync::Arc;

use async_graphql::{ComplexObject, Context, Result, SimpleObject};
use frunk::LabelledGeneric;
use frunk_core::labelled::Transmogrifier;
use sqlx::{postgres::PgRow, Row};
use uuid::Uuid;

use crate::{
    context::ServerContext,
    domain::theme::entities,
    relay::Base64Cursor,
    scalar::{Id, Time},
};

#[derive(Debug, SimpleObject, LabelledGeneric, Clone)]
pub struct Theme {
    pub id: Id,
    pub name: String,
    pub author_id: Uuid,
    pub author_name: String,
    pub npm_package_name: String,
    pub cover_image_url: String,
    pub created_at: Time,
}

#[derive(Debug, SimpleObject, LabelledGeneric, Clone)]
pub struct ThemeOutput {
    pub id: Id,
    pub name: String,
    pub author_id: Uuid,
    pub author_name: String,
    pub author_email: String,
    pub npm_package_name: String,
    pub cover_image_url: String,
    pub created_at: Time,
    pub updated_at: Time
}

#[derive(Debug, SimpleObject, LabelledGeneric)]
pub struct ThemeEdge {
    // The item at the end of the edge.
    pub node: ThemeOutput,
    // A cursor for use in pagination.
    pub cursor: String,
}

impl Theme {
    pub fn new(
        id: Id,
        name: String,
        author_id: Uuid,
        author_name: String,
        npm_package_name: String,
        cover_image_url: String,
        created_at: Time,
    ) -> Theme {
        Theme { id, name, author_id, author_name, npm_package_name, cover_image_url, created_at }
    }
}

impl From<PgRow> for Theme {
    fn from(value: PgRow) -> Self {
        let id: Id = value.get("id");
        Theme::new(
            id,
            value.get("name"),
            value.get("author_id"),
            value.get("author_name"),
            value.get("npm_package_name"),
            value.get("cover_image_url"),
            value.get("created_at"),
        )
    }
}

impl From<entities::ThemeOutput> for ThemeEdge {
    fn from(user: entities::ThemeOutput) -> Self {
        let cursor = Base64Cursor::new(user.id).encode();
        let user_model = user.transmogrify();
        Self {
            node: user_model,
            cursor,
        }
    }
}

#[derive(Debug, SimpleObject)]
#[graphql(complex)]
pub struct ThemeConnection {
    // A list of edges.
    pub edges: Vec<ThemeEdge>,
    //
    // helper
    //
    #[graphql(skip)]
    pub after: Option<String>,
    #[graphql(skip)]
    pub before: Option<String>,
    #[graphql(skip)]
    pub first: Option<i32>,
    #[graphql(skip)]
    pub last: Option<i32>,
}

#[derive(Debug, SimpleObject, LabelledGeneric)]
pub struct ThemePageInfo {
    // When paginating forwards, the cursor to continue.
    pub end_cursor: Option<String>,
    // When paginating forwards, are there more items?
    pub has_next_page: bool,
    // When paginating backwards, the cursor to continue.
    pub start_cursor: Option<String>,
    // When paginating backwards, are there more items?
    pub has_previous_page: bool,
}

#[ComplexObject]
impl ThemeConnection {
    // Information to aid in pagination.
    async fn page_info(&self, ctx: &Context<'_>) -> Result<ThemePageInfo> {
        let server_ctx = ctx.data::<Arc<ServerContext>>()?;
        let page_info = server_ctx
            .theme_service
            .find_page_info(
                self.first,
                self.after.as_deref(),
                self.last,
                self.before.as_deref(),
            )
            .await?;
        Ok(page_info.transmogrify())
    }
    // Identifies the total count of items in the connection.
    async fn total_count(&self, ctx: &Context<'_>) -> Result<i64> {
        let server_ctx = ctx.data::<Arc<ServerContext>>()?;
        let db = &server_ctx.theme_service.db;

        let total_count_query = "select count(*) as exact_count from theme_";
        match sqlx::query(total_count_query).fetch_one(db).await {
            Err(err) => {
                tracing::error!("{}", &err);
                Err(err.into())
            }
            Ok(row) => Ok(row.get(0)),
        }
    }
}
