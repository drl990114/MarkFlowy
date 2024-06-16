use anyhow::Result;

use axum::{
    body::Body,
    http::{self, Request, StatusCode},
};
use cynic::QueryBuilder;
use http_body_util::BodyExt; // for `collect`
use serde_json as json;
use mf_server::route::app;
use tower::util::ServiceExt;

use super::{graphql::queries::HealthQuery, schema::HealthResponse};

#[tokio::test]
async fn health() -> Result<()> {
    let app = app().await?;

    let query = HealthQuery::build(());
    let request = Request::builder()
        .method(http::Method::POST)
        .header(http::header::CONTENT_TYPE, mime::APPLICATION_JSON.as_ref())
        .uri("/graphql")
        .body(Body::from(json::to_string(&query)?))?;

    let response = app.oneshot(request).await?;
    assert_eq!(response.status(), StatusCode::OK);

    let body = response.into_body().collect().await?.to_bytes();
    let health_response: HealthResponse = json::from_slice(&body)?;
    assert_eq!(health_response.data.health.status, "running");

    Ok(())
}

#[tokio::test]
async fn health_restapi() -> Result<()> {
    let app = app().await?;

    let request = Request::builder().uri("/health").body(Body::empty())?;

    let response = app.oneshot(request).await?;
    assert_eq!(response.status(), StatusCode::OK);

    let body = response.into_body().collect().await?.to_bytes();
    let body: json::Value = json::from_slice(&body)?;
    assert_eq!(body, json::json!({ "data": { "status": "running" } }));
    Ok(())
}
