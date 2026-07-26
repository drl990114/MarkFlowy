import styled, { css } from 'styled-components'
import { mobile } from '../../utils/media'
import rem from '../../utils/rem'
import { navbarHeight, sidebarWidth } from '../../utils/sizes'
import captureScroll from '../CaptureScroll'

export interface SidebarProps {
  $isFolded?: boolean
}

const Sidebar = styled.nav<SidebarProps>`
  position: fixed;
  transform: translateZ(0);
  display: block;
  z-index: 2;
  font-family: var(--body);

  left: 0;
  top: ${rem(navbarHeight)};
  bottom: 0;
  right: auto;
  width: ${sidebarWidth / 16}rem;
  background: var(--paper);
  border-right: 1px solid var(--line-soft);
  box-sizing: border-box;
  color: var(--ink);
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-color: var(--line) transparent;
  scrollbar-gutter: stable;
  scrollbar-width: thin;
  transition: transform 150ms ease-out;

  &::-webkit-scrollbar {
    width: ${rem(8)};
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--line);
    border: ${rem(2)} solid transparent;
    border-radius: 999px;
    background-clip: padding-box;
  }

  ${mobile(css<SidebarProps>`
    width: min(24rem, calc(100vw - 0.375rem));
    box-shadow: var(--shadow);

    ${(p) =>
      p.$isFolded
        ? css`
            transform: translateX(-100%);
          `
        : ``};
  `)};

  @media (prefers-reduced-motion: reduce) {
    transition-duration: 0ms;
  }
`

export default captureScroll(Sidebar)
