use tauri::Menu;

use tauri::{MenuItem, Submenu, CustomMenuItem};

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
    let view_submenu = Submenu::new("View", Menu::with_items([MenuItem::EnterFullScreen.into()]));

    let window_submenu = Submenu::new(
        "Window",
        Menu::with_items([MenuItem::Minimize.into(), MenuItem::Zoom.into()]),
    );

    let hide = CustomMenuItem::new("test".to_string(), "Test");
    let menu = Menu::new()
        // let menu = Menu::os_default("test")
        .add_native_item(MenuItem::Copy)
        .add_item(hide)
        .add_submenu(file_submenu)
        .add_submenu(edit_submenu)
        .add_submenu(view_submenu)
        .add_submenu(window_submenu);

    menu
}
