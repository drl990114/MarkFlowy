# Keyboard binding contract

`keybindingDefaults.json` is the shared Desktop/Tauri catalog. Commands declare ownership and whether users may customize their bindings. Rules have independent, stable IDs and refer to command IDs. Editor implementation names belong only in the catalog's adapter metadata; they are never derived from user configuration.

To add a command, register its handler, add its catalog metadata, and add any default rules. Multiple rules can reference one command. A rule may provide `platforms.mac`, `platforms.windows`, or `platforms.linux` keys; its `keys` are the fallback. The current contexts are `always` and `editor_focus`. They describe execution scope, never edit permissions.

## Persistent configuration

`keybindings.json` stores version 1 overrides keyed by **rule ID**:

```json
{
  "version": 1,
  "overrides": {
    "app_save.default": { "keys": ["CommandOrCtrl", "Shift", "s"] },
    "editor_toggleStrong.default": { "keys": [] }
  }
}
```

An empty key list removes that binding. Restoring its default removes the override. User overrides apply across platforms; `CommandOrCtrl` stays portable in storage and resolves only for dispatch/display. A semantic key such as `1` and a physical key such as `[Digit1]` retain distinct identities.

Existing command IDs, rule IDs, and field meanings are stable. Extend version 1 with optional fields instead of changing these meanings. Unavailable rule IDs and unknown fields survive unrelated edits. Unsupported format versions and malformed files are reported without overwriting the file. No legacy format migration is provided.

Updates address one rule, validate against the current merged snapshot, and use an atomic file replacement under the shared Tauri lock. Other windows reload the authoritative snapshot. Snapshots carry a process-local monotonic revision so an out-of-order read or save response cannot replace newer settings. The settings editor currently edits catalog rules; it does not add arbitrary commands, contexts, or chord sequences.

## Clipboard and editor adapters

Copy and paste are native-only (`configurable: false`, `target: native`). Their defaults remain visible, edits are rejected before IPC and in Rust, and any handwritten overrides are ignored. Neither command enters the editor shortcut map. Capricorn has no custom host copy command.

Cut retains its existing additional-binding behavior and native default. Its browser event bridge still needs real WebView validation; disabling custom copy does not prove custom cut portable. A future explicit clipboard command must report asynchronous write failure and delete a cut selection only after a successful write against the unchanged document/selection.

Adapters group effective rules into alternative key combinations for each editor command. RME/CodeMirror and Capricorn update those alternatives without replacing the document, selection, or history. Arrays mean alternatives, not chords.

The design follows the command/rule separation in [VS Code's keyboard rules](https://code.visualstudio.com/docs/configure/keybindings#_keyboard-rules) and reuses Capricorn's configuration and validation API.
