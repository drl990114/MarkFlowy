mod schema {
    cynic::use_schema!("tests/schema.graphql");
}

#[cynic::schema_for_derives(file = "tests/schema.graphql", module = "schema")]
pub mod queries {
    use super::schema;

    #[derive(cynic::QueryFragment, Debug)]
    #[cynic(graphql_type = "Query", variables = "ReadSettingsArguments")]
    pub struct SettingsQuery {
        #[arguments(first: $first, after : $after, last : $last, before : $before)]
        pub settings: SettingsConnection,
    }

    #[derive(cynic::QueryVariables, Debug)]
    pub struct ReadSettingsArguments {
        pub first: Option<i32>,
        pub after: Option<String>,
        pub last: Option<i32>,
        pub before: Option<String>,
    }

    #[derive(cynic::QueryFragment, Debug)]
    pub struct SettingsConnection {
        pub total_count: i32,
        pub edges: Vec<SettingsEdge>,
    }

    #[derive(cynic::QueryFragment, Debug)]
    pub struct SettingsEdge {
        pub node: Settings,
        pub cursor: String,
    }

    #[derive(cynic::QueryFragment, Debug)]
    pub struct Settings {
        pub id: Uuid,
        pub settings_json: String,
    }

    #[derive(cynic::Scalar, Debug, Clone)]
    #[cynic(graphql_type = "UUID")]
    pub struct Uuid(pub String);
}

#[cynic::schema_for_derives(file = "tests/schema.graphql", module = "schema")]
pub mod add {
    use super::schema;

    #[derive(cynic::QueryVariables, Debug)]
    pub struct CreateSettingsInput {
        pub settings_json: String,
    }

    #[derive(cynic::QueryFragment, Debug)]
    #[cynic(graphql_type = "Mutation", variables = "CreateSettingsInput")]
    pub struct SettingsMutation {
        #[arguments(input : {
            settings_json: $settings_json,
        })]
        pub create_settings: Settings,
    }

    #[derive(cynic::QueryFragment, Debug)]
    pub struct Settings {
        pub id: Uuid,
        pub settings_json: String,
    }

    #[derive(cynic::Scalar, Debug, Clone)]
    #[cynic(graphql_type = "UUID")]
    pub struct Uuid(pub String);
}

#[cynic::schema_for_derives(file = "tests/schema.graphql", module = "schema")]
pub mod update {
    use super::schema;

    #[derive(cynic::QueryVariables, Debug)]
    pub struct UpdateSettingsInput {
        pub id: Uuid,
        pub settings_json: String,
    }

    #[derive(cynic::QueryFragment, Debug)]
    #[cynic(graphql_type = "Mutation", variables = "UpdateSettingsInput")]
    pub struct SettingsMutation {
        #[arguments(input : {
            id: $id,
            settings_json: $settings_json,
        })]
        pub update_settings: Settings,
    }

    #[derive(cynic::QueryFragment, Debug)]
    pub struct Settings {
        pub id: Uuid,
        pub settings_json: String,
    }

    #[derive(cynic::Scalar, Debug, Clone)]
    #[cynic(graphql_type = "UUID")]
    pub struct Uuid(pub String);
}

#[cynic::schema_for_derives(file = "tests/schema.graphql", module = "schema")]
pub mod delete {
    use super::schema;

    #[derive(cynic::QueryVariables, Debug)]
    pub struct DeleteSettingsInput {
        pub id: Uuid,
    }

    #[derive(cynic::QueryFragment, Debug)]
    #[cynic(graphql_type = "Mutation", variables = "DeleteSettingsInput")]
    pub struct SettingsMutation {
        #[arguments(input : { id: $id })]
        pub delete_settings: Settings,
    }

    #[derive(cynic::QueryFragment, Debug)]
    pub struct Settings {
        pub id: Uuid,
        pub settings_json: String,
    }

    #[derive(cynic::Scalar, Debug, Clone)]
    #[cynic(graphql_type = "UUID")]
    pub struct Uuid(pub String);
}