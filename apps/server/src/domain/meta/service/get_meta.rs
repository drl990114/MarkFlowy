use super::Service;
use crate::domain::meta::entities;

impl Service {
    pub async fn get_meta(&self) -> Result<entities::Meta, crate::Error> {
        let config = entities::Config {
            env: self.config.env.to_string(),
            base_url: self.config.base_url.to_string(),
            port: self.config.http.port,
        };
        let meta = entities::Meta {
            build: option_env!("VCS_REVISION").unwrap_or("unknown").to_string(),
            version: env!("CARGO_PKG_VERSION").to_string(),
            config,
        };
        Ok(meta)
    }
}
