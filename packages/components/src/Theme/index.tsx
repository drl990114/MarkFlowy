import { createContext } from 'react'
import { ThemeProvider } from 'styled-components'

type Props = {
  children?: React.ReactNode
  theme: Record<string, any>
}

export const ThemeContext = createContext<Record<string, string>>({})

const UiThemeProvider = ({ theme, children }: Props) => {
  return (
    <ThemeProvider theme={theme}>
      <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
    </ThemeProvider>
  )
}

export default UiThemeProvider
