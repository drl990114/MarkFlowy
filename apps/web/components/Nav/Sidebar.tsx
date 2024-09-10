import styled, { css } from 'styled-components';
import { paleGrey } from '../../utils/colors';
import { mobile } from '../../utils/media';
import rem from '../../utils/rem';
import { navbarHeight, sidebarWidth } from '../../utils/sizes';
import captureScroll from '../CaptureScroll';

export interface SidebarProps {
  $isFolded?: boolean;
}

const Sidebar = styled.nav<SidebarProps>`
  position: fixed;
  transform: translateZ(0);
  display: block;
  z-index: 1;
  font-family: ${props => props.theme.fontFamily};

  left: 0;
  top: ${rem(navbarHeight)};
  bottom: 0;
  right: auto;
  width: ${rem(sidebarWidth)};
  background: ${props => props.theme.sidebarBackground};
  box-sizing: border-box;
  color: inherit;
  overflow-y: auto;
  transition: transform 150ms ease-out;

  ${mobile(css<SidebarProps>`
    ${p =>
      p.$isFolded
        ? css`
            transform: translateX(${rem(-sidebarWidth)});
          `
        : ``};
  `)};
`;

export default captureScroll(Sidebar);
