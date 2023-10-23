extern crate download_npm;


#[test]
fn test_download() {
  const TEST_FOLDER: &'static str = "./tests/tar";
  download_npm::download("react", download_npm::DownloadOptions {
    dest_path: TEST_FOLDER.to_string(),
    untar: false,
  }).unwrap();

  assert!(std::path::Path::new(TEST_FOLDER).exists());
  assert!(std::path::Path::new(TEST_FOLDER).join("react.tgz").exists());
}


#[test]
fn test_download_untar() {
  const TEST_FOLDER: &'static str = "./tests/untar";
  download_npm::download("react", download_npm::DownloadOptions {
    dest_path: TEST_FOLDER.to_string(),
    untar: true,
  }).unwrap();

  assert!(std::path::Path::new(TEST_FOLDER).exists());
  assert!(std::path::Path::new(TEST_FOLDER).join("react").join("package.json").exists());
  assert!(std::path::Path::new(TEST_FOLDER).join("react").join("index.js").exists());
}
