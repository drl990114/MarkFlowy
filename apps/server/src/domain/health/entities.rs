use frunk::LabelledGeneric;

#[derive(Debug, LabelledGeneric)]
pub struct Health {
    pub status: String,
}

#[cfg(test)]
mod tests {
    use super::Health;

    #[test]
    fn test_health() {
        let health = Health {
            status: "Running".to_string(),
        };

        assert_eq!(health.status, "Running".to_string());
    }
}
