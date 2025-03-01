#![allow(clippy::match_single_binding)]

#[derive(Debug)]
pub enum Error {
    NotFound,
    ThemenameAlreadyExists,
}

impl std::convert::From<Error> for crate::Error {
    fn from(err: Error) -> Self {
        match err {
            Error::NotFound => crate::Error::NotFound(String::from("theme not found")),
            Error::ThemenameAlreadyExists => {
                crate::Error::AlreadyExists(String::from("theme name is already in use"))
            }
        }
    }
}
