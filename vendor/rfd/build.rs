fn main() {
    let target_os = std::env::var("CARGO_CFG_TARGET_OS").expect("target OS not detected");

    match target_os.as_str() {
        "macos" => println!("cargo:rustc-link-lib=framework=AppKit"),
        "windows" => {}
        _ => {
            let gtk = std::env::var_os("CARGO_FEATURE_GTK3").is_some();
            let xdg = std::env::var_os("CARGO_FEATURE_XDG_PORTAL").is_some();

            if gtk && xdg {
                panic!("You can't enable both `gtk3` and `xdg-portal` features at once");
            } else if !gtk && !xdg {
                panic!("You need to choose at least one backend: `gtk3` or `xdg-portal` features");
            }

            if xdg {
                let tokio = std::env::var_os("CARGO_FEATURE_TOKIO").is_some();
                let async_std = std::env::var_os("CARGO_FEATURE_ASYNC_STD").is_some();
                if !tokio && !async_std {
                    panic!("One of the `tokio` or `async-std` features must be enabled to use `xdg-portal`");
                }
            }
        }
    }
}
