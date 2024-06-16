#![allow(clippy::match_single_binding)]

#[derive(Debug)]
pub enum Error {
    // User
    UserNotFound,
    UsernameAlreadyExists,
}

impl std::convert::From<Error> for crate::Error {
    fn from(err: Error) -> Self {
        match err {
            // Users
            Error::UserNotFound => crate::Error::NotFound(String::from("user not found")),
            Error::UsernameAlreadyExists => {
                crate::Error::AlreadyExists(String::from("username is already in use"))
            }
        }
    }
}
