import { CSSProp, StyledObject } from 'styled-components';

interface EventListenerOptions {
  passive?: boolean;
}

declare module 'react' {
  interface DOMAttributes<T> {
    css?: string | StyledObject;
  }
}
