import type { editorSpecificTokens } from '@markflowy/theme'
import type { ResolvedTokens, ThemeTokenName } from '@markflowy/theme/semantic'

/** RME's private styled names stay at this boundary, including its mode defaults. */
const editorMap = {
  nodeSelectedColor: 'editor.selection.background',
  strongFontColor: 'editor.foreground',
  markBgColor: 'accent.subtle',
  markFontColor: 'editor.foreground',
  imgBgColor: 'editor.background',
  hrBgColor: 'border.default',
  hrBorderColor: 'border.default',
  placeholderFontColor: 'editor.muted',
  kbdBgColor: 'editor.code.background',
  kbdBorderColor: 'border.default',
  kbdFontColor: 'editor.code.foreground',
  blockquoteBorderColor: 'border.default',
  blockquoteFontColor: 'editor.muted',
  tableTdBorderColor: 'border.default',
  tableTrBgColor: 'editor.background',
  tableTrDeepBgColor: 'surface.subtle',
  tableHeaderBgColor: 'surface.subtle',
  tableTrBorderColor: 'border.default',
  tableSelectorBgColor: 'surface.overlay',
  tableSelectorBgHoverColor: 'interaction.hover',
  tableSelectorBorderColor: 'border.default',
  tableSelectorHightColor: 'accent.subtle',
  tableSelectorHightHoverColor: 'interaction.selected',
  tableSelectorHightBorderColor: 'focus.ring',
  tableSelectorCellBgColor: 'editor.selection.background',
  tableSelectorCellBorderColor: 'focus.ring',
  codeBgColor: 'editor.code.background',
  preBgColor: 'editor.code.background',
  contextMenuBgColor: 'surface.overlay',
  contextMenuBgColorActive: 'interaction.selected',
  contextMenuBgColorHover: 'interaction.hover',
  slashMenuBorderColor: 'border.default',
  selectionMatchBgColor: 'accent.subtle',
} as const satisfies Record<keyof typeof editorSpecificTokens, ThemeTokenName>

export function rmeEditorTokens(tokens: ResolvedTokens) {
  const editor = Object.fromEntries(
    Object.entries(editorMap).map(([key, name]) => [key, tokens[name]]),
  ) as Record<keyof typeof editorMap, string>
  return {
    ...editor,
    bgColor: tokens['editor.background'],
    primaryFontColor: tokens['editor.foreground'],
    labelFontColor: tokens['editor.muted'],
    fontFamily: tokens['font.editor.family'],
    codemirrorFontFamily: tokens['font.code.family'],
  }
}
