use super::Service;
use crate::{
    domain::user::entities,
    relay::validation::{convert_params, validate_params},
};

impl Service {
    pub async fn find_users(
        &self,
        first: Option<i32>,
        after: Option<&str>,
        last: Option<i32>,
        before: Option<&str>,
    ) -> Result<Vec<entities::UserEdge>, crate::Error> {
        validate_params(first, last)?;
        let (after_uuid, before_uuid) = convert_params(after, before)?;

        let users = self
            .repo
            .find_all_users(&self.db, first, after_uuid, last, before_uuid)
            .await?;

        let user_edges: Vec<entities::UserEdge> =
            users.into_iter().map(|user| user.into()).collect();
        Ok(user_edges)
    }
    pub async fn find_page_info(
        &self,
        first: Option<i32>,
        after: Option<&str>,
        last: Option<i32>,
        before: Option<&str>,
    ) -> Result<entities::PageInfo, crate::Error> {
        let (after_uuid, before_uuid) = convert_params(after, before)?;

        let users = self
            .repo
            .find_all_users(&self.db, first, after_uuid, last, before_uuid)
            .await?;

        let page_info = self
            .repo
            .find_page_info(&self.db, &users, first, after_uuid, last, before_uuid)
            .await?;
        Ok(page_info)
    }
}
