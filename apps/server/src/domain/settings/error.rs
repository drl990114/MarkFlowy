use thiserror::Error;

#[derive(Debug, Error)]
pub enum Error {
    #[error("Settings not found")]
    NotFound,

    #[error("Invalid settings JSON format")]
    InvalidSettingsFormat,

    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("Internal error: {0}")]
    Internal(String),
}

impl From<async_graphql::Error> for Error {
    fn from(err: async_graphql::Error) -> Self {
        Error::Internal(format!("{:?}", err))
    }
}
