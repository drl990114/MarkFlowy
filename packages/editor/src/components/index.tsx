import { ThemeProvider } from 'styled-components'

export * from './Editor'

type Props = {
  children?: React.ReactNode
  theme: Record<string, any>
}

export const EditorProvider = ({ theme, children }: Props) => {
  return (
    <ThemeProvider theme={theme}>
      {children}
    </ThemeProvider>
  )
}
