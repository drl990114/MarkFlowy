use std::{
    net::{IpAddr, SocketAddr},
    sync::Arc,
};

use tokio::net::TcpListener;

use mf_server::{config::Config, logger, route::app};

#[tokio::main]
async fn main() -> Result<(), mf_server::Error> {
    let config = Arc::new(Config::load()?);
    logger::init(&config)?;

    let app = app().await?;

    let host: IpAddr = config.base_url.parse()?;
    let port = config.http.port;
    let address = &SocketAddr::new(host, port);

    tracing::info!("App started at `{}`", address);
    axum::serve(TcpListener::bind(address).await?, app).await?;

    Ok(())
}
