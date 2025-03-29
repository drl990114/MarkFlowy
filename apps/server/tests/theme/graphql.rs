mod schema {
    cynic::use_schema!("tests/schema.graphql");
}

#[cynic::schema_for_derives(file = "tests/schema.graphql", module = "schema")]
pub mod queries {
    use super::schema;

    #[derive(cynic::QueryFragment, Debug)]
    #[cynic(graphql_type = "Query", variables = "ReadThemesArguments")]
    pub struct ThemesQuery {
        #[arguments(first: $first, after : $after, last : $last, before : $before)]
        pub themes: ThemeConnection,
    }

    #[derive(cynic::QueryVariables, Debug)]
    pub struct ReadThemesArguments {
        pub first: Option<i32>,
        pub after: Option<String>,
        pub last: Option<i32>,
        pub before: Option<String>,
    }

    #[derive(cynic::QueryFragment, Debug)]
    pub struct ThemeConnection {
        pub total_count: i32,
        pub edges: Vec<ThemeEdge>,
    }

    #[derive(cynic::QueryFragment, Debug)]
    pub struct ThemeEdge {
        pub node: Theme,
        pub cursor: String,
    }

    #[derive(cynic::QueryFragment, Debug)]
    pub struct Theme {
        pub id: Uuid,
        pub name: String,
        pub npm_package_name: String,
        pub cover_image_url: String,
    }

    #[derive(cynic::Scalar, Debug, Clone)]
    #[cynic(graphql_type = "UUID")]
    pub struct Uuid(pub String);
}

#[cynic::schema_for_derives(file = "tests/schema.graphql", module = "schema")]
pub mod add {
    use super::schema;

    #[derive(cynic::QueryVariables, Debug)]
    pub struct CreateThemeInput {
        pub name: String,
        pub npm_package_name: String,
        pub cover_image_url: String,
    }

    #[derive(cynic::QueryFragment, Debug)]
    #[cynic(graphql_type = "Mutation", variables = "CreateThemeInput")]
    pub struct ThemeMutation {
        #[arguments(input : {
            name: $name,
            npm_package_name: $npm_package_name,
            cover_image_url: $cover_image_url,
        })]
        pub create_theme: Theme,
    }

    #[derive(cynic::QueryFragment, Debug)]
    pub struct Theme {
        pub id: Uuid,
        pub name: String,
        pub npm_package_name: String,
        pub cover_image_url: String,
    }

    #[derive(cynic::Scalar, Debug, Clone)]
    #[cynic(graphql_type = "UUID")]
    pub struct Uuid(pub String);
}

#[cynic::schema_for_derives(file = "tests/schema.graphql", module = "schema")]
pub mod update {
    use super::schema;

    #[derive(cynic::QueryVariables, Debug)]
    pub struct UpdateThemeInput {
        pub id: Uuid,
        pub name: Option<String>,
        pub npm_package_name: Option<String>,
        pub cover_image_url: Option<String>,
    }

    #[derive(cynic::QueryFragment, Debug)]
    #[cynic(graphql_type = "Mutation", variables = "UpdateThemeInput")]
    pub struct ThemeMutation {
        #[arguments(input : {
            id: $id,
            name: $name,
            npm_package_name: $npm_package_name,
            cover_image_url: $cover_image_url,
        })]
        pub update_theme: Theme,
    }

    #[derive(cynic::QueryFragment, Debug)]
    pub struct Theme {
        pub id: Uuid,
        pub name: String,
        pub npm_package_name: String,
        pub cover_image_url: String,
    }

    #[derive(cynic::Scalar, Debug, Clone)]
    #[cynic(graphql_type = "UUID")]
    pub struct Uuid(pub String);
}

#[cynic::schema_for_derives(file = "tests/schema.graphql", module = "schema")]
pub mod delete {
    use super::schema;

    #[derive(cynic::QueryVariables, Debug)]
    pub struct DeleteThemeInput {
        pub id: Uuid,
    }

    #[derive(cynic::QueryFragment, Debug)]
    #[cynic(graphql_type = "Mutation", variables = "DeleteThemeInput")]
    pub struct ThemeMutation {
        #[arguments(input : { id: $id })]
        pub delete_theme: Theme,
    }

    #[derive(cynic::QueryFragment, Debug)]
    pub struct Theme {
        pub id: Uuid,
        pub name: String,
        pub npm_package_name: String,
        pub cover_image_url: String,
    }

    #[derive(cynic::Scalar, Debug, Clone)]
    #[cynic(graphql_type = "UUID")]
    pub struct Uuid(pub String);
}