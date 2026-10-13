extern crate mfdev;

#[test]
fn desktop_bundle_cli_and_lockfile_versions_match() {
    let workspace = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
    let read = |path: &str| std::fs::read_to_string(workspace.join(path)).unwrap();
    let bundle: serde_json::Value =
        serde_json::from_str(&read("apps/desktop/src-tauri/tauri.conf.json")).unwrap();
    let manifest: toml::Value = toml::from_str(&read("apps/desktop/src-tauri/Cargo.toml")).unwrap();
    let lockfile: toml::Value = toml::from_str(&read("Cargo.lock")).unwrap();
    let locked_app = lockfile["package"]
        .as_array()
        .unwrap()
        .iter()
        .find(|package| package["name"].as_str() == Some("markflowy"))
        .expect("MarkFlowy must be present in Cargo.lock");
    let version = bundle["version"].as_str().expect("bundle version");

    // About uses Tauri's configured version; CLI and startup diagnostics use
    // CARGO_PKG_VERSION. Direct local version edits must update both, too.
    assert_eq!(manifest["package"]["version"].as_str(), Some(version));
    assert_eq!(locked_app["version"].as_str(), Some(version));
}

#[test]
fn get_new_verion_major() {
    let old_version = "1.2.3".to_string();
    let major = true;
    let minor = false;
    let patch = false;
    let new_version = mfdev::utils::get_new_verion(old_version, major, minor, patch);
    assert_eq!(new_version, "2.0.0".to_string());
}

#[test]
fn get_new_verion_minor() {
    let old_version = "1.2.3".to_string();
    let major = false;
    let minor = true;
    let patch = false;
    let new_version = mfdev::utils::get_new_verion(old_version, major, minor, patch);
    assert_eq!(new_version, "1.3.0".to_string());
}

#[test]
fn get_new_verion_patch() {
    let old_version = "1.2.3".to_string();
    let major = false;
    let minor = false;
    let patch = true;
    let new_version = mfdev::utils::get_new_verion(old_version, major, minor, patch);
    assert_eq!(new_version, "1.2.4".to_string());
}
