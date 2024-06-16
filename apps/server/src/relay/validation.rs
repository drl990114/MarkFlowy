use uuid::Uuid;

use crate::{
    error::{
        app::Error::{
            MissingFirstAndLastPaginationArguments, PassedFirstAndLastPaginationArguments,
        },
        Error,
    },
    relay::Base64Cursor,
};

/// Parse `after` and `before` to cursor
pub fn convert_params(
    after: Option<&str>,
    before: Option<&str>,
) -> Result<(Option<Uuid>, Option<Uuid>), crate::Error> {
    let (after_uuid, before_uuid) = match (after, before) {
        (None, None) => (None, None),
        (Some(after), Some(before)) => (
            Some(Base64Cursor::decode(after)?.into()),
            Some(Base64Cursor::decode(before)?.into()),
        ),
        (Some(after), None) => (Some(Base64Cursor::decode(after)?.into()), None),
        (None, Some(before)) => (None, Some(Base64Cursor::decode(before)?.into())),
    };
    Ok((after_uuid, before_uuid))
}

pub fn validate_params(first: Option<i32>, last: Option<i32>) -> Result<(), Error> {
    match (first, last) {
        (None, None) => return Err(MissingFirstAndLastPaginationArguments.into()),
        (Some(_), Some(_)) => return Err(PassedFirstAndLastPaginationArguments.into()),
        _ => (),
    };

    Ok(())
}
