mod schema {
    cynic::use_schema!("tests/schema.graphql");
}

#[cynic::schema_for_derives(file = "tests/schema.graphql", module = "schema")]
pub mod queries {
    use super::schema;

    #[derive(cynic::QueryFragment, Debug)]
    #[cynic(graphql_type = "Query", variables = "ReadUsersArguments")]
    pub struct UsersQuery {
        #[arguments(first: $first, after : $after, last : $last, before : $before)]
        pub users: UserConnection,
    }

    // All sturct must be inline
    #[derive(cynic::QueryVariables, Debug)]
    pub struct ReadUsersArguments {
        pub first: Option<i32>,
        pub after: Option<String>,
        pub last: Option<i32>,
        pub before: Option<String>,
    }

    #[derive(cynic::QueryFragment, Debug)]
    pub struct UserConnection {
        pub total_count: i32,
        pub edges: Vec<UserEdge>,
    }

    #[derive(cynic::QueryFragment, Debug)]
    pub struct UserEdge {
        pub node: User,
        pub cursor: String,
    }

    #[derive(cynic::QueryFragment, Debug)]
    pub struct User {
        pub id: Uuid,
        pub name: String,
        pub email: String,
        pub password: String,
    }

    #[derive(cynic::QueryFragment, Debug)]
    #[cynic(graphql_type = "Query", variables = "ReadUserArguments")]
    pub struct UserQuery {
        #[arguments(id : $id)]
        pub user: User,
    }

    // All sturct must be inline
    #[derive(cynic::QueryVariables, Debug)]
    pub struct ReadUserArguments {
        pub id: Uuid,
    }

    // All sturct must be inline
    #[derive(cynic::Scalar, Debug, Clone)]
    #[cynic(graphql_type = "UUID")]
    pub struct Uuid(pub String);
}

#[cynic::schema_for_derives(file = "tests/schema.graphql", module = "schema")]
pub mod add {
    use super::schema;

    #[derive(cynic::QueryVariables, Debug)]
    pub struct CreateUserInput {
        pub name: String,
        pub email: String,
        pub password: String,
    }

    #[derive(cynic::QueryFragment, Debug)]
    #[cynic(graphql_type = "Mutation", variables = "CreateUserInput")]
    pub struct UserMutation {
        #[arguments(input : {
            name: $name,
            email: $email,
            password: $password,
        })]
        pub create_user: User,
    }

    #[derive(cynic::QueryFragment, Debug)]
    pub struct User {
        pub id: Uuid,
        pub name: String,
        pub password: String,
    }

    #[derive(cynic::Scalar, Debug, Clone)]
    #[cynic(graphql_type = "UUID")]
    pub struct Uuid(pub String);
}

#[cynic::schema_for_derives(file = "tests/schema.graphql", module = "schema")]
pub mod update {
    use super::schema;

    #[derive(cynic::QueryVariables, Debug)]
    pub struct UpdateUserInput {
        pub id: Uuid,
        pub name: String,
        pub email: String,
        pub password: String,
    }

    #[derive(cynic::QueryFragment, Debug)]
    #[cynic(graphql_type = "Mutation", variables = "UpdateUserInput")]
    pub struct UserMutation {
        #[arguments(input : {
            id: $id,
            name: $name,
            email: $email,
            password: $password,
        })]
        pub update_user: User,
    }

    #[derive(cynic::QueryFragment, Debug)]
    pub struct User {
        pub id: Uuid,
        pub name: String,
        pub password: String,
    }

    #[derive(cynic::Scalar, Debug, Clone)]
    #[cynic(graphql_type = "UUID")]
    pub struct Uuid(pub String);
}

#[cynic::schema_for_derives(file = "tests/schema.graphql", module = "schema")]
pub mod delete {
    use super::schema;

    #[derive(cynic::QueryVariables, Debug)]
    pub struct DeleteUserArguments {
        pub id: Uuid,
    }

    #[derive(cynic::QueryFragment, Debug)]
    #[cynic(graphql_type = "Mutation", variables = "DeleteUserArguments")]
    pub struct UserMutation {
        #[arguments(id: $id)]
        pub delete_user: User,
    }

    #[derive(cynic::QueryFragment, Debug)]
    pub struct User {
        pub id: Uuid,
        pub name: String,
        pub email: String,
        pub password: String,
    }

    #[derive(cynic::Scalar, Debug, Clone)]
    #[cynic(graphql_type = "UUID")]
    pub struct Uuid(pub String);
}
