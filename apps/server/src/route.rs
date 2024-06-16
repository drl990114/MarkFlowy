use std::{fs,env, sync::Arc};

use async_graphql::{
    extensions, http::{playground_source, GraphQLPlaygroundConfig}, EmptyMutation, EmptySubscription, Schema
};
use async_graphql_axum::{GraphQLRequest, GraphQLResponse};
use std::convert::Infallible;
use axum::{
    extract::State, http::header::HeaderMap, middleware, response::{self, IntoResponse}, routing::{get, post}, Extension, Router
};
use axum::http::{
    header::{ACCEPT, AUTHORIZATION, CONTENT_TYPE},
    HeaderValue, Method,
};
use sqlx::{Pool, Postgres};
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;
use tower_http::{cors::CorsLayer, trace::TraceLayer};

use crate::{
    config::{self, Config}, context::ServerContext, db, domain::{health, meta, user::{self, model::User}}, driver::mailer::Mailer, route, schema::{AppSchema, Mutation, Query}, utils::jwt::auth, Error
};

pub struct AppState {
    pub db: Pool<Postgres>,
}

pub async fn graphql_handler(
    user: Extension<User>,
    State(schema): State<AppSchema>,
    req: GraphQLRequest,
) -> GraphQLResponse {
    println!("useruser: {:?}", user.id);
    let mut req = req.into_inner();
    req = req.data(user);

    schema.execute(req).await.into()
}

pub async fn graphql_playground() -> impl IntoResponse {
    response::Html(playground_source(GraphQLPlaygroundConfig::new("/graphql")))
}

pub async fn app() -> Result<Router, Error> {
    let config = Arc::new(Config::load()?);

    let db = db::connect(&config.database).await?;
    db::migrate(&db.clone()).await?;

    let health_service = Arc::new(health::Service::new());
    let meta_service = Arc::new(meta::Service::new(Arc::clone(&config)));
    let mailer_service = Mailer::new();
    let user_service = Arc::new(user::Service::new(db.clone(), mailer_service));

    let server_context = Arc::new(ServerContext {
        user_service,
        meta_service,
        health_service
    });

    let schema = Schema::build(Query::default(), Mutation::default(), EmptySubscription)
        .data(Arc::clone(&server_context))
        .extension(extensions::Logger)
        .finish();

    // Export schema to file
    if let Some(location) = &config.schema_location {
        fs::write(location, schema.sdl()).map_err(|_| {
            Error::InvalidArgument(format!(
                "GraphQL schema location doesn't exists `{}`",
                &location
            ))
        })?;
        tracing::info!("Wrote GraphQL schema to {}", location);
    }

    #[derive(OpenApi)]
    #[openapi(
        paths(
            health::resolver::health,
        ),
        components(schemas(health::model::Health, health::model::HealthResponse)),
        tags(
            (name = "Rust GraphQL", description = "Rust GraphQL Boilerplate 🏗️")
        )
    )]
    struct ApiDoc;
    let origin = env::var("ORIGIN").expect("ORIGIN must be set");

    let cors = CorsLayer::new()
    .allow_origin(origin.parse::<HeaderValue>().unwrap())
    .allow_methods([Method::GET, Method::POST, Method::PATCH, Method::DELETE])
    .allow_credentials(true)
    .allow_headers([AUTHORIZATION, ACCEPT, CONTENT_TYPE]);

    let app_state = Arc::new(AppState {
        db: db.clone(),
    });

    let mut app = Router::new()
        .route("/graphql", post(route::graphql_handler).route_layer(middleware::from_fn_with_state(app_state.clone(), auth)),)
        .route("/health", get(health::resolver::health))
        .route("/api/create_user", post(user::handler::create_user).with_state(app_state.clone()))
        .route("/api/login",post(user::handler::login).with_state(app_state.clone()))
        .layer(TraceLayer::new_for_http())
        .layer(cors);

    if config.env != config::Env::Production {
        app = app
            .route("/playground", get(route::graphql_playground))
            .merge(SwaggerUi::new("/swagger").url("/api-doc/openapi.json", ApiDoc::openapi()));
    }
    let app = app.with_state(schema);

    Ok(app)
}
