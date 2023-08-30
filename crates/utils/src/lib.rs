use regex::Regex;

pub fn is_md_file_name(file_name: &str) -> bool {
    let reg = Regex::new(r"\.md$").unwrap();

    reg.is_match(file_name)
}


#[cfg(test)]
mod tests {
    #[test]
    fn test_md_file_name() {
        assert!(super::is_md_file_name("test.md"));
        assert!(!super::is_md_file_name("test.txt"));
        assert!(!super::is_md_file_name("test.mdx"));
    }
}
