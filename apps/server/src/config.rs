use std::{fmt, str::FromStr};

use dotenv;
use serde::{Deserialize, Serialize};
use url::Url;
use crate::Error;

const ENV_APP_ENV: &str = "APP_ENV";
const ENV_APP_BASE_URL: &str = "APP_BASE_URL";
const ENV_HTTP_PORT: &str = "PORT";
const ENV_DATABASE_URL: &str = "DATABASE_URL";
const ENV_DATABASE_POOL_SIZE: &str = "DATABASE_POOL_SIZE";
const ENV_SCHEMA_LOCATION: &str = "SCHEMA_LOCATION";

const POSTGRES_SCHEME: &str = "postgres";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub env: Env,
    pub base_url: String,
    pub schema_location: Option<String>,
    pub http: Http,
    pub database: Database,
}

const APP_ENV_DEV: &str = "dev";
const APP_ENV_STAGING: &str = "staging";
const APP_ENV_PRODUCTION: &str = "production";

#[derive(Debug, Eq, PartialEq, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Env {
    Dev,
    Staging,
    Production,
}

impl FromStr for Env {
    type Err = Error;

    fn from_str(s: &str) -> Result<Env, Error> {
        match s {
            APP_ENV_DEV => Ok(Env::Dev),
            APP_ENV_STAGING => Ok(Env::Staging),
            APP_ENV_PRODUCTION => Ok(Env::Production),
            _ => Err(Error::InvalidArgument(format!(
                "config: {} is not a valid env. Valid values are [{}, {}, {}]",
                s,
                Env::Dev,
                Env::Staging,
                Env::Production,
            ))),
        }
    }
}

impl fmt::Display for Env {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            Env::Dev => write!(f, "{APP_ENV_DEV}"),
            Env::Staging => write!(f, "{APP_ENV_STAGING}"),
            Env::Production => write!(f, "{APP_ENV_PRODUCTION}"),
        }
    }
}

/// Database contains the data necessary to connect to a database
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Database {
    pub url: String,
    pub pool_size: u32,
}
const DEFAULT_DATABASE_POOL_SIZE: u32 = 100;

/// Http contains the data specific to the HTTP(s) server
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Http {
    pub port: u16,
    // pub https_domain: String,
    // pub https_port: u16,
}
const DEFAULT_HTTP_PORT: u16 = 8000;
// const ENV_HTTPS_DOMAIN: &str = "HTTPS_DOMAIN";
// const ENV_HTTPS_PORT: &str = "HTTPS_PORT";
// const DEFAULT_HTTPS_CERT_DIRECTORY: &str = "certs";

impl Config {
    /// Load and validate the configuration from the environment.
    /// If an error is found while parsing the values, or validating the data, an error is returned.
    pub fn load() -> Result<Self, Error> {
        dotenv::dotenv().ok();

        // app
        let env = std::env::var(ENV_APP_ENV)
            .map_err(|_| env_not_found(ENV_APP_ENV))?
            .parse::<Env>()?;
        let base_url =
            std::env::var(ENV_APP_BASE_URL).map_err(|_| env_not_found(ENV_APP_BASE_URL))?;

        // GraphQL
        let schema_location = match std::env::var(ENV_SCHEMA_LOCATION) {
            Ok(location) => Some(location),
            Err(_) => None,
        };

        let http = {
            let port = std::env::var(ENV_HTTP_PORT)
                .ok()
                .map_or(Ok(DEFAULT_HTTP_PORT), |env_val| env_val.parse::<u16>())?;

            Http { port }
        };

        let database = {
            let url =
                std::env::var(ENV_DATABASE_URL).map_err(|_| env_not_found(ENV_DATABASE_URL))?;
            let pool_size = std::env::var(ENV_DATABASE_POOL_SIZE)
                .ok()
                .map_or(Ok(DEFAULT_DATABASE_POOL_SIZE), |pool_size_str| {
                    pool_size_str.parse::<u32>()
                })?;

            Database { url, pool_size }
        };

        let mut config = Self {
            env,
            base_url,
            schema_location,
            http,
            database,
        };

        config.clean_and_validate()?;

        Ok(config)
    }

    fn clean_and_validate(&mut self) -> Result<(), Error> {
        // Database
        let database_url = Url::parse(&self.database.url)?;
        if database_url.scheme() != POSTGRES_SCHEME {
            return Err(Error::InvalidArgument(String::from(
                "config: database_url is not a valid postgres URL",
            )));
        }

        Ok(())
    }
}

fn env_not_found(var: &str) -> Error {
    Error::NotFound(format!("config: {var} env var not found"))
}
