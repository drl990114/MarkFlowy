use super::conf;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

const CONFIGURATION_VERSION: u32 = 1;

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
enum KeybindingScope {
    Always,
    EditorFocus,
}

impl KeybindingScope {
    fn overlaps(&self, other: &Self) -> bool {
        self == &Self::Always || other == &Self::Always || self == other
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "lowercase")]
enum CommandTarget {
    App,
    Editor,
    Native,
}

#[derive(Deserialize)]
struct KeybindingCommand {
    id: String,
    configurable: bool,
    target: CommandTarget,
}

#[derive(Deserialize)]
struct KeybindingRule {
    id: String,
    command: String,
    keys: Vec<String>,
    when: KeybindingScope,
    #[serde(default)]
    platforms: BTreeMap<String, Vec<String>>,
}

#[derive(Deserialize)]
struct KeybindingCatalog {
    commands: Vec<KeybindingCommand>,
    rules: Vec<KeybindingRule>,
}

fn catalog() -> KeybindingCatalog {
    // Shared with Desktop: command policy and defaults have one source of truth.
    serde_json::from_str(include_str!(
        "../../../src/commands/keybindingDefaults.json"
    ))
    .expect("Invalid built-in keybinding catalog")
}

fn platform() -> &'static str {
    if cfg!(target_os = "macos") {
        "mac"
    } else if cfg!(target_os = "windows") {
        "windows"
    } else {
        "linux"
    }
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct KeybindingInfo {
    id: String,
    command: String,
    keys: Vec<String>,
    default_keys: Vec<String>,
    when: KeybindingScope,
    configurable: bool,
    target: CommandTarget,
}

#[derive(Serialize, Debug, Clone)]
pub struct Keybindings {
    revision: u64,
    rules: Vec<KeybindingInfo>,
}

/// User data contains overrides only. Runtime ownership and policy stay in the catalog.
#[derive(Serialize, Deserialize, Debug, Clone)]
struct KeybindingOverride {
    keys: Vec<String>,
    #[serde(flatten)]
    extra: BTreeMap<String, serde_json::Value>,
}

#[derive(Serialize, Deserialize, Debug)]
struct KeybindingConfiguration {
    version: u32,
    overrides: BTreeMap<String, KeybindingOverride>,
    // Preserve additive fields and temporarily unavailable rules on unrelated edits.
    #[serde(flatten)]
    extra: BTreeMap<String, serde_json::Value>,
}

impl Default for KeybindingConfiguration {
    fn default() -> Self {
        Self {
            version: CONFIGURATION_VERSION,
            overrides: BTreeMap::new(),
            extra: BTreeMap::new(),
        }
    }
}

impl KeybindingConfiguration {
    fn read_from(path: &Path) -> Result<Self, String> {
        match std::fs::read_to_string(path) {
            Ok(content) => {
                let configuration: Self = serde_json::from_str(&content)
                    .map_err(|error| format!("Invalid keyboard configuration: {error}"))?;
                if configuration.version != CONFIGURATION_VERSION {
                    return Err("Unsupported keyboard configuration version".into());
                }
                Ok(configuration)
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(Self::default()),
            Err(error) => Err(format!("Failed to read keyboard configuration: {error}")),
        }
    }

    fn update(
        &mut self,
        bindings: &Keybindings,
        id: &str,
        keys: Vec<String>,
    ) -> Result<(), String> {
        let current = bindings
            .rules
            .iter()
            .find(|rule| rule.id == id)
            .ok_or("Unknown rule")?;
        if !current.configurable {
            return Err("This shortcut is managed by the system".into());
        }
        let keys = normalize_keys(&keys)?;
        validate_keys(&keys, &current.command, &current.target)?;
        if bindings.rules.iter().any(|rule| {
            rule.command != current.command
                && rule.when.overlaps(&current.when)
                && keys_overlap(&rule.keys, &keys)
        }) {
            return Err("Shortcut conflicts with another command".into());
        }
        if keys == current.default_keys {
            self.overrides.remove(id);
        } else {
            self.overrides
                .entry(id.to_string())
                .and_modify(|value| value.keys = keys.clone())
                .or_insert(KeybindingOverride {
                    keys,
                    extra: BTreeMap::new(),
                });
        }
        // A hand-edited override cannot change a native command now or be resurrected later.
        self.overrides.retain(|id, _| {
            bindings
                .rules
                .iter()
                .find(|rule| &rule.id == id)
                .is_none_or(|rule| rule.configurable)
        });
        Ok(())
    }

    fn write_to(&self, path: &Path) -> Result<(), String> {
        let content = serde_json::to_vec_pretty(self).map_err(|error| error.to_string())?;
        let directory = path
            .parent()
            .ok_or("Keyboard configuration has no parent directory")?;
        std::fs::create_dir_all(directory).map_err(|error| error.to_string())?;
        let mut temporary = tempfile::Builder::new()
            .prefix(".keyboard-")
            .tempfile_in(directory)
            .map_err(|error| error.to_string())?;
        if let Ok(metadata) = std::fs::metadata(path) {
            temporary
                .as_file()
                .set_permissions(metadata.permissions())
                .map_err(|error| error.to_string())?;
        }
        temporary
            .write_all(&content)
            .map_err(|error| error.to_string())?;
        temporary
            .as_file()
            .sync_all()
            .map_err(|error| error.to_string())?;
        temporary
            .persist(path)
            .map_err(|error| error.error.to_string())?;
        Ok(())
    }
}

impl Keybindings {
    fn resolve(
        catalog: KeybindingCatalog,
        configuration: &KeybindingConfiguration,
        platform: &str,
    ) -> Self {
        let rules = catalog
            .rules
            .into_iter()
            .map(|rule| {
                let command = catalog
                    .commands
                    .iter()
                    .find(|command| command.id == rule.command)
                    .expect("Unknown built-in keybinding command");
                let default_keys = rule.platforms.get(platform).unwrap_or(&rule.keys).clone();
                let keys = if command.configurable {
                    configuration
                        .overrides
                        .get(&rule.id)
                        .map(|value| {
                            normalize_keys(&value.keys).unwrap_or_else(|_| value.keys.clone())
                        })
                        .unwrap_or_else(|| default_keys.clone())
                } else {
                    default_keys.clone()
                };
                KeybindingInfo {
                    id: rule.id,
                    command: rule.command,
                    keys,
                    default_keys,
                    when: rule.when,
                    configurable: command.configurable,
                    target: command.target.clone(),
                }
            })
            .collect();
        Self { revision: 0, rules }
    }

    pub fn get_path() -> PathBuf {
        conf::app_root().join("keybindings.json")
    }

    pub fn read() -> Result<Self, String> {
        let configuration = KeybindingConfiguration::read_from(&Self::get_path())?;
        Ok(Self::resolve(catalog(), &configuration, platform()))
    }
}

fn normalize_keys(keys: &[String]) -> Result<Vec<String>, String> {
    if keys.is_empty() {
        return Ok(vec![]);
    }
    let mut modifiers = std::collections::BTreeSet::new();
    let mut primary = None;
    for key in keys {
        let lower = key.to_lowercase();
        let modifier = match lower.as_str() {
            "commandorctrl" | "mod" => Some("CommandOrCtrl"),
            "ctrl" | "control" => Some("Ctrl"),
            "meta" | "cmd" | "command" => Some("Meta"),
            "alt" | "option" => Some("Alt"),
            "shift" => Some("Shift"),
            _ => None,
        };
        if let Some(modifier) = modifier {
            modifiers.insert(modifier);
            continue;
        }
        if primary.is_some() {
            return Err("Only one primary key is supported".into());
        }
        let named = [
            "Space",
            "Tab",
            "Enter",
            "Escape",
            "Backspace",
            "Delete",
            "Insert",
            "ArrowUp",
            "ArrowDown",
            "ArrowLeft",
            "ArrowRight",
            "Home",
            "End",
            "PageUp",
            "PageDown",
            "CapsLock",
            "Pause",
        ];
        primary = if key == " " {
            Some("Space".to_string())
        } else if key.chars().count() == 1 {
            Some(lower.clone())
        } else if let Some(named) = named.iter().find(|named| named.to_lowercase() == lower) {
            Some(named.to_string())
        } else if regex::Regex::new(r"(?i)^f([1-9]|1[0-9])$")
            .unwrap()
            .is_match(key)
        {
            Some(key.to_uppercase())
        } else if let Some(code) = normalize_physical_code(key) {
            Some(format!("[{code}]"))
        } else {
            return Err("Unknown primary key".into());
        };
    }
    let primary = primary.ok_or("A primary key is required")?;
    let mut result: Vec<String> = ["CommandOrCtrl", "Ctrl", "Meta", "Alt", "Shift"]
        .iter()
        .filter(|key| modifiers.contains(**key))
        .map(|key| key.to_string())
        .collect();
    result.push(primary);
    Ok(result)
}

fn normalize_physical_code(key: &str) -> Option<String> {
    let code = key.strip_prefix('[')?.strip_suffix(']')?;
    let mut codes: Vec<String> = [
        "Space",
        "Tab",
        "Enter",
        "Escape",
        "Backspace",
        "Delete",
        "Insert",
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "Home",
        "End",
        "PageUp",
        "PageDown",
        "CapsLock",
        "Pause",
        "Backquote",
        "Backslash",
        "BracketLeft",
        "BracketRight",
        "Comma",
        "Equal",
        "Minus",
        "Period",
        "Quote",
        "Semicolon",
        "Slash",
    ]
    .iter()
    .map(|value| value.to_string())
    .collect();
    codes.extend(('A'..='Z').map(|letter| format!("Key{letter}")));
    codes.extend((0..=9).flat_map(|digit| [format!("Digit{digit}"), format!("Numpad{digit}")]));
    codes.extend((1..=19).map(|number| format!("F{number}")));
    codes.extend(
        ["Add", "Comma", "Decimal", "Divide", "Multiply", "Subtract"]
            .iter()
            .map(|key| format!("Numpad{key}")),
    );
    codes
        .into_iter()
        .find(|candidate| candidate.eq_ignore_ascii_case(code))
}

fn numpad_values(primary: &str) -> &[&str] {
    match primary {
        "[Numpad0]" => &["0", "Insert"],
        "[Numpad1]" => &["1", "End"],
        "[Numpad2]" => &["2", "ArrowDown"],
        "[Numpad3]" => &["3", "PageDown"],
        "[Numpad4]" => &["4", "ArrowLeft"],
        "[Numpad5]" => &["5", "Clear"],
        "[Numpad6]" => &["6", "ArrowRight"],
        "[Numpad7]" => &["7", "Home"],
        "[Numpad8]" => &["8", "ArrowUp"],
        "[Numpad9]" => &["9", "PageUp"],
        "[NumpadAdd]" => &["+"],
        "[NumpadSubtract]" => &["-"],
        "[NumpadMultiply]" => &["*"],
        "[NumpadDivide]" => &["/"],
        "[NumpadDecimal]" => &[".", ",", "Delete"],
        "[NumpadComma]" => &[",", "."],
        _ => &[],
    }
}

fn keys_overlap(left: &[String], right: &[String]) -> bool {
    let a = canonical_keys(left);
    let b = canonical_keys(right);
    if a.is_empty() || b.is_empty() {
        return false;
    }
    if a == b {
        return true;
    }
    [(left, &b), (right, &a)].iter().any(|(keys, other)| {
        let Ok(mut keys) = normalize_keys(keys) else {
            return false;
        };
        let primary = keys.pop().unwrap();
        numpad_values(&primary).iter().any(|alias| {
            let mut candidate = keys.clone();
            candidate.push(alias.to_string());
            canonical_keys(&candidate) == **other
        })
    })
}

fn canonical_keys(keys: &[String]) -> String {
    let Ok(keys) = normalize_keys(keys) else {
        return String::new();
    };
    if keys.is_empty() {
        return String::new();
    }
    let primary = keys.last().unwrap();
    let modifiers: std::collections::BTreeSet<_> = keys[..keys.len() - 1]
        .iter()
        .map(|key| {
            if key == "CommandOrCtrl" {
                if cfg!(target_os = "macos") {
                    "Meta"
                } else {
                    "Ctrl"
                }
            } else {
                key.as_str()
            }
        })
        .collect();
    modifiers
        .into_iter()
        .chain(std::iter::once(primary.as_str()))
        .collect::<Vec<_>>()
        .join("-")
}

fn validate_keys(keys: &[String], id: &str, target: &CommandTarget) -> Result<(), String> {
    let Some(primary) = keys.last() else {
        return Ok(());
    };
    if !keys[..keys.len() - 1].iter().any(|key| key != "Shift")
        && !regex::Regex::new(r"^\[?F[0-9]+\]?$")
            .unwrap()
            .is_match(primary)
    {
        return Err("A modifier is required".into());
    }
    if target == &CommandTarget::Editor
        && regex::Regex::new(r"^(Arrow|Enter$|Tab$|Backspace$|Delete$|Home$|End$|Page)")
            .unwrap()
            .is_match(primary.trim_matches(['[', ']']))
    {
        return Err("Reserved editor key".into());
    }
    let mut clipboard_keys = keys.to_vec();
    if matches!(primary.as_str(), "[KeyC]" | "[KeyX]" | "[KeyV]") {
        *clipboard_keys.last_mut().unwrap() = primary[4..5].to_lowercase();
    }
    let primary = clipboard_keys.last().unwrap();
    let canonical = canonical_keys(&clipboard_keys);
    let modifier = if cfg!(target_os = "macos") {
        "Meta"
    } else {
        "Ctrl"
    };
    if (canonical == format!("{modifier}-c") && id != "editor_copy")
        || (canonical == format!("{modifier}-x") && id != "editor_cut")
        || (primary == "v"
            && canonical.split('-').any(|key| key == modifier)
            && id != "editor_paste")
    {
        return Err("Reserved clipboard key".into());
    }
    Ok(())
}

// Assign snapshot revisions while holding the same lock as file reads and writes.
static KEYBINDINGS_LOCK: Mutex<u64> = Mutex::new(0);

pub mod cmd {
    use super::{catalog, platform, KeybindingConfiguration, Keybindings, KEYBINDINGS_LOCK};
    use tauri::{command, Emitter};

    #[command]
    pub fn get_keyboard_infos() -> Result<Keybindings, String> {
        let mut revision = KEYBINDINGS_LOCK.lock().map_err(|error| error.to_string())?;
        let mut bindings = Keybindings::read()?;
        *revision += 1;
        bindings.revision = *revision;
        Ok(bindings)
    }

    #[command]
    pub fn update_keybinding(
        app: tauri::AppHandle,
        rule_id: String,
        keys: Vec<String>,
    ) -> Result<Keybindings, String> {
        let mut revision = KEYBINDINGS_LOCK.lock().map_err(|error| error.to_string())?;
        let path = Keybindings::get_path();
        let mut configuration = KeybindingConfiguration::read_from(&path)?;
        let bindings = Keybindings::resolve(catalog(), &configuration, platform());
        configuration.update(&bindings, &rule_id, keys)?;
        configuration.write_to(&path)?;
        let mut bindings = Keybindings::resolve(catalog(), &configuration, platform());
        *revision += 1;
        bindings.revision = *revision;
        drop(revision);
        if let Err(error) = app.emit("keyboard-bindings-changed", ()) {
            log::warn!("Failed to broadcast keyboard changes: {error}");
        }
        Ok(bindings)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn resolved(config: &KeybindingConfiguration) -> Keybindings {
        Keybindings::resolve(catalog(), config, platform())
    }

    fn update(
        config: &mut KeybindingConfiguration,
        command: &str,
        keys: &[&str],
    ) -> Result<(), String> {
        config.update(
            &resolved(config),
            &format!("{command}.default"),
            keys.iter().map(|key| key.to_string()).collect(),
        )
    }

    fn rule<'a>(bindings: &'a Keybindings, command: &str) -> &'a KeybindingInfo {
        bindings
            .rules
            .iter()
            .find(|rule| rule.command == command)
            .unwrap()
    }

    #[test]
    fn copy_and_paste_cannot_be_rebound_cleared_or_overridden_from_disk() {
        let mut config = KeybindingConfiguration::default();
        for command in ["editor_copy", "editor_paste"] {
            assert!(update(&mut config, command, &[]).is_err());
            assert!(update(&mut config, command, &["Alt", "c"]).is_err());
            config.overrides.insert(
                format!("{command}.default"),
                KeybindingOverride {
                    keys: vec!["Alt".into(), "c".into()],
                    extra: BTreeMap::new(),
                },
            );
        }
        let bindings = resolved(&config);
        assert_eq!(rule(&bindings, "editor_copy").keys, ["CommandOrCtrl", "c"]);
        assert_eq!(rule(&bindings, "editor_paste").keys, ["CommandOrCtrl", "v"]);
        assert!(!rule(&bindings, "editor_copy").configurable);
        assert_eq!(
            rule(&bindings, "editor_copy").when,
            KeybindingScope::EditorFocus
        );
        update(&mut config, "app_save", &["Alt", "s"]).unwrap();
        assert!(!config.overrides.contains_key("editor_copy.default"));
        assert!(!config.overrides.contains_key("editor_paste.default"));
    }

    #[test]
    fn normalizes_keys_and_rejects_conflicts_without_mutation() {
        let mut config = KeybindingConfiguration::default();
        for (command, keys) in [
            ("editor_toggleStrong", vec!["CommandOrCtrl", "s"]),
            ("app_save", vec!["Ctrl"]),
            ("app_save", vec!["a"]),
            ("editor_toggleStrong", vec!["CommandOrCtrl", "ArrowUp"]),
            ("app_save", vec!["CommandOrCtrl", "[KeyC]"]),
        ] {
            assert!(update(&mut config, command, &keys).is_err());
        }
        assert!(config.overrides.is_empty());
        update(&mut config, "app_save", &["CommandOrCtrl", "S"]).unwrap();
        assert!(config.overrides.is_empty());
        assert_eq!(
            normalize_keys(&["Ctrl".into(), "Shift".into(), "+".into()]).unwrap(),
            ["Ctrl", "Shift", "+"]
        );
        let modifier = if cfg!(target_os = "macos") {
            "Meta"
        } else {
            "Ctrl"
        };
        assert!(update(&mut config, "app_hide", &[modifier, "s"]).is_err());
    }

    #[test]
    fn atomically_round_trips_overrides_removal_and_reset() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("keybindings.json");
        let mut config = KeybindingConfiguration::read_from(&path).unwrap();
        assert!(!path.exists());
        update(&mut config, "editor_toggleStrong", &[]).unwrap();
        update(&mut config, "app_save", &["Alt", "s"]).unwrap();
        config.write_to(&path).unwrap();
        let stored: serde_json::Value =
            serde_json::from_slice(&std::fs::read(&path).unwrap()).unwrap();
        assert_eq!(stored["version"], 1);
        assert_eq!(stored["overrides"].as_object().unwrap().len(), 2);
        assert_eq!(
            stored["overrides"]["app_save.default"],
            serde_json::json!({ "keys": ["Alt", "s"] })
        );
        let mut loaded = KeybindingConfiguration::read_from(&path).unwrap();
        let bindings = resolved(&loaded);
        assert!(rule(&bindings, "editor_toggleStrong").keys.is_empty());
        assert_eq!(
            rule(&bindings, "editor_toggleStrong").default_keys,
            ["CommandOrCtrl", "b"]
        );
        update(&mut loaded, "editor_toggleStrong", &["CommandOrCtrl", "b"]).unwrap();
        loaded.write_to(&path).unwrap();
        assert_eq!(
            KeybindingConfiguration::read_from(&path)
                .unwrap()
                .overrides
                .len(),
            1
        );
        assert_eq!(rule(&resolved(&loaded), "app_save").keys, ["Alt", "s"]);
    }

    #[test]
    fn malformed_future_or_unwritable_configuration_is_reported_and_preserved() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("invalid.json");
        for content in ["broken config", r#"{"version":2,"overrides":{}}"#] {
            std::fs::write(&path, content).unwrap();
            assert!(KeybindingConfiguration::read_from(&path).is_err());
            assert_eq!(std::fs::read_to_string(&path).unwrap(), content);
        }
        let target = directory.path().join("existing-directory");
        std::fs::create_dir(&target).unwrap();
        std::fs::write(target.join("keep"), "original").unwrap();
        assert!(KeybindingConfiguration::default()
            .write_to(&target)
            .is_err());
        assert_eq!(
            std::fs::read_to_string(target.join("keep")).unwrap(),
            "original"
        );
        assert_eq!(std::fs::read_dir(directory.path()).unwrap().count(), 2);
    }

    #[test]
    fn unrelated_edits_preserve_unavailable_rules_and_additive_fields() {
        let mut config: KeybindingConfiguration = serde_json::from_value(serde_json::json!({
            "version": 1,
            "futureOption": true,
            "overrides": {
                "extension.example": { "keys": ["Alt", "e"], "futureRuleOption": 42 },
                "app_save.default": { "keys": ["Alt", "s"], "futureRuleOption": 7 }
            }
        }))
        .unwrap();
        update(&mut config, "app_save", &["Alt", "a"]).unwrap();
        let stored = serde_json::to_value(&config).unwrap();
        assert_eq!(stored["futureOption"], true);
        assert_eq!(
            stored["overrides"]["extension.example"]["futureRuleOption"],
            42
        );
        assert_eq!(
            stored["overrides"]["app_save.default"]["futureRuleOption"],
            7
        );
        assert_eq!(rule(&resolved(&config), "app_save").keys, ["Alt", "a"]);
    }

    #[test]
    fn rules_are_independent_of_commands_and_resolve_platform_defaults() {
        let mut defaults = catalog();
        defaults.rules.push(KeybindingRule {
            id: "save.alternative".into(),
            command: "app_save".into(),
            keys: vec!["Alt".into(), "s".into()],
            when: KeybindingScope::Always,
            platforms: BTreeMap::from([(
                "windows".into(),
                vec!["Ctrl".into(), "Alt".into(), "s".into()],
            )]),
        });
        let mut config = KeybindingConfiguration::default();
        let bindings = Keybindings::resolve(defaults, &config, "windows");
        assert_eq!(
            bindings
                .rules
                .iter()
                .filter(|rule| rule.command == "app_save")
                .count(),
            2
        );
        assert_eq!(bindings.rules.last().unwrap().keys, ["Ctrl", "Alt", "s"]);
        config
            .update(
                &bindings,
                "save.alternative",
                vec!["Alt".into(), "a".into()],
            )
            .unwrap();
        assert!(!config.overrides.contains_key("app_save.default"));
        assert!(config.overrides.contains_key("save.alternative"));
    }

    #[test]
    fn detects_semantic_and_physical_numpad_conflicts_in_both_directions() {
        let mut config = KeybindingConfiguration::default();
        assert!(update(&mut config, "app_save", &["CommandOrCtrl", "[Numpad1]"]).is_err());
        update(&mut config, "editor_toggleH1", &[]).unwrap();
        update(&mut config, "app_save", &["CommandOrCtrl", "[Numpad1]"]).unwrap();
        assert!(update(&mut config, "editor_toggleH1", &["CommandOrCtrl", "1"]).is_err());
        assert!(keys_overlap(
            &["Ctrl".into(), "[NumpadDecimal]".into()],
            &["Ctrl".into(), ",".into()]
        ));
        assert!(keys_overlap(
            &["Ctrl".into(), "[Numpad1]".into()],
            &["Ctrl".into(), "End".into()]
        ));
        assert!(!keys_overlap(
            &["Ctrl".into(), "Shift".into(), "[Numpad1]".into()],
            &["Ctrl".into(), "1".into()]
        ));
    }

    #[test]
    fn round_trips_semantic_and_physical_keys_without_rewriting_them() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("keybindings.json");
        let mut config = KeybindingConfiguration::default();
        for primary in ["1", "=", "[Digit1]", "[Equal]", "[Numpad1]"] {
            update(&mut config, "app_save", &["Ctrl", "Shift", primary]).unwrap();
            config.write_to(&path).unwrap();
            let loaded = KeybindingConfiguration::read_from(&path).unwrap();
            assert_eq!(
                rule(&resolved(&loaded), "app_save").keys,
                ["Ctrl", "Shift", primary]
            );
        }
        assert!(update(&mut config, "app_save", &["Ctrl", "Numpad1"]).is_err());
    }

    #[test]
    fn default_catalog_has_unique_stable_rule_ids_and_known_commands() {
        let defaults = catalog();
        let mut ids = std::collections::HashSet::new();
        for rule in &defaults.rules {
            assert!(ids.insert(&rule.id), "duplicate rule: {}", rule.id);
            assert!(defaults
                .commands
                .iter()
                .any(|command| command.id == rule.command));
        }
        let bindings = resolved(&KeybindingConfiguration::default());
        assert_eq!(
            rule(&bindings, "app_quickOpen").keys,
            ["CommandOrCtrl", "p"]
        );
        assert_eq!(
            rule(&bindings, "app_toggleZenMode").keys,
            ["CommandOrCtrl", "Shift", "f"]
        );
    }
}
