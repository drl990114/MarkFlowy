use super::Service;
use crate::{
    domain::theme::entities,
    relay::validation::{convert_params, validate_params},
};

impl Service {
    pub async fn find_themes(
        &self,
        first: Option<i32>,
        after: Option<&str>,
        last: Option<i32>,
        before: Option<&str>,
    ) -> Result<Vec<entities::ThemeEdge>, crate::Error> {
        validate_params(first, last)?;
        let (after_uuid, before_uuid) = convert_params(after, before)?;

        let themes = self
            .repo
            .find_all_themes(&self.db, first, after_uuid, last, before_uuid)
            .await?;

        let theme_edges: Vec<entities::ThemeEdge> =
            themes.into_iter().map(|user| user.into()).collect();
        Ok(theme_edges)
    }
    pub async fn find_page_info(
        &self,
        first: Option<i32>,
        after: Option<&str>,
        last: Option<i32>,
        before: Option<&str>,
    ) -> Result<entities::ThemePageInfo, crate::Error> {
        let (after_uuid, before_uuid) = convert_params(after, before)?;

        let users = self
            .repo
            .find_all_themes(&self.db, first, after_uuid, last, before_uuid)
            .await?;

        let page_info = self
            .repo
            .find_page_info(&self.db, &users, first, after_uuid, last, before_uuid)
            .await?;
        Ok(page_info)
    }
}
