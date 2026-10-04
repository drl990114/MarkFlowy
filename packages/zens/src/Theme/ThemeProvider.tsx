import { createContext, useMemo, type ReactNode } from 'react'

import isPropValid from '@emotion/is-prop-valid'
import {
  ThemeProvider as ScThemeProvider,
  StyleSheetManager,
  type DefaultTheme,
  type IStyleSheetContext,
} from 'styled-components'

import { darkTheme, lightTheme } from '.'
import {
  ComponentsThemeProvider,
  legacyThemeVariables,
  type LegacyComponentTheme,
} from './components-theme'

export type ThemeProviderProps = {
  theme?: {
    mode: 'light' | 'dark'
    /**
     * Some theme variables can be modified through the token attribute in theme.
     */
    token?: LegacyComponentTheme
  }
  children?: ReactNode
}

export const ThemeContext = createContext<LegacyComponentTheme>({})

// This implements the default behavior from styled-components v5
const shouldForwardProp: IStyleSheetContext['shouldForwardProp'] = (propName, target) => {
  if (typeof target === 'string') {
    return isPropValid(propName)
  }
  // For other elements, forward all props
  return true
}

export const ThemeProvider = ({ theme, children }: ThemeProviderProps) => {
  const mode = theme?.mode || 'light'
  const defaultThemeToken = mode === 'dark' ? darkTheme.styledConstants : lightTheme.styledConstants
  const themeToken = useMemo(
    () => ({ ...defaultThemeToken, ...theme?.token }),
    [defaultThemeToken, theme?.token],
  )
  const variables = useMemo(() => legacyThemeVariables(themeToken), [themeToken])
  // Hosts augment DefaultTheme with their own fields. Preserve those fields while
  // standalone consumers receive the complete legacy component defaults above.
  const inheritTheme = useMemo(
    () =>
      (outerTheme?: DefaultTheme): DefaultTheme =>
        ({ ...outerTheme, ...themeToken }) as DefaultTheme,
    [themeToken],
  )

  return (
    <StyleSheetManager shouldForwardProp={shouldForwardProp}>
      <ScThemeProvider theme={inheritTheme}>
        <ThemeContext.Provider value={themeToken}>
          <ComponentsThemeProvider variables={variables} mode={mode}>
            {children}
          </ComponentsThemeProvider>
        </ThemeContext.Provider>
      </ScThemeProvider>
    </StyleSheetManager>
  )
}
