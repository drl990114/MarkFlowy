/// It is easier to track each type alias if this file is located on the top-level directory (here)
/// than in each domain. Also, separating them will create a lot of duplicate code.
use chrono;
use uuid::Uuid;

pub type Time = chrono::DateTime<chrono::Utc>;

/// The ID scalar type represents a unique identifier, often used to refetch an object or as key for a cache.
/// The ID type appears in a JSON response as a String; however, it is not intended to be human-readable.
/// When expected as an input type, any string (such as "4") or integer (such as 4) input value will be accepted as an ID.
pub type Id = Uuid;
