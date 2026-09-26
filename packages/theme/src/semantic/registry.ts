/** Public tokens describe purpose, never a renderer or a particular color. */
export type TokenKind = 'color' | 'font' | 'length' | 'number'
export type TokenValue = string | { ref: string }
export interface TokenDefinition {
  kind: TokenKind
  light: TokenValue
  dark: TokenValue
  description: string
}
const color = (light: TokenValue, dark: TokenValue = light, description = ''): TokenDefinition => ({
  kind: 'color',
  light,
  dark,
  description,
})
const ref = (name: string) => ({ ref: name })
const metric = (kind: TokenKind, value: TokenValue): TokenDefinition => ({
  kind,
  light: value,
  dark: value,
  description: '',
})
export const themeTokens = {
  'surface.canvas': color('#ffffff', '#131313'),
  'surface.panel': color('#f7f7f7', '#1e1d1e'),
  'surface.overlay': color(ref('surface.panel')),
  'surface.subtle': color(ref('surface.panel')),
  'surface.backdrop': color('#00000066'),
  'text.primary': color('#202020', '#caccca'),
  'text.secondary': color('#606060', '#a1a1a1'),
  'text.disabled': color('#929292', '#6f6f6f'),
  'border.default': color('#d2d2d2', '#404040'),
  'border.subtle': color(ref('border.default')),
  'focus.ring': color(ref('accent.background')),
  'accent.background': color('#1f6ae2', '#3794ff'),
  'accent.foreground': color('#ffffff', '#101010'),
  'accent.subtle': color('#1f6ae23d', '#3794ff2e'),
  'interaction.hover': color('#ededed', '#353436'),
  'interaction.pressed': color('#d8d8d8', '#474646'),
  'interaction.selected': color(ref('accent.subtle')),
  'status.danger.foreground': color('#c62828', '#ff8585'),
  'status.danger.background': color('#c628281a', '#ff85851a'),
  'status.success.foreground': color('#237a52', '#62c993'),
  'status.success.background': color('#237a521a', '#62c9931a'),
  'status.warning.foreground': color('#966400', '#efb56e'),
  'status.warning.background': color('#9664001a', '#efb56e1a'),
  'chrome.titlebar.background': color(ref('surface.panel')),
  'chrome.statusbar.background': color(ref('surface.panel')),
  'chrome.sidebar.background': color(ref('surface.panel')),
  'chrome.tab.background': color(ref('surface.panel')),
  'chrome.tab.activeBackground': color(ref('surface.canvas')),
  'scrollbar.thumb': color('#c8c8c8', '#565656'),
  'scrollbar.track': color(ref('surface.canvas')),
  'editor.background': color(ref('surface.canvas')),
  'editor.foreground': color(ref('text.primary')),
  'editor.muted': color(ref('text.secondary')),
  'editor.caret': color(ref('editor.foreground')),
  'editor.selection.background': color(ref('accent.subtle')),
  'editor.selection.foreground': color(ref('editor.foreground')),
  'editor.selection.inactiveBackground': color('#8888884d'),
  'editor.link': color(ref('accent.background')),
  'editor.code.background': color(ref('surface.subtle')),
  'editor.code.foreground': color(ref('editor.foreground')),
  'editor.code.activeLine': color('#0000000d', '#ffffff0d'),
  'syntax.comment': color('#697386', '#8b95a7'),
  'syntax.keyword': color('#8250df', '#d2a8ff'),
  'syntax.string': color('#137a49', '#8bd5b1'),
  'syntax.number': color('#9a6700', '#f0bd72'),
  'syntax.function': color('#0550ae', '#82b8f7'),
  'syntax.variable': color('#953800', '#f2a37f'),
  'syntax.attribute': color('#9a6700', '#f0bd72'),
  'syntax.tag': color('#cf222e', '#ff8b98'),
  'syntax.punctuation': color('#57606a', '#aab4c3'),
  'syntax.meta': color('#9a6700', '#efb56e'),
  'font.ui.family': metric('font', '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'),
  'font.editor.family': metric('font', ref('font.ui.family')),
  'font.code.family': metric('font', '"SFMono-Regular", Consolas, monospace'),
  'font.editor.size': metric('length', '16px'),
  'font.editor.lineHeight': metric('number', '1.7'),
  'font.source.size': metric('length', '15px'),
  'font.source.lineHeight': metric('number', '1.6'),
  'editor.contentWidth': metric('length', '760px'),
  'radius.control': metric('length', '4px'),
  'radius.overlay': metric('length', '8px'),
} satisfies Record<string, TokenDefinition>
export type ThemeTokenName = keyof typeof themeTokens
export const themeTokenNames = Object.keys(themeTokens) as ThemeTokenName[]
export type ThemeOverrides = Partial<Record<ThemeTokenName, TokenValue>>
export type ResolvedTokens = Record<ThemeTokenName, string>
