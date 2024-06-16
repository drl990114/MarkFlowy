pub mod input;
use std::sync::Arc;

use async_graphql::{ComplexObject, Context, Result, SimpleObject};
use frunk::LabelledGeneric;
use frunk_core::labelled::Transmogrifier;
use sqlx::{postgres::PgRow, Row};

use crate::{
    context::ServerContext,
    domain::user::entities,
    relay::Base64Cursor,
    scalar::{Id, Time},
};

#[derive(Debug, SimpleObject, LabelledGeneric, Clone)]
pub struct User {
    /// The ID of the User.
    pub id: Id,
    pub created_at: Time,

    /// The email for the User.
    pub email: String,
    /// The name for the User.
    pub name: String,
    /// The full name for the User.
    pub password: String,
}

#[derive(Debug, SimpleObject, LabelledGeneric)]
pub struct UserEdge {
    // The item at the end of the edge.
    pub node: User,
    // A cursor for use in pagination.
    pub cursor: String,
}

impl User {
    pub fn new(
        id: Id,
        name: String,
        email: String,
        password: String,
        created_at: Time,
    ) -> User {
        User { id, name, email, password, created_at }
    }
}

impl From<PgRow> for User {
    fn from(value: PgRow) -> Self {
        let id: Id = value.get("id");
        User::new(
            id,
            value.get("name"),
            value.get("email"),
            value.get("password"),
            value.get("created_at"),
        )
    }
}

impl From<entities::User> for UserEdge {
    fn from(user: entities::User) -> Self {
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
pub struct UserConnection {
    // A list of edges.
    pub edges: Vec<UserEdge>,
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
pub struct PageInfo {
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
impl UserConnection {
    // Information to aid in pagination.
    async fn page_info(&self, ctx: &Context<'_>) -> Result<PageInfo> {
        let server_ctx = ctx.data::<Arc<ServerContext>>()?;
        let page_info = server_ctx
            .user_service
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
        let db = &server_ctx.user_service.db;

        let total_count_query = "select count(*) as exact_count from  user_";
        match sqlx::query(total_count_query).fetch_one(db).await {
            Err(err) => {
                tracing::error!("{}", &err);
                Err(err.into())
            }
            Ok(row) => Ok(row.get(0)),
        }
    }
}
