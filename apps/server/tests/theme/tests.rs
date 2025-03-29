use cynic::http::ReqwestExt;
use cynic::QueryBuilder;
use reqwest::Client;
use uuid::Uuid;

use super::graphql::add::{CreateThemeInput, ThemeMutation as CreateThemeMutation};
use super::graphql::delete::{DeleteThemeInput, ThemeMutation as DeleteThemeMutation};
use super::graphql::queries::{ReadThemesArguments, ThemesQuery};
use super::graphql::update::{ThemeMutation as UpdateThemeMutation, UpdateThemeInput};
use super::schema::{CreateThemeResponse, DeleteThemeResponse, ThemesResponse, UpdateThemeResponse};

#[tokio::test]
async fn test_theme_crud() {
    let client = Client::new();

    // Create theme
    let create_op = CreateThemeMutation::build(
        CreateThemeInput {
            name: "Test Theme".to_string(),
            npm_package_name: "@markflowy/test-theme".to_string(),
            cover_image_url: "https://example.com/theme.png".to_string(),
        },
    );

    let create_resp = client
        .post("http://localhost:8000/graphql")
        .run_graphql(create_op)
        .await
        .unwrap();
    let create_data: CreateThemeResponse = serde_json::from_slice(&create_resp.bytes().await.unwrap()).unwrap();
    let theme_id = create_data.data.create_theme.id;

    // Query themes
    let query_op = ThemesQuery::build(ReadThemesArguments {
        first: Some(10),
        after: None,
        last: None,
        before: None,
    });

    let query_resp = client
        .post("http://localhost:8000/graphql")
        .run_graphql(query_op)
        .await
        .unwrap();
    let query_data: ThemesResponse = serde_json::from_slice(&query_resp.bytes().await.unwrap()).unwrap();
    assert!(query_data.data.themes.total_count > 0);

    // Update theme
    let update_op = UpdateThemeMutation::build(
        UpdateThemeInput {
            id: cynic::Uuid(theme_id.to_string()),
            name: Some("Updated Theme".to_string()),
            npm_package_name: Some("@markflowy/updated-theme".to_string()),
            cover_image_url: Some("https://example.com/updated-theme.png".to_string()),
        },
    );

    let update_resp = client
        .post("http://localhost:8000/graphql")
        .run_graphql(update_op)
        .await
        .unwrap();
    let update_data: UpdateThemeResponse = serde_json::from_slice(&update_resp.bytes().await.unwrap()).unwrap();
    assert_eq!(update_data.data.update_theme.name, "Updated Theme");

    // Delete theme
    let delete_op = DeleteThemeMutation::build(
        DeleteThemeInput {
            id: cynic::Uuid(theme_id.to_string()),
        },
    );

    let delete_resp = client
        .post("http://localhost:8000/graphql")
        .run_graphql(delete_op)
        .await
        .unwrap();
    let _delete_data: DeleteThemeResponse = serde_json::from_slice(&delete_resp.bytes().await.unwrap()).unwrap();
}