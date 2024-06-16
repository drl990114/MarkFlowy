pub mod app;

use thiserror::Error;

use crate::relay;

#[derive(Error, Debug, Clone)]
pub enum Error {
    #[error("Internal error")]
    Internal(String),

    #[error("{0}")]
    NotFound(String),

    #[error("{0}")]
    PermissionDenied(String),

    #[error("{0}")]
    InvalidArgument(String),

    #[error("{0}")]
    AlreadyExists(String),
}

pub type Result<T> = std::result::Result<T, Error>;

impl std::convert::From<sqlx::Error> for Error {
    fn from(err: sqlx::Error) -> Self {
        match err {
            sqlx::Error::RowNotFound => Error::NotFound("not found".into()),
            _ => Error::Internal(err.to_string()),
        }
    }
}

impl std::convert::From<std::io::Error> for Error {
    fn from(err: std::io::Error) -> Self {
        Error::Internal(err.to_string())
    }
}

impl std::convert::From<std::env::VarError> for Error {
    fn from(err: std::env::VarError) -> Self {
        match err {
            std::env::VarError::NotPresent => Error::NotFound("env var not found".into()),
            _ => Error::Internal(err.to_string()),
        }
    }
}

impl std::convert::From<sqlx::migrate::MigrateError> for Error {
    fn from(err: sqlx::migrate::MigrateError) -> Self {
        Error::Internal(err.to_string())
    }
}

impl std::convert::From<tracing_subscriber::filter::ParseError> for Error {
    fn from(err: tracing_subscriber::filter::ParseError) -> Self {
        Error::Internal(err.to_string())
    }
}

impl std::convert::From<tracing_subscriber::filter::FromEnvError> for Error {
    fn from(err: tracing_subscriber::filter::FromEnvError) -> Self {
        Error::Internal(err.to_string())
    }
}

impl std::convert::From<std::net::AddrParseError> for Error {
    fn from(err: std::net::AddrParseError) -> Self {
        Error::Internal(err.to_string())
    }
}

impl std::convert::From<hyper::Error> for Error {
    fn from(err: hyper::Error) -> Self {
        Error::Internal(err.to_string())
    }
}

impl std::convert::From<std::num::ParseIntError> for Error {
    fn from(err: std::num::ParseIntError) -> Self {
        Error::InvalidArgument(err.to_string())
    }
}

impl std::convert::From<url::ParseError> for Error {
    fn from(err: url::ParseError) -> Self {
        Error::InvalidArgument(format!("url is not valid: {err}"))
    }
}

impl std::convert::From<relay::Base64CursorError> for Error {
    fn from(err: relay::Base64CursorError) -> Self {
        Error::InvalidArgument(err.to_string())
    }
}
