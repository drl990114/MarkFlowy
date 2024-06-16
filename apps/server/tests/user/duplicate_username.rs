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

use super::{fake_user, graphql::update, teardown};
use super::{graphql::add, schema::CreateUserResponse};

#[tokio::test]
async fn duplicate_username_create() -> Result<()> {
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

    let _ = ServiceExt::<Request<Body>>::ready(&mut app)
        .await?
        .call(request)
        .await?;
    //
    // Create next user with the same name
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
    let body = response.into_body().collect().await?.to_bytes();
    let body: json::Value = json::from_slice(&body)?;
    let error_message = &body["errors"][0]["message"];
    assert_eq!(error_message, "username is already in use");

    teardown().await?;
    Ok(())
}

#[tokio::test]
async fn duplicate_username_update() -> Result<()> {
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

    //
    // Create second user
    //

    let args = add::CreateUserInput {
        name: "khawa1".to_string(),
        email: "khawa1@email.com".to_string(),
        password: "password".to_string(),
    };
    let query = add::UserMutation::build(args);

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
    let user_id = user_response.data.create_user.id;

    //
    // Update second user to the same name as first user
    //

    let user_id = update::Uuid(user_id.to_string());
    let args = update::UpdateUserInput {
        id: user_id,
        name: "khawa".to_string(),
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
    let body: json::Value = json::from_slice(&body)?;
    let error_message = &body["errors"][0]["message"];
    assert_eq!(error_message, "username is already in use");

    teardown().await?;
    Ok(())
}
