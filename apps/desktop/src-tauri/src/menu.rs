use crate::app::keybindings::Keybindings;
use crate::app::{conf::AppConf, keybindings::KeybindingInfo};
use tauri::{CustomMenuItem, Manager, Menu, MenuItem, Submenu, WindowMenuEvent};

pub fn generate_menu() -> Menu {
    let app_conf = AppConf::read();
    let keyboard_infos = Keybindings::read();

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
            // FIXME this will trigger twice, because in web will trigger too
            // this trigger event need disable, wait for tauri support
            // https://github.com/tauri-apps/tauri/discussions/7793
            CustomMenuItem::new("editor:save".to_string(), "Save"),
            // .accelerator(
            //     keyboard_infos
            //         .get_accelerator("editor:save".to_string())
            //         .unwrap(),
            // ),
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

    let paragraph_submenu = Submenu::new(
        "Paragraph",
        Menu::new().add_item(CustomMenuItem::new(
            "editor:dialog_create_table".to_string(),
            "Table",
        )),
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
            .add_item(CustomMenuItem::new(
                "SourceCodeView".to_string(),
                "Source Code",
            ))
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
        .add_submenu(paragraph_submenu)
        .add_submenu(theme_submenu)
        .add_submenu(view_submenu)
        .add_submenu(window_submenu);

    menu
}

pub fn menu_handler(event: WindowMenuEvent<tauri::Wry>) {
    let menu_id = event.menu_item_id();
    let window = event.window();
    let menu_handle = window.menu_handle();

    window
        .emit("native:menu", menu_id)
        .unwrap();

    match menu_id {
        "theme_light" | "theme_dark" => {
            let theme = match menu_id {
                "theme_dark" => "dark",
                _ => "light",
            };
            AppConf::read()
                .amend(serde_json::json!({ "theme": theme }))
                .write();

            menu_handle.get_item(menu_id).set_selected(true).unwrap();

            if theme == "light" {
                menu_handle
                    .get_item("theme_dark")
                    .set_selected(false)
                    .unwrap();
            } else {
                menu_handle
                    .get_item("theme_light")
                    .set_selected(false)
                    .unwrap();
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
        "SourceCodeView" => {
            event
                .window()
                .emit("editor_toggle_type", "sourceCode")
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
