import { ThemeProvider as RmeThemeProvider, WysiwygThemeWrapper } from 'rme'
import { darkTheme } from 'theme'

const MdHtmlWrapper = ({ children, ...rest }: any) => (
  <RmeThemeProvider theme={{ mode: 'dark', token: { ...darkTheme, bgColor: '#181a1c' } }}>
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
