import styled, { css } from 'styled-components'
import { mobile } from '../utils/media'
import rem from '../utils/rem'
import { footerHeight, sidebarWidth } from '../utils/sizes'

export const Container = styled.div`
  padding-left: ${rem(sidebarWidth)};
  background-color: #181a1c;

  ${mobile(css`
    padding-left: 0;
  `)};
`

export const Content = styled.div<{ $hero?: boolean; $moveRight?: boolean; $footer?: boolean }>`
  box-sizing: border-box;
  font-family: ${(props) => props.theme.fontFamily};
  margin: 0 auto;
  min-height: ${(props) =>
    props.$footer ? '0' : `calc(100vh - ${rem(footerHeight)})`};
  max-width: ${(props) => (props.$hero ? '100ch' : '120ch')};
  padding: ${(props) => (props.$footer ? '0' : `${rem(90)} ${rem(60)} 0 ${rem(60)}`)};
  transition: transform 150ms ease-out;
  background-color: #181a1c;

  @layer base {
    p,
    li {
      max-width: 100ch;
    }
  }

  ${(p) =>
    mobile(css`
      padding: ${rem(100)} ${rem(36)} ${rem(30)} ${rem(36)};
      transform: translateX(${p.$moveRight ? rem(sidebarWidth) : 0});
    `)};

  ${(p) =>
    p.$hero &&
    !p.$footer &&
    css`
      padding: ${rem(170)} ${rem(60)} 0 ${rem(60)};
    `};
`

export const Title = styled.h1`
  text-align: left;
  width: 100%;
  color: ${(props) => props.theme.primaryFontColor};
  font-size: ${rem(42)};
  font-weight: bold;
  font-family: ${(props) => props.theme.fontFamily};

  + h2 {
    margin-top: -0.5em;
  }
`

export const Header = styled.h2`
  font-size: ${rem(32)};
  font-weight: 600;
  font-family: ${(props) => props.theme.fontFamily};
  margin: 2em 0 1em;

  + h3 {
    margin-top: -0.5em;
  }
`

export const SubHeader = styled.h3`
  margin: 2em 0 1em;
  font-size: ${rem(24)};
  font-weight: 600;
  font-family: ${(props) => props.theme.fontFamily};

  + h4 {
    margin-top: -0.5em;
  }
`

export const TertiaryHeader = styled.h4`
  margin: 2em 0 1em;
  font-size: ${rem(18)};
  font-weight: 600;
  font-family: ${(props) => props.theme.fontFamily};
`
