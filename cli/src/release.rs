use std::process::Command;
use clap::Parser;
use serde_json::{Map, Value};
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
    package: PackageData,
}

#[derive(serde::Deserialize, serde::Serialize)]
struct PackageData {
    version: String,
}

fn get_old_version() -> String {
    let packagefile_url = "tauri.conf.json";
    let package_str = std::fs::read_to_string(packagefile_url).unwrap();
    let package: Package = serde_json::from_str::<Package>(&package_str).unwrap();

    return package.package.version;
}

fn write_new_version(new_version: String) {
    let packagefile_url = "tauri.conf.json";
    let cratesfile_url = "Cargo.toml";

    let package_str = std::fs::read_to_string(packagefile_url).unwrap();
    let crates_str = std::fs::read_to_string(cratesfile_url).unwrap();

    let mut package: Map<String, serde_json::Value> =
        serde_json::from_str::<Map<String, serde_json::Value>>(&package_str).unwrap();
    let mut crate_data: Map<String, serde_json::Value> = toml::from_str(&crates_str).unwrap();

    crate_data.get_mut("package").unwrap()["version"] = Value::String(new_version.clone());
    package.get_mut("package").unwrap()["version"] = Value::String(new_version.clone());

    let new_package_str =
        serde_json::to_string_pretty::<Map<String, serde_json::Value>>(&package).unwrap();
    let new_crates_str =
        toml::to_string_pretty::<Map<String, serde_json::Value>>(&crate_data).unwrap();

    let mut input = String::new();

    println!("Are you sure you want to release version: {new_version} (y/n)");

    std::io::stdin().read_line(&mut input).unwrap();

    if input.trim() == "y" {
        println!("Releasing version: {new_version}");
        std::fs::write(packagefile_url, new_package_str).unwrap();
        std::fs::write(cratesfile_url, new_crates_str).unwrap();
        Command::new("git")
            .arg("add")
            .arg(".")
            .spawn()
            .expect("failed to execute process");

        Command::new("git")
            .arg("commit")
            .arg("-m")
            .arg(format!("chore: bump version to v{new_version}"))
            .spawn()
            .expect("failed to execute process");

        Command::new("git")
            .arg("push")
            .arg("markflowy")
            .spawn()
            .expect("failed to execute process");

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
        .expect("failed to execute process");
}

pub fn push_git_tag(tag_name: String) {
    Command::new("git")
        .arg("push")
        .arg("markflowy")
        .arg(tag_name)
        .spawn()
        .expect("failed to execute process");
}

pub fn main(major: bool, minor: bool, patch: bool) {
    let old_version = get_old_version();

    let new_version = utils::get_new_verion(old_version, major, minor, patch);

    write_new_version(new_version.clone());
}
