use sqlx::{self, Row};
use uuid::Uuid;

use super::Repository;
use crate::domain::theme::{entities, Error};
use crate::{db::Queryer, relay::Base64Cursor};

impl Repository {
    pub async fn find_all_themes<'c, C: Queryer<'c> + Copy>(
        &self,
        db: C,
        first: Option<i32>,
        after: Option<Uuid>,
        last: Option<i32>,
        before: Option<Uuid>,
    ) -> Result<Vec<entities::ThemeOutput>, crate::Error> {
        let default_page_size = 10;
        let mut query: String =  format!(r#"
        select t.*, u.email as author_email
        from theme_ t  
        join user_ u on t.author_id = u.id
        "#);

        match (first, after, last, before) {
            // First
            (Some(first), None, None, None) => {
                query = format!("{query} order by id asc limit {first}");
            }
            // First & after,
            (Some(first), Some(after), None, None) => {
                query = format!("{query} where id > '{after}' order by id asc limit {first}");
            }
        //     // Last
        //     (None, None, Some(last), None) => {
        //         query = format!(
        //             r#"select * from ( 
        // select t.*, u.email as author_email
        // from theme_ t 
        // order by id desc 
        // limit {limit} )
        // as data order by id desc"#,
        //             limit = last + 1
        //         );
        //     }
        //     // Last & before
        //     (None, None, Some(last), Some(before)) => {
        //         query = format!("select * from ( select * from theme_ where id < '{before}' order by id desc limit {limit} ) as data order by id asc;", limit = last + 1);
        //     }
            // Default page size
            _ => query = format!("{query} limit {default_page_size}"),
        };

        // query = format!(r#"
        // select t.*, u.email as author_email 
        // from theme_ t  
        // join user_ u on t.author_id = u.id  
        // order by t.id asc
        // limit 10
        // "#);

        let mut rows = match sqlx::query_as::<_, entities::ThemeOutput>(&query)
            .fetch_all(db)
            .await
        {
            Err(err) => {
                tracing::error!("{}", &err);
                return Err(err.into());
            }
            Ok(res) => res,
        };

        let has_previous_page = self.has_previous_page(&rows, last).await?;
        if last.is_some() {
            // The real value start from index 1. The 0 index only act as a sign for `has_previous_page`
            rows = if has_previous_page {
                rows[1..rows.len()].to_vec()
            } else {
                rows
            }
        };
        Ok(rows)
    }
    pub async fn has_previous_page(
        &self,
        rows: &[entities::ThemeOutput],
        last: Option<i32>,
    ) -> Result<bool, Error> {
        let mut has_previous_page: bool = false;
        if let Some(last) = last {
            tracing::debug!("rows length: {}. last: {}", rows.len(), last);
            has_previous_page = rows.len() > last as usize;
        };
        Ok(has_previous_page)
    }
    pub async fn find_page_info<'c, C: Queryer<'c> + Copy>(
        &self,
        db: C,
        rows: &[entities::ThemeOutput],
        first: Option<i32>,
        after: Option<Uuid>,
        last: Option<i32>,
        before: Option<Uuid>,
    ) -> Result<entities::ThemePageInfo, crate::Error> {
        let mut has_next_query: String = String::new();
        let mut has_next_page: bool = false;

        match (first, after, last, before) {
            // First
            (Some(first), None, None, None) => {
                has_next_query = format!(
                    r#"select count(*) > {first} from
                     ( select "id" from theme_ order by id asc limit {limit}  )
                   as data"#,
                    limit = first + 1
                );
            }
            // First & after,
            (Some(first), Some(after), None, None) => {
                has_next_query = format!(
                    r#"select count(*) > {first} from
                     ( select "id" from theme_ where id > '{after}' order by id asc limit {limit} )
                   as data"#,
                    limit = first + 1
                );
            }
            _ => (),
        };

        //
        // has_next query
        //
        if let Some(_first) = first {
            has_next_page = match sqlx::query(&has_next_query).fetch_one(db).await {
                Err(err) => {
                    tracing::error!("{}", &err);
                    return Err(err.into());
                }
                Ok(row) => row.get(0),
            };
        };

        let (start_cursor, end_cursor) = if rows.is_empty() {
            (None, None)
        } else {
            let start_cursor = Base64Cursor::new(rows[0].id).encode();
            let end_cursor = Base64Cursor::new(rows[rows.len() - 1].id).encode();
            (Some(start_cursor), Some(end_cursor))
        };

        let has_previous_page = self.has_previous_page(rows, last).await?;
        let page_info = entities::ThemePageInfo {
            end_cursor,
            has_next_page,
            start_cursor,
            has_previous_page,
        };

        Ok(page_info)
    }
}
