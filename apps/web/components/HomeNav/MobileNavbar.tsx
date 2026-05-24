import { useTranslation } from 'next-i18next'
import styled, { css } from 'styled-components'
import { mobile } from '../../utils/media'
import rem from '../../utils/rem'
import { navbarHeight } from '../../utils/sizes'
import { Logo } from '../Nav/Logo'
import NavLinks from '../Nav/NavLinks'
import { Brand } from './Navbar'
import Link from '../Link'

export interface MobileNavbarProps {
  isMobileNavFolded?: boolean
  isSideFolded?: boolean
  onMobileNavToggle?: () => void
  onSideToggle?: () => void
  showSideNav?: boolean
}

export default function MobileNavbar({
  isMobileNavFolded,
  onMobileNavToggle,
}: React.PropsWithChildren<MobileNavbarProps>) {
  const { t } = useTranslation()

  return (
    <Wrapper>
      <LogoLink href='/' unstyled>
        <Logo size={20} />
        <BrandName>MarkFlowy</BrandName>
      </LogoLink>

      <MenuToggle onClick={onMobileNavToggle} $isOpen={!isMobileNavFolded}>
        <Bar $isOpen={!isMobileNavFolded} />
        <Bar $isOpen={!isMobileNavFolded} />
        <Bar $isOpen={!isMobileNavFolded} />
      </MenuToggle>

      <DropdownMenu $isOpen={!isMobileNavFolded}>
        <DropdownLinks />
      </DropdownMenu>
    </Wrapper>
  )
}

const Wrapper = styled.div`
  display: none;

  ${mobile(css`
    align-items: center;
    display: flex;
    height: ${rem(navbarHeight)};
    justify-content: space-between;
    position: relative;
    width: 100%;
  `)};
`

const LogoLink = styled(Link).attrs(() => ({
  unstyled: true,
}))`
  display: flex;
  align-items: center;
  gap: ${rem(10)};
  text-decoration: none;
`

const BrandName = styled.strong`
  font-family: var(--sans);
  font-size: ${rem(18)};
  font-weight: 700;
  color: var(--ink);
  letter-spacing: -0.01em;
`

const MenuToggle = styled.button<{ $isOpen?: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  height: ${rem(44)};
  width: ${rem(44)};
  padding: 0;
  cursor: pointer;
  border: none;
  background: transparent;
  flex-shrink: 0;
  transition: filter 200ms ease;

  &:hover {
    filter: brightness(0.85);
  }
`

const Bar = styled.span<{ $isOpen?: boolean }>`
  display: block;
  width: 20px;
  height: 2px;
  background: var(--ink);
  border-radius: 1px;
  transition: transform 0.25s cubic-bezier(0.22, 0.61, 0.36, 1),
              opacity 0.2s ease;

  ${(p) =>
    p.$isOpen &&
    css`
      &:nth-child(1) {
        transform: translateY(7px) rotate(45deg);
      }
      &:nth-child(2) {
        opacity: 0;
      }
      &:nth-child(3) {
        transform: translateY(-7px) rotate(-45deg);
      }
    `}
`

const DropdownMenu = styled.div<{ $isOpen?: boolean }>`
  position: absolute;
  top: ${rem(navbarHeight)};
  left: 0;
  right: 0;
  background: color-mix(in srgb, var(--paper) 96%, transparent);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--line-soft);
  overflow: hidden;
  max-height: 0;
  opacity: 0;
  transition: max-height 0.35s cubic-bezier(0.22, 0.61, 0.36, 1),
              opacity 0.25s ease;
  z-index: 100;

  ${(p) =>
    p.$isOpen &&
    css`
      max-height: ${rem(300)};
      opacity: 1;
    `}

  a {
    font-family: var(--sans);
    font-size: ${rem(15)};
    font-weight: 500;
    color: var(--ink-soft);
    text-decoration: none;
    display: flex;
    align-items: center;
    padding: ${rem(14)} ${rem(24)};
    transition: color 0.15s ease, background 0.15s ease;

    &:hover,
    &:focus {
      color: var(--seal);
      background: rgba(232, 230, 227, 0.04);
    }
  }
`

const DropdownLinks = styled(NavLinks)`
  margin-right: 0;
  flex-direction: column;
  align-items: stretch;

  a {
    font-family: var(--sans);
    font-size: ${rem(15)};
    font-weight: 500;
    color: var(--ink-soft);
    padding: ${rem(14)} ${rem(24)};
    line-height: 1.4;

    &:hover,
    &:focus {
      color: var(--seal);
      background: rgba(232, 230, 227, 0.04);
    }
  }
`

