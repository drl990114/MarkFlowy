use anyhow::Result;
use axum::{
    body::Body,
    http::{self, Request, StatusCode},
};
use cynic::{MutationBuilder, QueryBuilder};
use http_body_util::BodyExt;
use serde_json as json;
use mf_server::route::app;
use tower::{util::ServiceExt, Service};

use super::{fake_user, teardown};
use super::{
    graphql::{
        add, delete, queries,
        queries::{ReadUserArguments, UserQuery},
    },
    schema::CreateUserResponse,
};

#[tokio::test]
async fn delete_user() -> Result<()> {
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

    let user_id_str = delete::Uuid(user_id.to_string());
    let args = delete::DeleteUserArguments { id: user_id_str };
    let query = delete::UserMutation::build(args);

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
    // Make sure user deleted
    //
    let args = ReadUserArguments {
        id: queries::Uuid(user_id.to_string()),
    };
    let query = UserQuery::build(args);

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
    assert_eq!(error_message, "user not found");

    teardown().await?;
    Ok(())
}
