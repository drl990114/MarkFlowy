extern crate mfdev;

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
