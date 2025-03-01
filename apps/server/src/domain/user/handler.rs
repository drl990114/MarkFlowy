use std::sync::Arc;

use axum::{
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use validator::Validate;

use crate::{context::ServerContext, domain::user::entities::User, route::AppState, utils::{crypto, jwt}};


#[derive(Validate, Clone)]
pub struct AppContext {
    pub state: Arc<AppState>,
    pub service: Arc<ServerContext>
}

#[derive(Debug, Serialize, Deserialize, Validate)]
pub struct CreateUserDto {
    pub name: String,
    pub email: String,
    #[validate(length(min = 6, max = 128))]
    pub password: String,
}

pub async fn create_user(
    State(app_context): State<AppContext>,
    Json(body): Json<CreateUserDto>,
) -> impl IntoResponse {
    if let Err(e) = body.validate() {
        return Err((StatusCode::BAD_REQUEST, e.to_string()));
    }

    let state = app_context.state.clone();

    let email_exist = app_context.service.user_service.check_useremail_exist(body.email.as_str()).await;

    match email_exist {
        Ok(true) => return Err((StatusCode::NOT_FOUND, "Email has been registered".to_string())),
        Ok(false) => (),
        Err(e) => return Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string())),
    }

    let password = body.password.to_string();
    let hash = crypto::hash(password).await;

    if let Err(e) = hash {
        return Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string()));
    }
    let hash = hash.unwrap();

    let res = sqlx::query_as!(
        User,
        "INSERT INTO user_ (name, email, password) VALUES ($1, $2, $3) RETURNING *",
        body.name.to_string(),
        body.email.to_string(),
        hash
    )
    .fetch_one(&state.db)
    .await;

    match res {
        Ok(user) => Ok((
            StatusCode::CREATED,
            Json(json!({ "status": "success", "data": user })),
        )),
        Err(e) => return Err((StatusCode::NOT_FOUND, e.to_string())),
    }
}


#[derive(Debug, Serialize, Deserialize, Validate)]
pub struct LoginDto {
    pub email: String,
    pub password: String,
}

pub async fn login(
    State(app_context): State<AppContext>,
    Json(body): Json<LoginDto>,
) -> impl IntoResponse {
    if let Err(e) = body.validate() {
        return Err((StatusCode::BAD_REQUEST, e.to_string()));
    }

    let email = body.email.to_string();

    let email_exist = app_context.service.user_service.check_useremail_exist(email.as_str()).await;

    match email_exist {
        Ok(true) => (),
        Ok(false) => return Err((StatusCode::NOT_FOUND, "User with email does not exist".to_string())),
        Err(e) => return Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string())),
    }

    let res = app_context.service.user_service.find_user_by_email(email.as_str()).await;

    match res {
        Ok(user) => {
            let password = body.password.to_string();
            let hash = user.password;

            let token = jwt::sign(user.id).unwrap();

            match crypto::verify(password, hash).await {
                Ok(true) => Ok((StatusCode::OK, Json(json!({ "status": "success", "token": token })))),
                Ok(false) => Err((StatusCode::UNAUTHORIZED, "Invalid password".to_string())),
                Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string())),
            }
        }
        Err(_) => Err((
            StatusCode::NOT_FOUND,
            "User with email does not exist".to_string(),
        )),
    }
}
