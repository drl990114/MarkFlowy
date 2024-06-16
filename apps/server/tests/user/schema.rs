use serde::Deserialize;
use uuid::Uuid;

//
// Users
//

#[derive(Debug, Deserialize)]
pub struct UsersResponse {
    pub data: UserConnectionWrapper,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all(deserialize = "camelCase"))]
pub struct UserConnectionWrapper {
    pub users: UserConnection,
}
#[derive(Debug, Deserialize)]
#[serde(rename_all(deserialize = "camelCase"))]
pub struct UserConnection {
    pub total_count: i32,
    pub edges: Vec<UserEdge>,
}
#[derive(Debug, Deserialize)]
#[serde(rename_all(deserialize = "camelCase"))]
pub struct UserEdge {
    pub node: User,
    pub cursor: String,
}

//
// Create User
//

#[derive(Debug, Deserialize)]
pub struct CreateUserResponse {
    pub data: CreateUserWrapper,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all(deserialize = "camelCase"))]
pub struct CreateUserWrapper {
    pub create_user: User,
}

//
// Update User
//

#[derive(Debug, Deserialize)]
pub struct UpdateUserResponse {
    pub data: UpdateUserWrapper,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all(deserialize = "camelCase"))]
pub struct UpdateUserWrapper {
    pub update_user: User,
}

//
// Update User
//

#[derive(Debug, Deserialize)]
pub struct DeleteUserResponse {
    pub data: DeleteUserWrapper,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all(deserialize = "camelCase"))]
pub struct DeleteUserWrapper {
    pub delete_user: User,
}

//
// Shared struct
//

#[derive(Debug, Deserialize)]
#[serde(rename_all(deserialize = "camelCase"))]
// To match GraphQL response field camelCase,
// we use `serde::rename_all` to change our Rust struct field into camelCae.
pub struct User {
    pub id: Uuid,
    pub name: String,
    pub password: String,
}
