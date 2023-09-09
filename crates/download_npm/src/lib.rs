use reqwest;
use std::fs;
use std::io::copy;
use std::path::Path;

pub fn generate_registry_url(package_name: &str) -> String {
    format!("https://registry.npmjs.org/{}", package_name)
}

pub fn generate_download_url(package_name: &str, version: &str) -> String {
    format!(
        "https://registry.npmjs.org/{}/-/{}/{}-{}.tgz",
        package_name, package_name, package_name, version
    )
}

pub struct DownloadOptions {
    pub dest_path: String,
}

#[tokio::main]
pub async fn download(
    package_name: &str,
    opt: DownloadOptions,
) -> Result<(), Box<dyn std::error::Error>> {
    let registry_url = generate_registry_url(package_name);
    let response = reqwest::get(&registry_url)
        .await?
        .json::<serde_json::Value>()
        .await?;
    let latest_version = response["dist-tags"]["latest"].as_str().unwrap();
    let download_url = response["versions"][&latest_version]["dist"]["tarball"]
        .as_str()
        .unwrap();

    println!("{}", download_url);
    let response = reqwest::get(download_url).await?;
    let dest_path = Path::new(&opt.dest_path);

    if !dest_path.exists() {
        fs::create_dir(dest_path).expect("Cannot create destination directory");
    }

    let mut dest =
        fs::File::create(dest_path.join(format!("{}.tgz", package_name)))?;

    copy(&mut response.bytes().await?.as_ref(), &mut dest)?;

    Ok(())
}
