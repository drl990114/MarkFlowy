use regex::Regex;

pub fn is_md_file_name(file_name: &str) -> bool {
    let reg = Regex::new(r"\.md$").unwrap();

    reg.is_match(file_name)
}
