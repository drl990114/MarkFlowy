import { desktopDarkTheme, desktopLightTheme, type MfTheme } from '@markflowy/theme'
import {
  resolveTheme,
  resolveThemeTokens,
  themeVariables,
  themeVariableName,
  type ThemeDocument,
  type ThemeVariant,
  type ThemeOverrides,
  type ResolvedTheme,
  type ResolvedTokens,
  type ThemeTokenName,
} from '@markflowy/theme/semantic'

/** Kept only at the legacy consumer boundary. New themes never expose these names. */
const legacyMap = {
  bgColor: 'surface.canvas',
  bgColorSecondary: 'surface.subtle',
  sideBarBgColor: 'chrome.sidebar.background',
  rightBarBgColor: 'chrome.sidebar.background',
  sideBarHeaderBgColor: 'surface.panel',
  rightBarHeaderBgColor: 'surface.panel',
  titleBarBgColor: 'chrome.titlebar.background',
  statusBarBgColor: 'chrome.statusbar.background',
  primaryFontColor: 'text.primary',
  unselectedFontColor: 'text.secondary',
  labelFontColor: 'text.secondary',
  disabledFontColor: 'text.disabled',
  accentColor: 'accent.background',
  accentColorFocused: 'accent.subtle',
  borderColor: 'border.default',
  borderColorFocused: 'focus.ring',
  hoverColor: 'interaction.hover',
  contextMenuBgColorHover: 'interaction.hover',
  titleBarDefaultHoverColor: 'interaction.hover',
  fileTreeSelectedBgColor: 'interaction.selected',
  buttonBgColor: 'surface.subtle',
  contextMenuBgColor: 'surface.overlay',
  dialogBgColor: 'surface.overlay',
  tooltipBgColor: 'surface.overlay',
  dialogBackdropColor: 'surface.backdrop',
  tipsBgColor: 'surface.subtle',
  dangerColor: 'status.danger.foreground',
  warnColor: 'status.warning.foreground',
  successColor: 'status.success.foreground',
  editorTabBgColor: 'chrome.tab.background',
  editorTabActiveBgColor: 'chrome.tab.activeBackground',
  editorToolbarBgColor: 'surface.canvas',
  fileTreeIndentLineColor: 'border.subtle',
  scrollbarThumbColor: 'scrollbar.thumb',
  scrollbarTrackColor: 'scrollbar.track',
  fontFamily: 'font.ui.family',
  codemirrorFontFamily: 'font.code.family',
  smallBorderRadius: 'radius.control',
  midBorderRadius: 'radius.overlay',
} as const satisfies Record<string, ThemeTokenName>
export interface SemanticTheme extends MfTheme {
  document: ThemeDocument
  variant: ThemeVariant
  resolved: ResolvedTheme
}
export function isSemanticTheme(theme: MfTheme): theme is SemanticTheme {
  return 'resolved' in theme && 'document' in theme
}
export function legacyTokens(tokens: ResolvedTokens, mode: ThemeVariant['mode']) {
  return {
    ...(mode === 'dark' ? desktopDarkTheme : desktopLightTheme),
    ...Object.fromEntries(Object.entries(legacyMap).map(([old, name]) => [old, tokens[name]])),
  }
}
export function toAppTheme(document: ThemeDocument, variant: ThemeVariant): SemanticTheme {
  const resolved = resolveTheme(document, variant)
  return {
    name: resolved.id,
    mode: resolved.mode,
    styledConstants: legacyTokens(resolved.tokens, resolved.mode),
    globalStyleText: resolved.css,
    document,
    variant,
    resolved,
  }
}
function legacyOverrides(theme: MfTheme): ThemeOverrides {
  const overrides: ThemeOverrides = {}
  for (const [old, name] of Object.entries(legacyMap)) {
    const value = theme.styledConstants[old as keyof typeof theme.styledConstants]
    if (value && overrides[name] === undefined) overrides[name] = value
  }
  return overrides
}
export function getThemeTokens(theme: MfTheme, preferences: ThemeOverrides = {}): ResolvedTokens {
  if (isSemanticTheme(theme)) return resolveTheme(theme.document, theme.variant, preferences).tokens
  const overrides = legacyOverrides(theme)
  const accent = preferences['accent.background']
  if (
    typeof accent === 'string' &&
    accent.toLowerCase() !== String(overrides['accent.background']).toLowerCase()
  ) {
    delete overrides['accent.subtle']
  }
  return resolveThemeTokens(theme.mode, { ...overrides, ...preferences })
}
export const themeLabel = (theme: MfTheme) => {
  if (!isSemanticTheme(theme)) return theme.name
  return theme.document.name === theme.variant.name
    ? theme.document.name
    : `${theme.document.name} · ${theme.variant.name}`
}
export function copyTheme(theme: MfTheme): ThemeDocument {
  if (isSemanticTheme(theme))
    return {
      ...structuredClone(theme.document),
      id: `personal-${crypto.randomUUID()}`,
      name: `${theme.document.name} copy`,
    }
  return {
    version: 1,
    id: `personal-${crypto.randomUUID()}`,
    name: `${theme.name} copy`,
    variants: [
      {
        id: theme.mode,
        name: `${theme.name} copy`,
        mode: theme.mode,
        tokens: legacyOverrides(theme),
      },
    ],
  }
}
const capMap = {
  '--cap-surface': 'editor.background',
  '--cap-surface-subtle': 'surface.subtle',
  '--cap-surface-raised': 'surface.overlay',
  '--cap-text': 'editor.foreground',
  '--cap-text-muted': 'editor.muted',
  '--cap-border': 'border.default',
  '--cap-border-subtle': 'border.subtle',
  '--cap-border-strong': 'border.default',
  '--cap-accent': 'accent.background',
  '--cap-accent-hover': 'accent.background',
  '--cap-accent-soft': 'accent.subtle',
  '--cap-focus': 'focus.ring',
  '--cap-selection': 'editor.selection.background',
  '--cap-selection-foreground': 'editor.selection.foreground',
  '--cap-inactive-selection': 'editor.selection.inactiveBackground',
  '--cap-caret': 'editor.caret',
  '--cap-link': 'editor.link',
  '--cap-control-hover': 'interaction.hover',
  '--cap-control-ghost-hover': 'interaction.hover',
  '--cap-control-pressed': 'interaction.pressed',
  '--cap-danger': 'status.danger.foreground',
  '--cap-danger-soft': 'status.danger.background',
  '--cap-success': 'status.success.foreground',
  '--cap-code-token-inserted': 'status.success.foreground',
  '--cap-code-token-deleted': 'status.danger.foreground',
  '--cap-font-ui': 'font.ui.family',
  '--cap-font-mono': 'font.code.family',
  '--cap-code-font-family': 'font.code.family',
  '--cap-editor-font-size': 'font.editor.size',
  '--cap-editor-line-height': 'font.editor.lineHeight',
  '--cap-editor-content-width': 'editor.contentWidth',
  '--cap-radius-sm': 'radius.control',
  '--cap-radius-md': 'radius.control',
  '--cap-radius-lg': 'radius.overlay',
  '--cap-code-background': 'editor.code.background',
  '--cap-code-toolbar-background': 'editor.code.background',
  '--cap-code-color': 'editor.code.foreground',
  '--cap-code-caret': 'editor.caret',
  '--cap-code-selection': 'editor.selection.background',
  '--cap-accent-foreground': 'accent.foreground',
  '--cap-code-active-line': 'editor.code.activeLine',
  '--cap-code-token-comment': 'syntax.comment',
  '--cap-code-token-keyword': 'syntax.keyword',
  '--cap-code-token-string': 'syntax.string',
  '--cap-code-token-number': 'syntax.number',
  '--cap-code-token-title': 'syntax.function',
  '--cap-code-token-variable': 'syntax.variable',
  '--cap-code-token-attribute': 'syntax.attribute',
  '--cap-code-token-tag': 'syntax.tag',
  '--cap-code-token-punctuation': 'syntax.punctuation',
  '--cap-code-token-meta': 'syntax.meta',
} as const satisfies Record<string, ThemeTokenName>
export function capricornStyle(
  tokens: ResolvedTokens,
  scope: 'instance' | 'document' = 'instance',
): Record<string, string> & { fontFamily: string } {
  const value = (name: ThemeTokenName) =>
    scope === 'document' ? `var(${themeVariableName(name)}, ${tokens[name]})` : tokens[name]
  return {
    ...Object.fromEntries(Object.entries(capMap).map(([key, name]) => [key, value(name)])),
    fontFamily: value('font.editor.family'),
  }
}
/** Facade aliases are implementation details, not additional public theme tokens. */
const desktopAliases = {
  '--mf-surface-app': 'surface.canvas',
  '--mf-surface-panel': 'surface.panel',
  '--mf-surface-panel-left': 'chrome.sidebar.background',
  '--mf-surface-panel-right': 'chrome.sidebar.background',
  '--mf-surface-titlebar': 'chrome.titlebar.background',
  '--mf-surface-statusbar': 'chrome.statusbar.background',
  '--mf-surface-elevated': 'surface.overlay',
  '--mf-surface-overlay': 'surface.overlay',
  '--mf-surface-tooltip': 'surface.overlay',
  '--mf-surface-muted': 'surface.subtle',
  '--mf-background': 'surface.canvas',
  '--mf-foreground': 'text.primary',
  '--mf-foreground-secondary': 'text.secondary',
  '--mf-text-primary': 'text.primary',
  '--mf-text-secondary': 'text.secondary',
  '--mf-text-muted': 'text.secondary',
  '--mf-text-disabled': 'text.disabled',
  '--mf-muted': 'surface.subtle',
  '--mf-muted-foreground': 'text.secondary',
  '--mf-disabled-foreground': 'text.disabled',
  '--mf-border': 'border.default',
  '--mf-control-border': 'border.default',
  '--mf-input': 'border.default',
  '--mf-ui-border-subtle': 'border.subtle',
  '--mf-ui-border-muted': 'border.subtle',
  '--mf-ring': 'focus.ring',
  '--mf-control-focus': 'focus.ring',
  '--mf-control-surface': 'surface.subtle',
  '--mf-control-hover': 'interaction.hover',
  '--mf-control-ghost-hover': 'interaction.hover',
  '--mf-control-titlebar-hover': 'interaction.hover',
  '--mf-control-pressed': 'interaction.pressed',
  '--mf-control-ghost-pressed': 'interaction.pressed',
  '--mf-control-selected': 'interaction.selected',
  '--mf-primary': 'accent.background',
  '--mf-primary-foreground': 'accent.foreground',
  '--mf-primary-soft': 'accent.subtle',
  '--mf-accent': 'interaction.hover',
  '--mf-accent-foreground': 'text.primary',
  '--mf-secondary': 'surface.subtle',
  '--mf-secondary-foreground': 'text.primary',
  '--mf-popover': 'surface.overlay',
  '--mf-popover-foreground': 'text.primary',
  '--mf-card': 'surface.canvas',
  '--mf-card-foreground': 'text.primary',
  '--mf-dialog': 'surface.overlay',
  '--mf-dialog-overlay': 'surface.backdrop',
  '--mf-tooltip': 'surface.overlay',
  '--mf-destructive': 'status.danger.foreground',
  '--mf-destructive-muted': 'status.danger.background',
  '--mf-success': 'status.success.foreground',
  '--mf-warning': 'status.warning.foreground',
  '--mf-selection': 'editor.selection.background',
  '--mf-selection-foreground': 'editor.selection.foreground',
  '--mf-scrollbar-thumb': 'scrollbar.thumb',
  '--mf-scrollbar-track': 'scrollbar.track',
  '--mf-font-sans': 'font.ui.family',
  '--mf-font-mono': 'font.code.family',
  '--mf-ui-font-family': 'font.ui.family',
  '--mf-ui-font-mono': 'font.code.family',
  '--mf-radius-sm': 'radius.control',
  '--mf-radius': 'radius.overlay',
  '--mf-radius-lg': 'radius.overlay',
} as const satisfies Record<string, ThemeTokenName>
export function desktopVariables(tokens: ResolvedTokens): Record<string, string> {
  return {
    ...themeVariables(tokens),
    ...Object.fromEntries(
      Object.entries(desktopAliases).map(([key, name]) => [key, `var(${themeVariableName(name)})`]),
    ),
  }
}
