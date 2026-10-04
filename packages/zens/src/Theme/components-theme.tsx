import { createContext, useContext, useMemo, type CSSProperties, type ReactNode } from 'react'

export type ComponentThemeVariables = Record<`--mf-${string}`, string | number | undefined>
export type ComponentThemeMode = 'light' | 'dark'

interface ComponentTheme {
  variables?: ComponentThemeVariables
  mode?: ComponentThemeMode
}

const ComponentsThemeContext = createContext<ComponentTheme>({})

export interface ComponentsThemeProviderProps extends ComponentTheme {
  children?: ReactNode
}

/** Carry theme overrides across portals without introducing a layout wrapper. */
export function ComponentsThemeProvider({
  variables,
  mode,
  children,
}: ComponentsThemeProviderProps) {
  const inherited = useContext(ComponentsThemeContext)
  const value = useMemo(
    () => ({
      variables: variables ? { ...inherited.variables, ...variables } : inherited.variables,
      mode: mode ?? inherited.mode,
    }),
    [inherited, variables, mode],
  )
  return <ComponentsThemeContext.Provider value={value}>{children}</ComponentsThemeContext.Provider>
}

export function useComponentThemeStyle(style?: CSSProperties): CSSProperties | undefined {
  const { variables, mode } = useContext(ComponentsThemeContext)
  return useMemo(
    () =>
      variables || mode
        ? { ...variables, ...(mode ? { colorScheme: mode } : {}), ...style }
        : style,
    [variables, mode, style],
  )
}

export function useComponentThemeMode(): ComponentThemeMode | undefined {
  return useContext(ComponentsThemeContext).mode
}

export type LegacyComponentTheme = Record<string, string | number | undefined>

/** Compatibility mapping belongs to the theme layer, never the primitives. */
export function legacyThemeVariables(token: LegacyComponentTheme): ComponentThemeVariables {
  const variables: ComponentThemeVariables = {
    '--mf-surface-app': token.bgColor,
    '--mf-surface-panel': token.tipsBgColor,
    '--mf-surface-elevated': token.dialogBgColor ?? token.bgColor,
    '--mf-surface-overlay': token.contextMenuBgColor ?? token.bgColor,
    '--mf-surface-tooltip': token.tooltipBgColor ?? token.bgColor,
    '--mf-surface-muted': token.tipsBgColor,
    '--mf-text-primary': token.primaryFontColor,
    '--mf-text-secondary': token.secondaryFontColor,
    '--mf-text-muted': token.secondaryFontColor,
    '--mf-text-disabled': token.disabledFontColor ?? token.labelFontColor,
    '--mf-control-surface': token.buttonBgColor ?? token.tipsBgColor,
    '--mf-control-hover': token.contextMenuBgColorHover ?? token.hoverColor,
    '--mf-control-ghost-hover': token.hoverColor,
    '--mf-control-pressed': token.contextMenuBgColorActive ?? token.hoverColor,
    '--mf-control-ghost-pressed': token.contextMenuBgColorActive ?? token.hoverColor,
    '--mf-control-selected': token.contextMenuBgColorActive ?? token.hoverColor,
    '--mf-control-border': token.borderColor,
    '--mf-control-focus': token.accentColor,
    '--mf-background': token.bgColor,
    '--mf-foreground': token.primaryFontColor,
    '--mf-foreground-secondary': token.secondaryFontColor,
    '--mf-card': token.bgColor,
    '--mf-card-foreground': token.primaryFontColor,
    '--mf-dialog': token.dialogBgColor ?? token.bgColor,
    '--mf-dialog-overlay': token.dialogBackdropColor,
    '--mf-popover': token.contextMenuBgColor ?? token.bgColor,
    '--mf-popover-foreground': token.primaryFontColor,
    '--mf-tooltip': token.tooltipBgColor ?? token.bgColor,
    '--mf-primary': token.accentColor,
    '--mf-primary-foreground': token.webOnAccent ?? token.white,
    '--mf-primary-soft': token.accentColorFocused ?? token.hoverColor,
    '--mf-secondary': token.buttonBgColor ?? token.tipsBgColor,
    '--mf-secondary-foreground': token.primaryFontColor,
    '--mf-muted': token.tipsBgColor,
    '--mf-muted-foreground': token.secondaryFontColor,
    '--mf-disabled-foreground': token.disabledFontColor ?? token.labelFontColor,
    '--mf-accent': token.hoverColor,
    '--mf-accent-foreground': token.primaryFontColor,
    '--mf-destructive': token.dangerColor,
    '--mf-destructive-foreground': token.webOnAccent ?? token.white,
    '--mf-success': token.successColor,
    '--mf-warning': token.warnColor,
    '--mf-border': token.borderColor,
    '--mf-input': token.borderColor,
    '--mf-ring': token.accentColor,
    '--mf-shadow-color': token.boxShadowColor,
    '--mf-scrollbar-thumb': token.scrollbarThumbColor,
    '--mf-scrollbar-track': token.scrollbarTrackColor,
    '--mf-radius-sm': token.smallBorderRadius,
    '--mf-radius': token.midBorderRadius,
    '--mf-radius-lg': token.bigBorderRadius,
    '--mf-font-xs': token.fontXs,
    '--mf-font-sm': token.fontSm,
    '--mf-font-base': token.fontBase,
    '--mf-ui-font-caption': token.fontXs,
    '--mf-ui-font-control': token.fontSm,
    '--mf-ui-font-body': token.fontBase,
    '--mf-font-sans': token.fontFamily,
    '--mf-ui-font-family': token.fontFamily,
    '--mf-font-mono': token.codemirrorFontFamily,
    '--mf-ui-font-mono': token.codemirrorFontFamily,
    '--mf-line-height': token.lineHeightBase,
  }
  return Object.fromEntries(Object.entries(variables).filter(([, value]) => value !== undefined))
}
