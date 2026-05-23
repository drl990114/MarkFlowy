import { codemirrorLight, codemirrorDark } from './codemirror'
import { common } from '@markflowy/theme'
import { styledDarkTheme } from './dark'
import { styledLightTheme } from './light'

export * from './WysiwygThemeWrapper'
export * from './SourceCodeThemeWrapper'

export const tableSelectorSize = 15

export { common }

export const darkTheme = {
  codemirrorTheme: codemirrorDark,
  styledConstants: { ...common, ...styledDarkTheme },
}

export const lightTheme = {
  codemirrorTheme: codemirrorLight,
  styledConstants: { ...common, ...styledLightTheme },
}
