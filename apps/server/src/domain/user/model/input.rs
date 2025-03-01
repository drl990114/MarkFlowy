use async_graphql::InputObject;
use frunk::LabelledGeneric;

use crate::scalar::Id;

#[derive(InputObject, LabelledGeneric)]
pub struct CreateUserInput {
    /// The name for the User.
    pub name: String,
    /// The email for the User.
    pub email: String,
    /// The full name for the User.
    pub password: String,
}

#[derive(InputObject, LabelledGeneric)]
pub struct UpdateUserInput {
    /// The email for the User.
    pub email: Option<String>,
    /// The name for the User.
    pub name: Option<String>,
    /// The full name for the User.
    pub password: Option<String>,
}

#[derive(InputObject, LabelledGeneric)]
pub struct DeleteUserInput {
    pub user_id: Id,
}
