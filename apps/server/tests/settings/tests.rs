use cynic::http::ReqwestExt;
use cynic::QueryBuilder;
use reqwest::Client;
use uuid::Uuid;

use super::graphql::add::{CreateSettingsInput, SettingsMutation as CreateSettingsMutation};
use super::graphql::delete::{DeleteSettingsInput, SettingsMutation as DeleteSettingsMutation};
use super::graphql::queries::{ReadSettingsArguments, SettingsQuery};
use super::graphql::update::{SettingsMutation as UpdateSettingsMutation, UpdateSettingsInput};
use super::schema::{CreateSettingsResponse, DeleteSettingsResponse, SettingsResponse, UpdateSettingsResponse};

#[tokio::test]
async fn test_settings_crud() {
    let client = Client::new();

    // Create settings
    let settings_json = serde_json::json!({
        "theme": "dark",
        "fontSize": 14,
        "lineHeight": 1.6,
        "fontFamily": "Roboto Mono"
    }).to_string();

    let create_op = CreateSettingsMutation::build(
        CreateSettingsInput {
            settings_json: settings_json.clone(),
        },
    );

    let create_resp = client
        .post("http://localhost:8000/graphql")
        .run_graphql(create_op)
        .await
        .unwrap();
    let create_data: CreateSettingsResponse = serde_json::from_slice(&create_resp.bytes().await.unwrap()).unwrap();
    let settings_id = create_data.data.create_settings.id;

    // Verify JSON deserialization
    let stored_settings: serde_json::Value = serde_json::from_str(&create_data.data.create_settings.settings_json).unwrap();
    assert_eq!(stored_settings["theme"], "dark");
    assert_eq!(stored_settings["fontSize"], 14);

    // Query settings
    let query_op = SettingsQuery::build(ReadSettingsArguments {
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
    let query_data: SettingsResponse = serde_json::from_slice(&query_resp.bytes().await.unwrap()).unwrap();
    assert!(query_data.data.settings.total_count > 0);

    // Update settings
    let updated_settings_json = serde_json::json!({
        "theme": "light",
        "fontSize": 16,
        "lineHeight": 1.8,
        "fontFamily": "JetBrains Mono"
    }).to_string();

    let update_op = UpdateSettingsMutation::build(
        UpdateSettingsInput {
            id: cynic::Uuid(settings_id.to_string()),
            settings_json: updated_settings_json.clone(),
        },
    );

    let update_resp = client
        .post("http://localhost:8000/graphql")
        .run_graphql(update_op)
        .await
        .unwrap();
    let update_data: UpdateSettingsResponse = serde_json::from_slice(&update_resp.bytes().await.unwrap()).unwrap();
    
    // Verify updated JSON
    let updated_stored_settings: serde_json::Value = serde_json::from_str(&update_data.data.update_settings.settings_json).unwrap();
    assert_eq!(updated_stored_settings["theme"], "light");
    assert_eq!(updated_stored_settings["fontSize"], 16);

    // Delete settings
    let delete_op = DeleteSettingsMutation::build(
        DeleteSettingsInput {
            id: cynic::Uuid(settings_id.to_string()),
        },
    );

    let delete_resp = client
        .post("http://localhost:8000/graphql")
        .run_graphql(delete_op)
        .await
        .unwrap();
    let _delete_data: DeleteSettingsResponse = serde_json::from_slice(&delete_resp.bytes().await.unwrap()).unwrap();
}