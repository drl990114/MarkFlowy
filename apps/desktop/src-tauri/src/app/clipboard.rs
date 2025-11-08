use arboard::Clipboard;
use tauri::command;

#[command]
pub fn get_clipboard_html() -> Result<String, String> {
    let mut clipboard = Clipboard::new().map_err(|e| e.to_string())?;

    let html_data = clipboard.get().html();
    match html_data {
        Ok(data) => Ok(data),
        Err(_) => Err("Clipboard does not contain HTML data.".to_string()),
    }
}

#[command]
pub fn get_clipboard_text() -> Result<String, String> {
    let mut clipboard = Clipboard::new().map_err(|e| e.to_string())?;

    let text_data = clipboard.get_text();
    match text_data {
        Ok(data) => Ok(data),
        Err(_) => Err("Clipboard does not contain text data.".to_string()),
    }
}
