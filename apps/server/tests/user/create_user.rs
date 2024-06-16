use anyhow::Result;
use axum::{
    body::Body,
    http::{self, Request, StatusCode},
};
use cynic::MutationBuilder;
use http_body_util::BodyExt; // for `collect`
use serde_json as json;
use mf_server::route::app;
use tower::util::ServiceExt;

use super::{fake_user, teardown};
use super::{graphql::add, schema::CreateUserResponse};

#[tokio::test]
async fn create_user() -> Result<()> {
    let app = app().await?;

    let query = add::UserMutation::build(fake_user());

    let request = Request::builder()
        .method(http::Method::POST)
        .header(http::header::CONTENT_TYPE, mime::APPLICATION_JSON.as_ref())
        .uri("/graphql")
        .body(Body::from(json::to_string(&query)?))?;

    let response = app.oneshot(request).await?;
    assert_eq!(response.status(), StatusCode::OK);

    let body = response.into_body().collect().await?.to_bytes();
    let user_response: CreateUserResponse = json::from_slice(&body)?;
    assert_eq!(user_response.data.create_user.name, "khawa");

    teardown().await?;
    Ok(())
}
