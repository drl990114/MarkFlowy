import { useCallback, useEffect, useRef, useState } from 'react'
import { i18n, useTranslation } from 'next-i18next'
import styled, { css } from 'styled-components'
import { mobile } from '../../utils/media'
import rem from '../../utils/rem'
import Link from '../Link'
import LanguageSwitcher from '../Nav/LanguageSwitcher'
import { Logo } from '../Nav/Logo'
import NavLinks from '../Nav/NavLinks'
import Social from '../Nav/Social'
import MobileNavbar from './MobileNavbar'

export interface NavbarProps {
  onSideToggle?: () => void
  onMobileNavToggle?: () => void
  isSideFolded?: boolean
  isMobileNavFolded?: boolean
  showSideNav?: boolean
}

export default function Navbar({
  onMobileNavToggle,
  isMobileNavFolded,
}: NavbarProps) {
  const { t } = useTranslation()
  const [navState, setNavState] = useState<'visible' | 'hidden' | 'scrolled'>('visible')
  const lastScrollY = useRef(0)
  const ticking = useRef(false)

  const updateNavState = useCallback(() => {
    const scrollY = window.scrollY

    if (scrollY < 10) {
      setNavState('visible')
    } else if (scrollY > lastScrollY.current + 5 && scrollY > 80) {
      setNavState('hidden')
    } else if (scrollY < lastScrollY.current - 5) {
      setNavState('scrolled')
    } else if (scrollY > 10) {
      setNavState('scrolled')
    }

    lastScrollY.current = scrollY
    ticking.current = false
  }, [])

  useEffect(() => {
    const onScroll = () => {
      if (!ticking.current) {
        ticking.current = true
        requestAnimationFrame(updateNavState)
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [updateNavState])

  return (
    <Wrapper $state={navState}>
      <MainBarRow>
        <NavInner>
          <MobileNavbar
            isMobileNavFolded={isMobileNavFolded}
            onMobileNavToggle={onMobileNavToggle}
          />

          <DesktopStart>
            <LogoLink aria-label='MarkFlowy logo' href={`/${i18n?.language || 'en'}`}>
              <Logo />
              <BrandName>MarkFlowy</BrandName>
            </LogoLink>
            <StyledNavLinks />
          </DesktopStart>

          <DesktopEnd>
            <LanguageSwitcher />
            <StyledSocial />
          </DesktopEnd>
        </NavInner>
      </MainBarRow>
    </Wrapper>
  )
}

export const Brand = styled.span`
  font-family: var(--sans);
  font-size: ${rem(18)};
  font-weight: 700;
  color: var(--ink);
  margin: 0 ${rem(6)};
`

const Wrapper = styled.nav<{ $state: 'visible' | 'hidden' | 'scrolled' }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 50;
  background: color-mix(in srgb, var(--paper) 92%, transparent);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  transform: translateY(0);
  transition: transform 400ms cubic-bezier(0.16, 1, 0.3, 1),
              box-shadow 200ms ease,
              border-color 200ms ease;

  ${(p) =>
    p.$state === 'hidden' &&
    css`
      transform: translateY(-100%);
    `}

  ${(p) =>
    p.$state === 'scrolled' &&
    css`
      box-shadow: 0 1px 0 var(--line-soft);
    `}
`

const MainBarRow = styled.div`
  height: ${rem(52)};
`

const NavInner = styled.div`
  max-width: ${rem(1200)};
  margin: 0 auto;
  padding: 0 ${rem(24)};
  height: 100%;
  display: flex;
  align-items: center;
`

const DesktopStart = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-start;

  ${mobile(css`
    display: none;
  `)}
`

const DesktopEnd = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: ${rem(12)};
  margin-left: auto;

  ${mobile(css`
    display: none;
  `)}
`

const LogoLink = styled(Link).attrs(() => ({
  unstyled: true,
  href: '/',
}))`
  display: flex;
  align-items: center;
  gap: ${rem(8)};
  margin-right: ${rem(32)};
  color: var(--ink);
  text-decoration: none;
`

const BrandName = styled.strong`
  font-family: var(--sans);
  font-size: ${rem(16)};
  font-weight: 700;
  color: var(--ink);
  letter-spacing: -0.01em;
`

const StyledNavLinks = styled(NavLinks)`
  a {
    font-family: var(--sans);
    font-size: 14px;
    font-weight: 500;
    color: var(--ink-soft);
    transition: color 150ms ease;

    &:hover {
      color: var(--seal);
    }
  }
`

const StyledSocial = styled(Social)`
  a, svg {
    color: var(--ink-soft);
    transition: color 150ms ease;

    &:hover {
      color: var(--seal);
    }
  }
`
