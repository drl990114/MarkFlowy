type CSSUtilType = ReturnType<typeof css>;

import { css } from 'styled-components';

export const mobile = (inner: CSSUtilType): CSSUtilType => css`
  @media (max-width: ${1000 / 16}em) {
    ${inner};
  }
`;

export const phone = (inner: CSSUtilType): CSSUtilType => css`
  @media (max-width: ${650 / 16}em) {
    ${inner};
  }
`;
