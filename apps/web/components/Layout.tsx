import styled, { css } from 'styled-components'
import { mobile } from '../utils/media'
import rem from '../utils/rem'
import { footerHeight, sidebarWidth } from '../utils/sizes'

export const Container = styled.div`
  padding-left: ${sidebarWidth / 16}rem;
  background-color: var(--paper);

  ${mobile(css`
    padding-left: 0;
  `)};
`

export const Content = styled.div<{
  $footer?: boolean
  $hasTableOfContents?: boolean
  $hero?: boolean
  $moveRight?: boolean
}>`
  box-sizing: border-box;
  font-family: var(--body);
  margin: 0;
  width: 100%;
  min-height: ${(props) => (props.$footer ? '0' : `calc(100vh - ${rem(footerHeight)})`)};
  max-width: ${(props) => (props.$hero ? '100ch' : '48.625rem')};
  padding: ${(props) => (props.$footer ? '0' : '4.25rem 1rem 0')};
  transition: transform 150ms ease-out;

  @layer base {
    p,
    li {
      max-width: 100ch;
    }
  }

  ${mobile(css`
    max-width: 100%;
    padding: 4.25rem 1rem 1.875rem;
    transform: none;
  `)};

  ${(p) =>
    p.$hasTableOfContents &&
    css`
      width: calc(100% - 15rem);
      max-width: 72rem;

      @media (max-width: 75.999rem) {
        width: 100%;
        max-width: none;
      }
    `};

  ${(p) =>
    p.$hero &&
    !p.$footer &&
    css`
      padding: ${rem(84)} ${rem(32)} 0;
    `};
`

export const Title = styled.h1`
  width: 100%;
  margin: 0 0 1.5rem;
  color: var(--ink);
  font-family: var(--sans);
  font-size: 1.5rem;
  font-weight: 500;
  letter-spacing: -0.025em;
  line-height: 2rem;
  text-align: left;
  text-wrap: balance;

  + h2 {
    margin-top: -0.5em;
  }
`

export const Header = styled.h2`
  font-size: ${rem(32)};
  font-weight: 600;
  font-family: var(--sans);
  color: var(--ink);
  margin: 2em 0 1em;

  + h3 {
    margin-top: -0.5em;
  }
`

export const SubHeader = styled.h3`
  margin: 2em 0 1em;
  font-size: ${rem(24)};
  font-weight: 600;
  font-family: var(--sans);
  color: var(--ink);

  + h4 {
    margin-top: -0.5em;
  }
`

export const TertiaryHeader = styled.h4`
  margin: 2em 0 1em;
  font-size: ${rem(18)};
  font-weight: 600;
  font-family: var(--sans);
  color: var(--ink);
`
