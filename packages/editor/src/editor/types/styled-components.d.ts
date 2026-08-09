import type { CSSProp } from 'styled-components'
import type { lightTheme } from '../theme'

type ThemeType = Omit<typeof lightTheme.styledConstants, 'tableHeaderBgColor'>

declare module 'styled-components' {
  export interface DefaultTheme extends ThemeType {
    tableHeaderBgColor?: string
  }
}

declare module 'react' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface DOMAttributes<T> {
    css?: CSSProp
  }
}
