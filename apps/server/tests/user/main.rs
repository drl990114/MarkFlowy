use std::sync::Arc;

use anyhow::Result;
use mf_server::{config::Config, db};

mod graphql;
pub mod schema;
//
mod create_user;
mod delete_user;
mod duplicate_username;
mod find_user;
mod relay;
mod update_user;

async fn teardown() -> Result<()> {
    let config = Arc::new(Config::load()?);
    let conn = db::connect(&config.database).await?;
    sqlx::query("delete from user_").execute(&conn).await?;

    Ok(())
}

fn fake_user() -> graphql::add::CreateUserInput {
    graphql::add::CreateUserInput {
        name: "khawa".to_string(),
        email: "khawa@email.com".to_string(),
        password: "password".to_string(),
    }
}
