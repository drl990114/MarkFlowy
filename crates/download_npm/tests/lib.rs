extern crate download_npm;

const TEST_FOLDER: &'static str = "./tests/tmp";

#[test]
fn test_download() {
  download_npm::download("react", download_npm::DownloadOptions {
    dest_path: TEST_FOLDER.to_string()
  }).unwrap();

  assert!(std::path::Path::new(TEST_FOLDER).exists());
  assert!(std::path::Path::new(TEST_FOLDER).join("react.tgz").exists());
}
