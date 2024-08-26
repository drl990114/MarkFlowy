import { ThemeProvider as RmeThemeProvider, WysiwygThemeWrapper } from 'rme'
import { ThemeProvider as ZensThemeProvider } from 'zens'
import { ThemeProvider as StyledThemeProvider } from 'styled-components'
import { darkTheme } from 'theme'
import dynamic from 'next/dynamic'

const ThemeProvider = ({ children, ...rest }: any) => (
  <StyledThemeProvider theme={darkTheme}>{children}</StyledThemeProvider>
)

export default ThemeProvider
