import { desktopDarkTheme } from '../theme-token'
import type { MfTheme } from './index'
import { tokyoNightPalette } from './tokyo-night-palette'

const { colors, syntax } = tokyoNightPalette

// MarkText "Tokyo Night Storm" colors; provenance and license are in the palette.
// MarkFlowy's shared surface/state roles are coarser than VS Code's workbench
// roles, so this maps their nearest equivalent without introducing new colors.
export const tokyoNightTheme: MfTheme = {
  name: 'Tokyo Night',
  mode: 'dark',
  // Legacy controls and the native startup palette still consume these roles.
  styledConstants: {
    ...desktopDarkTheme,
    // Host UI uses secondary text for file names and toolbar icons. Lift both
    // levels with upstream swatches while keeping document/syntax colors intact.
    primaryFontColor: colors['editor.foreground'],
    disabledFontColor: colors.disabledForeground,
    unselectedFontColor: colors.foreground,
    labelFontColor: colors.foreground,
    accentColor: colors['button.background'],
    accentColorFocused: colors['inputOption.activeBackground'],
    borderColor: colors['panel.border'],
    // Storm keeps the focus ring on the accent blue instead of the link cyan.
    borderColorFocused: colors['button.background'],
    bgColor: colors['editor.background'],
    bgColorSecondary: colors['textCodeBlock.background'],
    hoverColor: colors['toolbar.hoverBackground'],
    warnColor: colors['editorWarning.foreground'],
    dangerColor: colors['editorError.foreground'],
    successColor: colors['gitDecoration.addedResourceForeground'],
    tipsBgColor: colors['editorHoverWidget.background'],
    boxShadowColor: colors['widget.shadow'],
    titleBarBgColor: colors['titleBar.activeBackground'],
    titleBarDefaultHoverColor: colors['toolbar.hoverBackground'],
    editorTabBgColor: colors['tab.inactiveBackground'],
    editorTabActiveBgColor: colors['tab.activeBackground'],
    editorToolbarBgColor: colors['editor.background'],
    fileTreeIndentLineColor: colors['tree.indentGuidesStroke'],
    fileTreeSelectedBgColor: colors['list.activeSelectionBackground'],
    sideBarHeaderBgColor: colors['sideBarSectionHeader.background'],
    sideBarBgColor: colors['sideBar.background'],
    statusBarBgColor: colors['statusBar.background'],
    rightBarBgColor: colors['sideBar.background'],
    rightBarHeaderBgColor: colors['sideBarSectionHeader.background'],
    tocbarProgressBgColor: colors['panel.background'],
    tocbarProgressActiveBgColor: colors['progressBar.background'],
    buttonBgColor: colors['panel.background'],
    tooltipBgColor: colors['editorHoverWidget.background'],
    dialogBgColor: colors['editorWidget.background'],
    // VS Code has no modal backdrop equivalent; retain the host's dark backdrop.
    dialogBackdropColor: desktopDarkTheme.dialogBackdropColor,
    contextMenuBgColor: colors['menu.background'],
    contextMenuBgColorHover: colors['menu.selectionBackground'],
    scrollbarThumbColor: colors['scrollbarSlider.background'],
    scrollbarTrackColor: colors['editor.background'],
  },
  tokens: {
    'border.subtle': colors['tree.indentGuidesStroke'],
    'interaction.pressed': colors['toolbar.activeBackground'],
    // Storm keeps the focus ring on the accent blue; the legacy mapping above
    // would otherwise resolve it to the link cyan.
    'focus.ring': { ref: 'accent.background' },
    // The Storm accent is light, so the contrast-derived foreground would be
    // near-black; the port pins it to the editor canvas color instead.
    'accent.foreground': colors['button.foreground'],
    // Use upstream diff/debugger washes for states without a shared counterpart.
    'status.danger.background': colors['diffEditor.removedTextBackground'],
    'status.success.background': colors['diffEditor.insertedTextBackground'],
    'status.warning.background': colors['editor.stackFrameHighlightBackground'],
    // Workbench text and document text have different foregrounds upstream.
    'editor.foreground': colors['editor.foreground'],
    'editor.muted': colors['editorLineNumber.activeForeground'],
    'editor.caret': colors['editorCursor.foreground'],
    'editor.link': colors['textLink.foreground'],
    'editor.code.background': colors['textCodeBlock.background'],
    'editor.selection.background': colors['editor.selectionBackground'],
    'editor.selection.foreground': { ref: 'editor.foreground' },
    'editor.selection.inactiveBackground': colors['editor.inactiveSelectionBackground'],
    'editor.code.activeLine': colors['editor.lineHighlightBackground'],
    // The port marks text with a bright chartreuse; MarkFlowy requires an
    // opaque highlight background, so the ported alpha is dropped.
    'editor.highlight.background': '#e1fb05',
    'editor.highlight.foreground': colors['button.foreground'],
    'syntax.comment': syntax.comment,
    'syntax.keyword': syntax.keyword,
    'syntax.string': syntax.string,
    'syntax.number': syntax.number,
    'syntax.function': syntax.function,
    'syntax.variable': syntax.variable,
    'syntax.attribute': syntax.attribute,
    'syntax.tag': syntax.tag,
    'syntax.punctuation': syntax.punctuation,
    'syntax.meta': syntax.meta,
  },
  // Editor-content styling ported from the MarkText Tokyo Night Storm theme.
  // Rules target the shared editor scope (editing, reading and previews) and
  // cover both engines: RME reads its two official color variables, while the
  // `.markdown-body` double-class variants outrank the runtime-injected RME
  // styles for colors RME hard-codes (hr, list markers). The
  // `[data-cap-content]` variants only add specificity for the private
  // Capricorn engine and match nothing until that runtime is installed.
  globalStyleText: `.mf-editor-content {
  --rme-editor-link-color: ${colors['textLink.foreground']};
  --rme-editor-blockquote-color: rgba(192, 202, 245, 0.6);
}
.mf-editor-content h1, .mf-editor-content [data-cap-content] h1 {
  color: ${syntax.keyword};
  border-bottom: 1px solid ${colors['tree.indentGuidesStroke']};
  padding-bottom: 0.3em;
}
.mf-editor-content h2, .mf-editor-content [data-cap-content] h2 {
  color: ${syntax.function};
  border-bottom: 1px solid ${colors['tree.indentGuidesStroke']};
  padding-bottom: 0.3em;
}
.mf-editor-content h3, .mf-editor-content [data-cap-content] h3 { color: ${colors['textLink.foreground']}; }
.mf-editor-content h4, .mf-editor-content [data-cap-content] h4 { color: ${syntax.string}; }
.mf-editor-content h5, .mf-editor-content [data-cap-content] h5 { color: ${colors['editorWarning.foreground']}; }
.mf-editor-content h6, .mf-editor-content [data-cap-content] h6 { color: ${syntax.tag}; }

/* Inline emphasis */
.mf-editor-content em, .mf-editor-content [data-cap-content] em { color: ${syntax.keyword}; }
.mf-editor-content del, .mf-editor-content [data-cap-content] del { color: ${syntax.tag}; }

/* Links */
.mf-editor-content a, .mf-editor-content [data-cap-content] a {
  color: ${colors['textLink.foreground']};
  text-decoration: none;
}

/* Blockquote text; the bar keeps the border.default token. */
.mf-editor-content blockquote, .mf-editor-content [data-cap-content] blockquote,
.mf-editor-content .capricorn-markdown-quoted-block {
  color: rgba(192, 202, 245, 0.6);
}

/* Horizontal rule */
.mf-editor-content.markdown-body hr, .mf-editor-content [data-cap-content] hr {
  height: 0;
  background: transparent;
  border: 0;
  border-top: 2px dashed rgba(192, 202, 245, 0.3);
}

/* Lists */
.mf-editor-content.markdown-body li::marker,
.mf-editor-content [data-cap-content] li::marker {
  color: ${syntax.function};
}

/* Tables */
.mf-editor-content th, .mf-editor-content [data-cap-content] th {
  background-color: ${colors['textCodeBlock.background']};
}
.mf-editor-content .capricorn-markdown-table-row[data-markdown-table-header='true'] {
  background-color: ${colors['textCodeBlock.background']};
}

/* Code block */
.mf-editor-content pre, .mf-editor-content [data-cap-content] pre {
  background-color: ${colors['textCodeBlock.background']};
  border-radius: 6px;
}`,
}
