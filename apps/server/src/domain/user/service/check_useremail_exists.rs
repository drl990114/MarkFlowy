use super::Service;

impl Service {
    /// returns true if a username exists. false otherwise
    pub async fn check_useremail_exist(
        &self,
        email: &str,
    ) -> Result<bool, crate::Error> {
        let find_existing_useremail_res = self.repo.find_user_by_email(&self.db, email).await;
        match find_existing_useremail_res {
            Ok(_) => Ok(true),
            Err(crate::Error::NotFound(_)) => Ok(false),
            Err(err) => Err(err),
        }
    }
}
