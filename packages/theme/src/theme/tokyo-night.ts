import { desktopDarkTheme } from '../theme-token'
import type { MfTheme } from './index'
import { tokyoNightPalette } from './tokyo-night-palette'

const { colors, syntax } = tokyoNightPalette

// Original VS Code Tokyo Night colors; provenance and license are in the palette.
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
    borderColorFocused: colors['textLink.foreground'],
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
}
