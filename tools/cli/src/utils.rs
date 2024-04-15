use clap::error::ErrorKind;
use clap::CommandFactory;

use crate::Cli;

pub fn get_new_verion(old_version: String, major: bool, minor: bool, patch: bool) -> String {
    let ver = old_version.split('.').collect::<Vec<&str>>();

    let mut old_major = ver[0].parse::<i32>().unwrap();
    let mut old_minor = ver[1].parse::<i32>().unwrap();
    let mut old_patch = ver[2].parse::<i32>().unwrap();

    let (maj, min, pat) = (major, minor, patch);
    match (maj, min, pat) {
        (true, false, false) => {
            old_major += 1;
            old_minor = 0;
            old_patch = 0;
        }
        (false, true, false) => {
            old_minor += 1;
            old_patch = 0;
        }
        (false, false, true) => old_patch += 1,
        _ => {
            let mut cmd = Cli::command();
            cmd.error(
                ErrorKind::ArgumentConflict,
                "Can only modify one version field",
            )
            .exit();
        }
    };

    let version = format!("{old_major}.{old_minor}.{old_patch}");
    return version;
}
