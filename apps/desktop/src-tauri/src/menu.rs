use crate::app::conf::AppConf;
use crate::app::keybindings::Keybindings;
use tauri::menu::{
    CheckMenuItem, CheckMenuItemBuilder, Menu, MenuEvent, MenuItem, MenuItemBuilder,
    PredefinedMenuItem, Submenu,
};
use tauri::{App, AppHandle, Manager};

pub fn generate_menu(app: &mut App) -> Result<(), Box<dyn std::error::Error>> {
    let app_conf = AppConf::read();
    let _keyboard_infos = Keybindings::read();

    let is_dark = app_conf.clone().theme_check("dark");

    let theme_menu_light_item = CheckMenuItemBuilder::new("Light")
        .checked(!is_dark)
        .id("theme_light")
        .build(app);
    let theme_menu_dark_item = CheckMenuItemBuilder::new("Dark")
        .checked(is_dark)
        .id("theme_dark")
        .build(app);

    let theme_submenu = &Submenu::with_items(
        app,
        "Theme",
        true,
        &[&theme_menu_light_item, &theme_menu_dark_item],
    )?;

    let menu_handler = move |app: &AppHandle, event: MenuEvent| {
        let menu_id = event.id().as_ref();
        let binding = app.get_focused_window().unwrap();
        let focused_window: &str = binding.label();
        println!("focused_window: {}", focused_window);

        app.emit_to(focused_window, "native:menu", menu_id)
            .expect("failed to emit");

        match menu_id {
            "theme_light" | "theme_dark" => {
                let theme = match menu_id {
                    "theme_dark" => "dark",
                    _ => "light",
                };
                AppConf::read()
                    .amend(serde_json::json!({ "theme": theme }))
                    .write();

                if theme == "light" {
                    let _ = theme_menu_light_item.set_checked(true);
                    let _ = theme_menu_dark_item.set_checked(false);
                } else {
                    let _ = theme_menu_light_item.set_checked(false);
                    let _ = theme_menu_dark_item.set_checked(true);
                }

                app.emit_all("change_theme", theme)
                    .map_err(|err| println!("{:?}", err))
                    .ok();
            }
            "About" => {
                app.emit_to(focused_window, "dialog_setting_about", {})
                    .map_err(|err| println!("{:?}", err))
                    .ok();
            }
            "SourceCodeView" => {
                app.emit_to(focused_window, "editor_toggle_type", "sourceCode")
                    .map_err(|err| println!("{:?}", err))
                    .ok();
            }
            "WysiwygView" => {
                app.emit_to(focused_window, "editor_toggle_type", "wysiwyg")
                    .map_err(|err| println!("{:?}", err))
                    .ok();
            }
            _ => {}
        }
    };

    app.set_menu(Menu::with_items(
        app,
        &[
            &Submenu::with_items(
                app,
                "MarkFlowy",
                true,
                &[
                    &MenuItemBuilder::new("About MarkFlowy")
                        .id("About")
                        .build(app),
                    &PredefinedMenuItem::quit(app, Some("Quit")),
                ],
            )?,
            &Submenu::with_items(
                app,
                "File",
                true,
                &[&MenuItemBuilder::new("Save").id("editor:save").build(app)],
            )?,
            &Submenu::with_items(
                app,
                "Edit",
                true,
                &[
                    &PredefinedMenuItem::redo(app, None),
                    &PredefinedMenuItem::undo(app, None),
                    &PredefinedMenuItem::cut(app, None),
                    &PredefinedMenuItem::copy(app, None),
                    &PredefinedMenuItem::paste(app, None),
                    &PredefinedMenuItem::select_all(app, None),
                ],
            )?,
            &Submenu::with_items(
                app,
                "Paragraph",
                true,
                &[&MenuItemBuilder::new("Table")
                    .id("editor:dialog_create_table")
                    .build(app)],
            )?,
            theme_submenu,
            &Submenu::with_items(
                app,
                "View",
                true,
                &[
                    &MenuItemBuilder::new("SourceCode View")
                        .id("SourceCodeView")
                        .build(app),
                    &MenuItemBuilder::new("Wysiwyg View")
                        .id("WysiwygView")
                        .build(app),
                ],
            )?,
        ],
    )?)
    .expect("failed to set menu");

    app.on_menu_event(menu_handler);

    Ok(())
}
