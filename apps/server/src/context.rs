use std::sync::Arc;

use crate::domain::{health, meta, theme, user};

#[derive(Clone)]
pub struct ServerContext {
    pub user_service: Arc<user::Service>,
    pub theme_service: Arc<theme::Service>,
    pub meta_service: Arc<meta::Service>,
    pub health_service: Arc<health::Service>,
}
