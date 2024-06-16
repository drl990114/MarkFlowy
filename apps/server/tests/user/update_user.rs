use anyhow::Result;
use axum::{
    body::Body,
    http::{self, Request, StatusCode},
};
use cynic::MutationBuilder;
use http_body_util::BodyExt;
use serde_json as json;
use mf_server::route::app;
use tower::{util::ServiceExt, Service};

use super::{fake_user, graphql::update::Uuid, teardown};
use super::{
    graphql::{add, update},
    schema::{CreateUserResponse, UpdateUserResponse},
};

#[tokio::test]
async fn update_user() -> Result<()> {
    let mut app = app().await?;
    //
    // Create User
    //

    let query = add::UserMutation::build(fake_user());

    let request = Request::builder()
        .method(http::Method::POST)
        .header(http::header::CONTENT_TYPE, mime::APPLICATION_JSON.as_ref())
        .uri("/graphql")
        .body(Body::from(json::to_string(&query)?))?;

    let response = ServiceExt::<Request<Body>>::ready(&mut app)
        .await?
        .call(request)
        .await?;
    assert_eq!(response.status(), StatusCode::OK);

    let body = response.into_body().collect().await?.to_bytes();
    let user_response: CreateUserResponse = json::from_slice(&body)?;
    assert_eq!(user_response.data.create_user.name, "khawa");

    let user_id = user_response.data.create_user.id;

    //
    // Update User
    //
    let user_id = Uuid(user_id.to_string());

    let args = update::UpdateUserInput {
        id: user_id,
        name: "haitham".to_string(),
        email: "haitam@email.com".to_string(),
        password: "password".to_string(),
    };
    let query = update::UserMutation::build(args);

    let request = Request::builder()
        .method(http::Method::POST)
        .header(http::header::CONTENT_TYPE, mime::APPLICATION_JSON.as_ref())
        .uri("/graphql")
        .body(Body::from(json::to_string(&query)?))?;

    let response = ServiceExt::<Request<Body>>::ready(&mut app)
        .await?
        .call(request)
        .await?;
    let body = response.into_body().collect().await?.to_bytes();
    let user_response: UpdateUserResponse = json::from_slice(&body)?;

    assert_eq!(user_response.data.update_user.name, "haitham");

    teardown().await?;
    Ok(())
}
