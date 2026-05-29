import type { CSSProp } from 'styled-components';
import { lightTheme } from '../Theme';

type ThemeType = typeof lightTheme.styledConstants;

declare module 'styled-components' {
  export interface DefaultTheme extends ThemeType {}
}

declare module 'react' {
  interface DOMAttributes<T> {
    css?: CSSProp;
  }
}
