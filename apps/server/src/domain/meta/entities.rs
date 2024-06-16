use frunk::LabelledGeneric;

#[derive(Debug, LabelledGeneric)]
pub struct Meta {
    pub build: String,
    pub version: String,
    pub config: Config,
}

#[derive(Debug, LabelledGeneric)]
pub struct Config {
    pub env: String,
    pub base_url: String,
    pub port: u16,
}
