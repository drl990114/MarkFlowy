use clap::Parser;
use serde_json::{Map, Value};
use std::{io, path::Path, process::Command};
use toml;

use crate::utils;

#[derive(Parser)]
#[command(about = "bump the version of the project")]
pub struct Release {
    /// auto inc major
    #[arg(long)]
    pub major: bool,

    /// auto inc minor
    #[arg(long)]
    pub minor: bool,

    /// auto inc patch
    #[arg(long)]
    pub patch: bool,
}

#[derive(serde::Deserialize, serde::Serialize)]
struct Package {
    version: String,
}

const PACKAGEFILE_URL: &str = "apps/desktop/src-tauri/tauri.conf.json";
const CRATESFILE_URL: &str = "apps/desktop/src-tauri/Cargo.toml";

fn get_old_version() -> String {
    let package_str = std::fs::read_to_string(PACKAGEFILE_URL).unwrap();
    let package: Package = serde_json::from_str::<Package>(&package_str).unwrap();

    return package.version;
}

fn update_cargo_lock(workspace: &Path) -> io::Result<()> {
    let status = Command::new("cargo")
        .args(["update", "--workspace", "--offline"])
        .current_dir(workspace)
        .status()?;

    if !status.success() {
        return Err(io::Error::other(format!(
            "Cargo.lock update failed with {status}"
        )));
    }

    Ok(())
}

fn write_new_version(new_version: String) {
    let package_str = std::fs::read_to_string(PACKAGEFILE_URL).unwrap();
    let crates_str = std::fs::read_to_string(CRATESFILE_URL).unwrap();

    let mut package: Map<String, serde_json::Value> =
        serde_json::from_str::<Map<String, serde_json::Value>>(&package_str).unwrap();
    let mut crate_data: Map<String, serde_json::Value> = toml::from_str(&crates_str).unwrap();

    crate_data.get_mut("package").unwrap()["version"] = Value::String(new_version.clone());
    package["version"] = Value::String(new_version.clone());

    let new_package_str =
        serde_json::to_string_pretty::<Map<String, serde_json::Value>>(&package).unwrap();
    let new_crates_str =
        toml::to_string_pretty::<Map<String, serde_json::Value>>(&crate_data).unwrap();

    let mut input = String::new();

    println!("Are you sure you want to release version: {new_version} (y/n)");

    std::io::stdin().read_line(&mut input).unwrap();

    if input.trim() == "y" {
        println!("Releasing version: {new_version}");
        std::fs::write(PACKAGEFILE_URL, new_package_str).unwrap();
        std::fs::write(CRATESFILE_URL, new_crates_str).unwrap();

        update_cargo_lock(Path::new("."))
            .expect("failed to update Cargo.lock; aborting release before git operations");

        Command::new("git")
            .arg("add")
            .arg(".")
            .spawn()
            .expect("failed to execute process")
            .wait()
            .unwrap();

        Command::new("git")
            .arg("commit")
            .arg("-m")
            .arg(format!("chore: bump version to v{new_version}"))
            .spawn()
            .expect("failed to execute process")
            .wait()
            .unwrap();

        Command::new("git")
            .arg("push")
            .spawn()
            .expect("failed to execute process")
            .wait()
            .unwrap();

        create_git_tag(format!("v{new_version}"));
        push_git_tag(format!("v{new_version}"));
    } else {
        println!("Aborting release");
    }
}

pub fn create_git_tag(tag_name: String) {
    Command::new("git")
        .arg("tag")
        .arg(tag_name)
        .spawn()
        .expect("failed to execute process")
        .wait()
        .unwrap();
}

pub fn push_git_tag(tag_name: String) {
    Command::new("git")
        .arg("push")
        .arg("markflowy")
        .arg(tag_name)
        .spawn()
        .expect("failed to execute process")
        .wait()
        .unwrap();
}

pub fn main(major: bool, minor: bool, patch: bool) {
    let old_version = get_old_version();

    let new_version = utils::get_new_verion(old_version, major, minor, patch);

    write_new_version(new_version.clone());
}

#[cfg(test)]
mod tests {
    use super::update_cargo_lock;
    use std::{collections::HashSet, fs, process::Command, sync::Barrier, thread};
    use tempfile::TempDir;

    struct WorkspaceFixture(TempDir);

    impl WorkspaceFixture {
        fn new() -> Self {
            let fixture = Self(
                tempfile::Builder::new()
                    .prefix("mfdev-release-")
                    .tempdir()
                    .unwrap(),
            );
            fs::create_dir_all(fixture.0.path().join("app/src")).unwrap();
            fs::write(
                fixture.0.path().join("Cargo.toml"),
                "[workspace]\nresolver = \"2\"\nmembers = [\"app\"]\n",
            )
            .unwrap();
            fs::write(fixture.0.path().join("app/src/lib.rs"), "").unwrap();
            fs::write(
                fixture.0.path().join("app/Cargo.toml"),
                "[package]\nname = \"release-fixture\"\nversion = \"1.0.0\"\nedition = \"2021\"\n",
            )
            .unwrap();
            fs::write(
                fixture.0.path().join("Cargo.lock"),
                "version = 4\n\n[[package]]\nname = \"release-fixture\"\nversion = \"0.1.0\"\n",
            )
            .unwrap();
            fixture
        }
    }

    #[test]
    fn parallel_workspaces_keep_files_and_cleanup_isolated() {
        const WORKSPACES: usize = 16;
        let barrier = Barrier::new(WORKSPACES);
        let fixtures = thread::scope(|scope| {
            let workers: Vec<_> = (0..WORKSPACES)
                .map(|index| {
                    let barrier = &barrier;
                    scope.spawn(move || {
                        barrier.wait();
                        let fixture = WorkspaceFixture::new();
                        fs::write(fixture.0.path().join("marker"), index.to_string()).unwrap();
                        fixture
                    })
                })
                .collect();
            workers
                .into_iter()
                .map(|worker| worker.join().unwrap())
                .collect::<Vec<_>>()
        });

        let paths: HashSet<_> = fixtures.iter().map(|fixture| fixture.0.path()).collect();
        assert_eq!(paths.len(), WORKSPACES);

        for (index, fixture) in fixtures.into_iter().enumerate() {
            let path = fixture.0.path().to_path_buf();
            assert_eq!(
                fs::read_to_string(path.join("marker")).unwrap(),
                index.to_string()
            );
            assert!(path.join("app/Cargo.toml").is_file());
            drop(fixture);
            assert!(!path.exists());
        }
    }

    #[test]
    fn updates_lockfile_after_workspace_version_bump() {
        let workspace = WorkspaceFixture::new();
        update_cargo_lock(workspace.0.path()).unwrap();

        let lockfile: toml::Value =
            toml::from_str(&fs::read_to_string(workspace.0.path().join("Cargo.lock")).unwrap())
                .unwrap();
        assert_eq!(lockfile["package"][0]["version"].as_str(), Some("1.0.0"));

        let metadata = Command::new("cargo")
            .args(["metadata", "--format-version", "1", "--locked", "--offline"])
            .current_dir(workspace.0.path())
            .output()
            .unwrap();
        assert!(
            metadata.status.success(),
            "{}",
            String::from_utf8_lossy(&metadata.stderr)
        );
    }

    #[test]
    fn fails_when_cargo_cannot_update_lockfile() {
        let workspace = WorkspaceFixture::new();
        let original_lockfile = fs::read(workspace.0.path().join("Cargo.lock")).unwrap();
        fs::write(workspace.0.path().join("app/Cargo.toml"), "[package").unwrap();

        assert!(update_cargo_lock(workspace.0.path()).is_err());
        assert_eq!(
            fs::read(workspace.0.path().join("Cargo.lock")).unwrap(),
            original_lockfile
        );
    }
}
