use crate::app::window_manager::get_focused_window;
use tauri::menu::{
    CheckMenuItem, CheckMenuItemBuilder, Menu, MenuEvent, MenuItem, MenuItemBuilder,
    PredefinedMenuItem, Submenu,
};
use tauri::{App, AppHandle, Emitter};

const QUIT_MENU_ID: &str = "app_quit";

fn handle_app_menu_action(menu_id: &str, request_exit: impl FnOnce(i32)) -> bool {
    if menu_id != QUIT_MENU_ID {
        return false;
    }
    request_exit(0);
    true
}

pub fn generate_menu(app: &mut App) -> Result<(), Box<dyn std::error::Error>> {
    // let is_dark = app_conf.clone().theme_check("dark");

    // let theme_menu_light_item = CheckMenuItemBuilder::new("Light")
    //     .checked(!is_dark)
    //     .id("theme_light")
    //     .build(app);
    // let theme_menu_dark_item = CheckMenuItemBuilder::new("Dark")
    //     .checked(is_dark)
    //     .id("theme_dark")
    //     .build(app);

    // let theme_submenu = &Submenu::with_items(
    //     app,
    //     "Theme",
    //     true,
    //     &[&theme_menu_light_item, &theme_menu_dark_item],
    // )?;

    let menu_handler = move |app: &AppHandle, event: MenuEvent| {
        let menu_id = event.id().as_ref();

        // Quit is application-wide, including when no editor window has focus.
        // AppHandle::exit emits ExitRequested, whose handler waits for each
        // window's draft protection before destroying it.
        if handle_app_menu_action(menu_id, |code| app.exit(code)) {
            return;
        }

        // 获取当前焦点窗口
        if let Some(window) = get_focused_window(app) {
            let focused_window_label = window.label();
            println!("focused_window: {}", focused_window_label);

            // 发送菜单事件到焦点窗口
            app.emit_to(&focused_window_label, "native:menu", menu_id)
                .expect("failed to emit");

            // 处理特定的菜单事件
            match menu_id {
                "About" => {
                    app.emit_to(&focused_window_label, "app_about", {})
                        .map_err(|err| println!("{:?}", err))
                        .ok();
                }
                "Settings" => {
                    app.emit_to(&focused_window_label, "native:menu", "app_openSetting")
                        .map_err(|err| println!("{:?}", err))
                        .ok();
                }
                _ => {}
            }
        } else {
            println!("No focused window found for menu event");
        }
    };

    let menu_items = Menu::with_items(
        app,
        &[
            &Submenu::with_items(
                app,
                "MarkFlowy",
                true,
                &[
                    &MenuItemBuilder::new("About MarkFlowy")
                        .id("About")
                        .build(app)?,
                    &MenuItemBuilder::new("Settings").id("Settings").build(app)?,
                    // Muda's predefined macOS Quit invokes Cocoa terminate:
                    // directly, bypassing Tauri's preventable ExitRequested.
                    &MenuItemBuilder::new("Quit")
                        .id(QUIT_MENU_ID)
                        .accelerator("CmdOrCtrl+Q")
                        .build(app)?,
                ],
            )?,
            &Submenu::with_items(
                app,
                "File",
                true,
                &[&MenuItemBuilder::new("Save").id("app_save").build(app)?],
            )?,
            &Submenu::with_items(
                app,
                "Edit",
                true,
                &[
                    &PredefinedMenuItem::redo(app, None)?,
                    &PredefinedMenuItem::undo(app, None)?,
                    &PredefinedMenuItem::cut(app, None)?,
                    &PredefinedMenuItem::copy(app, None)?,
                    &PredefinedMenuItem::paste(app, None)?,
                    &PredefinedMenuItem::select_all(app, None)?,
                ],
            )?,
            // &Submenu::with_items(
            //     app,
            //     "View",
            //     true,
            //     &[
            //         &MenuItemBuilder::new("SourceCode View")
            //             .id("SourceCodeView")
            //             .build(app)?,
            //         &MenuItemBuilder::new("Wysiwyg View")
            //             .id("WysiwygView")
            //             .build(app)?,
            //     ],
            // )?,
        ],
    )?;

    app.set_menu(menu_items).expect("failed to set menu");

    app.on_menu_event(menu_handler);

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::handle_app_menu_action;

    #[test]
    fn quit_requests_normal_exit_without_needing_a_focused_window() {
        let mut requests = Vec::new();
        let handled = handle_app_menu_action("app_quit", |code| requests.push(code));

        assert!(handled);
        assert_eq!(requests, [0]);
    }

    #[test]
    fn window_menu_actions_do_not_request_an_application_exit() {
        for menu_id in ["About", "Settings", "app_save", "unknown"] {
            assert!(!handle_app_menu_action(menu_id, |_| {
                panic!("A window menu action requested application exit")
            }));
        }
    }
}
