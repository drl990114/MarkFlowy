pub mod cmd {
    use tauri::command;
    use font_kit::source::SystemSource;

    #[command]
    pub fn font_list() -> Vec<String> {
      let source = SystemSource::new();
      let fonts = source.all_families().unwrap();

      fonts
    }
}
