use reqwest;
use std::fs;
use std::io::{copy, Read, Write};
use std::path::Path;
use flate2::read::GzDecoder;
use tar;
use tar::Archive;

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
    pub untar: bool
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
    let download_response = reqwest::get(download_url).await?;
    let dest_path = Path::new(&opt.dest_path);

    if !dest_path.exists() {
        fs::create_dir(dest_path).expect("Cannot create destination directory");
    }

    if opt.untar {
        let target_dest_path = dest_path.join(format!("{}.tgz", package_name));
        let mut dest = fs::File::create(target_dest_path.clone())?;
    
        copy(&mut download_response.bytes().await?.as_ref(), &mut dest)?;
    
        let file = fs::File::open(target_dest_path.clone())?;
        let decoder = GzDecoder::new(file);
    
        let mut archive = Archive::new(decoder);
    
        for entry_result in archive.entries()? {
            let mut entry = entry_result?;
            let path = entry.path()?;
            let mut content = String::new();

            // only copy main files
            if path.clone().ends_with("package.json") || path.ends_with("index.js") || path.ends_with("style.css") {
    
                let target_dir_path = target_dest_path.parent().unwrap().join(package_name);

                let file_name = path.file_name().unwrap().to_str().clone().unwrap();
                let target_file_path = target_dir_path.join(Path::new(file_name));

                // let target_file_path = target_dir_path.join(path.strip_prefix("package/").unwrap().to_path_buf().clone());
    
                if !target_dir_path.clone().join(path.clone()).exists() {
                    fs::create_dir_all(target_dir_path)?;
                    let mut target_file = fs::File::create(target_file_path)?;
                    entry.read_to_string(&mut content)?;
                    target_file.write_all(content.as_bytes())?;
                }
            }
        }

        if target_dest_path.as_path().exists() {
            fs::remove_file(target_dest_path)?;
        }
    } else {
        let target_dest_path = dest_path.join(format!("{}.tgz", package_name));
        let mut dest = fs::File::create(target_dest_path.clone())?;
    
        copy(&mut download_response.bytes().await?.as_ref(), &mut dest)?;
    }


    Ok(())
}
