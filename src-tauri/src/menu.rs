use crate::app::conf::AppConf;
use tauri::{CustomMenuItem, MenuItem, Submenu, Menu, WindowMenuEvent, Manager};

pub fn generate_menu() -> Menu {
    let app_conf = AppConf::read();

    let name = "LineByLine";
    let app_menu = Submenu::new(
        name,
        Menu::with_items([
            CustomMenuItem::new("About", "About LineByLine").into(),
            MenuItem::Services.into(),
            MenuItem::Hide.into(),
            MenuItem::HideOthers.into(),
            MenuItem::ShowAll.into(),
            MenuItem::Separator.into(),
            MenuItem::Quit.into(),
        ]),
    );

    let file_submenu = Submenu::new(
        "File",
        Menu::new().add_item(
            CustomMenuItem::new("Save".to_string(), "Save").accelerator("CommandOrCtrl + S"),
        ),
    );

    let edit_submenu = Submenu::new(
        "Edit",
        Menu::with_items([
            MenuItem::Undo.into(),
            MenuItem::Redo.into(),
            MenuItem::Separator.into(),
            MenuItem::Cut.into(),
            MenuItem::Copy.into(),
            MenuItem::Paste.into(),
            #[cfg(not(target_os = "macos"))]
            MenuItem::Separator.into(),
            MenuItem::SelectAll.into(),
        ]),
    );

    let theme_light = CustomMenuItem::new("theme_light", "Light");
    let theme_dark = CustomMenuItem::new("theme_dark", "Dark");
    let is_dark = app_conf.clone().theme_check("dark");
    let is_system = app_conf.clone().theme_check("system");

    let theme_submenu = Submenu::new(
        "Theme",
        Menu::new()
            .add_item(if is_dark || is_system {
                theme_light
            } else {
                theme_light.selected()
            })
            .add_item(if is_dark {
                theme_dark.selected()
            } else {
                theme_dark
            }),
    );

    let view_submenu = Submenu::new(
        "View",
        Menu::with_items([MenuItem::EnterFullScreen.into(), MenuItem::Separator.into()])
            .add_item(CustomMenuItem::new("DualView".to_string(), "Dual"))
            .add_item(CustomMenuItem::new("WysiwygView".to_string(), "Wysiwyg")),
    );

    let window_submenu = Submenu::new(
        "Window",
        Menu::with_items([MenuItem::Minimize.into(), MenuItem::Zoom.into()]),
    );

    let menu = Menu::new()
        .add_submenu(app_menu)
        .add_submenu(file_submenu)
        .add_submenu(edit_submenu)
        .add_submenu(theme_submenu)
        .add_submenu(view_submenu)
        .add_submenu(window_submenu);

    menu
}

pub fn menu_handler(event: WindowMenuEvent<tauri::Wry>) {
    let menu_id = event.menu_item_id();

    match menu_id {
        "Save" => {
            event
                .window()
                .emit("file_save", {})
                .map_err(|err| println!("{:?}", err))
                .ok();
        }
        "theme_light" | "theme_dark" => {
            let theme = match menu_id {
                "theme_dark" => "dark",
                _ => "light",
            };
            AppConf::read()
                .amend(serde_json::json!({ "theme": theme }))
                .write();

            let window = event.window();
            let menu_handle = window.menu_handle();

            menu_handle.get_item(menu_id).set_selected(true).unwrap();

            if theme == "light" {
                menu_handle.get_item("theme_dark").set_selected(false).unwrap();
            } else {
                menu_handle.get_item("theme_light").set_selected(false).unwrap();
            }

            event
                .window()
                .emit("change_theme", theme)
                .map_err(|err| println!("{:?}", err))
                .ok();
        }
        "About" => {
            event
                .window()
                .emit("dialog_setting_about", {})
                .map_err(|err| println!("{:?}", err))
                .ok();
        }
        "DualView" => {
            event
                .window()
                .emit("editor_toggle_type", "dual")
                .map_err(|err| println!("{:?}", err))
                .ok();
        }
        "WysiwygView" => {
            event
                .window()
                .emit("editor_toggle_type", "wysiwyg")
                .map_err(|err| println!("{:?}", err))
                .ok();
        }
        _ => {}
    }
}
