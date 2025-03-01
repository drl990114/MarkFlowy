use async_graphql::{EmptySubscription, MergedObject, Schema};

use crate::domain::{
    health::resolver::HealthQuery, meta::resolver::MetaQuery, theme::resolver::{ThemeMutation, ThemeQuery}, user::resolver::{UserMutation, UserQuery}
};

#[derive(MergedObject, Default)]
pub struct Query(MetaQuery, UserQuery, HealthQuery, ThemeQuery);

#[derive(MergedObject, Default)]
pub struct Mutation(UserMutation, ThemeMutation);

pub type AppSchema = Schema<Query, Mutation, EmptySubscription>;
