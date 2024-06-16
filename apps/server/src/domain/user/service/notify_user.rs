use super::Service;

impl Service {
    pub async fn notify_user(&self, email: &str) -> Result<(), crate::Error> {
        self.mailer.send(email).await?;
        Ok(())
    }
}
