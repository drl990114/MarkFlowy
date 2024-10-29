import { ThemeProvider as RmeThemeProvider, WysiwygThemeWrapper } from 'rme'
import { ThemeProvider as ZensThemeProvider } from 'zens'
import { darkTheme } from 'theme'

const MdHtmlWrapper = ({ children, ...rest }: any) => (
  <RmeThemeProvider theme={{ mode: 'dark', token: darkTheme }}>
    <WysiwygThemeWrapper
      style={{
        whiteSpace: 'wrap',
      }}
      {...rest}
    >
      {children}
    </WysiwygThemeWrapper>
  </RmeThemeProvider>
)

export default MdHtmlWrapper
