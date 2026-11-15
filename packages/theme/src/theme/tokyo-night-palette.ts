// Color values follow the MarkText "Tokyo Night Storm" port (canvas #24283b,
// panel #1f2335, accent #7aa2f7). VS Code workbench keys keep their original
// roles so the mapping in `tokyo-night.ts` stays traceable; the original VS
// Code Tokyo Night palette by Enkia (MIT) remains the upstream family.
// License: ../../licenses/tokyo-night.txt.
export const tokyoNightPalette = {
  colors: {
    'foreground': '#a9b1d6',
    'descriptionForeground': '#545c7e',
    'disabledForeground': '#545c7e',
    'focusBorder': '#545c7e33',
    'widget.shadow': '#ffffff00',
    'button.background': '#7aa2f7',
    'button.foreground': '#1a1b26',
    'inputOption.activeBackground': '#7aa2f733',
    'toolbar.hoverBackground': '#292e42',
    'toolbar.activeBackground': '#3b4261',
    'panel.background': '#1f2335',
    'panel.border': '#414868',
    'sideBar.background': '#1f2335',
    'sideBarSectionHeader.background': '#1f2335',
    'titleBar.activeBackground': '#1f2335',
    'statusBar.background': '#1f2335',
    'tab.inactiveBackground': '#1f2335',
    'tab.activeBackground': '#24283b',
    'tree.indentGuidesStroke': '#3b4261',
    'list.activeSelectionBackground': '#292e42',
    'scrollbarSlider.background': '#414868aa',
    'editor.background': '#24283b',
    'editor.foreground': '#c0caf5',
    'editorCursor.foreground': '#c0caf5',
    'editor.selectionBackground': '#515c7e66',
    'editor.inactiveSelectionBackground': '#515c7e33',
    'editor.lineHighlightBackground': '#292e42',
    'editorLineNumber.activeForeground': '#a9b1d6',
    'editorError.foreground': '#f7768e',
    'editorWarning.foreground': '#e0af68',
    'gitDecoration.addedResourceForeground': '#9ece6a',
    'diffEditor.removedTextBackground': '#f7768e22',
    'diffEditor.insertedTextBackground': '#9ece6a22',
    'editor.stackFrameHighlightBackground': '#e0af6822',
    'textCodeBlock.background': '#1f2335',
    'textLink.foreground': '#7dcfff',
    'editorHoverWidget.background': '#1f2335',
    'editorWidget.background': '#1f2335',
    'menu.background': '#1f2335',
    'menu.selectionBackground': '#292e42',
    'progressBar.background': '#7aa2f7',
  },
  syntax: {
    comment: '#565f89', // Comment
    keyword: '#bb9af7', // Keyword
    string: '#9ece6a', // String, Symbols
    number: '#ff9e64', // Number, Boolean, Undefined, Null
    function: '#7aa2f7', // Function Definition
    variable: '#c0caf5', // Variables
    attribute: '#bb9af7', // HTML Attributes
    tag: '#f7768e', // Tag
    punctuation: '#89ddff', // Operator, Misc
    meta: '#73daca', // Preprocessor
  },
} as const
