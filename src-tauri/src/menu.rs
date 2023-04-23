use tauri::Menu;

use tauri::{CustomMenuItem, MenuItem, Submenu};

pub fn generate_menu() -> Menu {
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
        .add_native_item(MenuItem::Copy)
        .add_submenu(file_submenu)
        .add_submenu(edit_submenu)
        .add_submenu(view_submenu)
        .add_submenu(window_submenu);

    menu
}
