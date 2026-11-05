// Color values from the original VS Code Tokyo Night 1.1.2 by Enkia (MIT).
// https://github.com/tokyo-night/tokyo-night-vscode-theme/blob/7c0f11eaef322f293621ca7befe462214b7ea468/themes/tokyo-night-color-theme.json
// Keep upstream workbench keys and TextMate rule names traceable; do not substitute
// Storm, Light or Neovim palettes. License: ../../licenses/tokyo-night.txt.
export const tokyoNightPalette = {
  colors: {
    'foreground': '#787c99',
    'descriptionForeground': '#515670',
    'disabledForeground': '#545c7e',
    'focusBorder': '#545c7e33',
    'widget.shadow': '#ffffff00',
    'button.background': '#3d59a1dd',
    'button.foreground': '#ffffff',
    'inputOption.activeBackground': '#3d59a144',
    'toolbar.hoverBackground': '#202330',
    'toolbar.activeBackground': '#202330',
    'panel.background': '#16161e',
    'panel.border': '#101014',
    'sideBar.background': '#16161e',
    'sideBarSectionHeader.background': '#16161e',
    'titleBar.activeBackground': '#16161e',
    'statusBar.background': '#16161e',
    'tab.inactiveBackground': '#16161e',
    'tab.activeBackground': '#16161e',
    'tree.indentGuidesStroke': '#2b2b3b',
    'list.activeSelectionBackground': '#202330',
    'scrollbarSlider.background': '#868bc415',
    'editor.background': '#1a1b26',
    'editor.foreground': '#a9b1d6',
    'editorCursor.foreground': '#c0caf5',
    'editor.selectionBackground': '#515c7e4d',
    'editor.inactiveSelectionBackground': '#515c7e25',
    'editor.lineHighlightBackground': '#1e202e',
    'editorLineNumber.activeForeground': '#787c99',
    'editorError.foreground': '#db4b4b',
    'editorWarning.foreground': '#e0af68',
    'gitDecoration.addedResourceForeground': '#449dab',
    'diffEditor.removedTextBackground': '#db4b4b22',
    'diffEditor.insertedTextBackground': '#41a6b520',
    'editor.stackFrameHighlightBackground': '#E2BD3A20',
    'textCodeBlock.background': '#16161e',
    'textLink.foreground': '#6183bb',
    'editorHoverWidget.background': '#16161e',
    'editorWidget.background': '#16161e',
    'menu.background': '#16161e',
    'menu.selectionBackground': '#1e202e',
    'progressBar.background': '#3d59a1',
  },
  syntax: {
    comment: '#51597d', // Comment
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
