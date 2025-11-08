import type { CSSProp } from 'styled-components';
import { darkTheme } from '../index';

type ThemeType = typeof darkTheme;

declare module 'styled-components' {
  export interface DefaultTheme extends ThemeType {}
}

declare module 'react' {
  interface DOMAttributes<T> {
    css?: CSSProp;
  }
}
