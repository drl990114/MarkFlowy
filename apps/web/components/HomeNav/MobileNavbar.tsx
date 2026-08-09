import NextLink from 'next/link'
import { useRouter } from 'next/router'
import { useTranslation } from 'next-i18next'
import { useCallback, useEffect, useRef } from 'react'
import styled, { css } from 'styled-components'
import { mobile } from '../../utils/media'
import rem from '../../utils/rem'
import { navbarHeight } from '../../utils/sizes'
import Link from '../Link'
import LanguageSwitcher from '../Nav/LanguageSwitcher'
import { Logo } from '../Nav/Logo'
import NavLinks from '../Nav/NavLinks'
import WebAppBetaTag from './WebAppBetaTag'

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
  const router = useRouter()
  const wrapperRef = useRef<HTMLDivElement>(null)
  const isOpen = isMobileNavFolded === false
  const closeMenu = useCallback(() => {
    if (isOpen) onMobileNavToggle?.()
  }, [isOpen, onMobileNavToggle])

  useEffect(() => {
    router.events.on('routeChangeStart', closeMenu)
    return () => router.events.off('routeChangeStart', closeMenu)
  }, [closeMenu, router.events])

  useEffect(() => {
    if (!isOpen) return

    const previousOverflow = document.body.style.overflow
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu()
    }
    const handlePointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) closeMenu()
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)
    document.addEventListener('pointerdown', handlePointerDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [closeMenu, isOpen])

  return (
    <Wrapper ref={wrapperRef}>
      <LogoLink href='/' unstyled>
        <Logo size={20} />
        <BrandName>MarkFlowy</BrandName>
      </LogoLink>

      <MenuToggle
        type='button'
        aria-label={isOpen ? t('navigation.closeMenu') : t('navigation.openMenu')}
        aria-expanded={isOpen}
        aria-controls='home-mobile-navigation'
        onClick={onMobileNavToggle}
      >
        <Bar $isOpen={isOpen} />
        <Bar $isOpen={isOpen} />
        <Bar $isOpen={isOpen} />
      </MenuToggle>

      <DropdownMenu id='home-mobile-navigation' $isOpen={isOpen} aria-hidden={!isOpen}>
        <DropdownLinks />
        <MobileWebAppLink href='/workspace'>
          <i className='ri-play-circle-line' aria-hidden='true' />
          {t('navigation.webApp')}
          <WebAppBetaTag>Beta</WebAppBetaTag>
          <i className='ri-arrow-right-line' aria-hidden='true' />
        </MobileWebAppLink>
        <MobileActions>
          <LanguageSwitcher />
          <MobileGitHubLink
            href='https://github.com/drl990114/MarkFlowy'
            target='_blank'
            rel='noopener noreferrer'
            onClick={closeMenu}
          >
            <i className='ri-github-fill' aria-hidden='true' />
            GitHub
          </MobileGitHubLink>
        </MobileActions>
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
  min-height: 44px;
  gap: ${rem(10)};
  text-decoration: none;

  &:focus-visible {
    outline: 2px solid var(--seal);
    outline-offset: 2px;
    border-radius: ${rem(4)};
  }
`

const BrandName = styled.strong`
  font-family: var(--sans);
  font-size: ${rem(18)};
  font-weight: 700;
  color: var(--ink);
  letter-spacing: -0.01em;
`

const MenuToggle = styled.button`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 1px solid var(--line-soft);
  border-radius: ${rem(8)};
  background: color-mix(in srgb, var(--paper-warm) 72%, transparent);
  color: var(--ink);
  flex-shrink: 0;
  transition:
    border-color 160ms ease,
    background 160ms ease,
    transform 140ms cubic-bezier(0.23, 1, 0.32, 1);

  &:active {
    transform: scale(0.97);
  }

  &:focus-visible {
    outline: 2px solid var(--seal);
    outline-offset: 2px;
  }

  @media (hover: hover) and (pointer: fine) {
    &:hover {
      border-color: var(--seal);
    }
  }
`

const Bar = styled.span<{ $isOpen: boolean }>`
  display: block;
  width: 20px;
  height: 2px;
  background: currentColor;
  border-radius: 1px;
  transition:
    transform 180ms cubic-bezier(0.23, 1, 0.32, 1),
    opacity 140ms ease;

  ${({ $isOpen }) =>
    $isOpen &&
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

const DropdownMenu = styled.div<{ $isOpen: boolean }>`
  position: fixed;
  top: calc(${rem(navbarHeight)} + env(safe-area-inset-top));
  left: 0;
  right: 0;
  max-height: calc(100dvh - ${rem(navbarHeight)} - env(safe-area-inset-top));
  overflow-y: auto;
  padding: ${rem(8)} clamp(${rem(16)}, 4vw, ${rem(24)})
    calc(${rem(16)} + env(safe-area-inset-bottom));
  border-bottom: 1px solid var(--line-soft);
  background: color-mix(in srgb, var(--paper) 97%, transparent);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  box-shadow: 0 ${rem(18)} ${rem(40)} rgba(0, 0, 0, 0.22);
  opacity: ${({ $isOpen }) => ($isOpen ? 1 : 0)};
  pointer-events: ${({ $isOpen }) => ($isOpen ? 'auto' : 'none')};
  transform: ${({ $isOpen }) =>
    $isOpen ? 'translate3d(0, 0, 0)' : `translate3d(0, ${rem(-8)}, 0)`};
  visibility: ${({ $isOpen }) => ($isOpen ? 'visible' : 'hidden')};
  transition:
    opacity 180ms ease,
    transform 180ms cubic-bezier(0.23, 1, 0.32, 1),
    visibility 0s linear ${({ $isOpen }) => ($isOpen ? '0s' : '180ms')};
  z-index: 100;

  @media (prefers-reduced-motion: reduce) {
    transform: none;
    transition-duration: 120ms, 0ms, 0ms;
  }
`

const DropdownLinks = styled(NavLinks)`
  align-items: stretch;
  flex-direction: column;
  margin-right: 0;

  > span {
    display: none;
  }

  a {
    display: flex;
    align-items: center;
    min-height: 48px;
    padding: ${rem(12)} ${rem(8)};
    color: var(--ink-soft);
    font-family: var(--sans);
    font-size: ${rem(15)};
    font-weight: 500;
    line-height: 1.4;
    text-decoration: none;

    &:focus-visible {
      color: var(--seal);
      outline: 2px solid var(--seal);
      outline-offset: -2px;
    }

    @media (hover: hover) and (pointer: fine) {
      &:hover {
        color: var(--seal);
        background: rgba(232, 230, 227, 0.04);
      }
    }
  }
`

const MobileActions = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${rem(12)};
  padding-top: ${rem(12)};
  border-top: 1px solid var(--line-soft);
`

const MobileWebAppLink = styled(NextLink)`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  gap: ${rem(8)};
  margin: ${rem(8)} 0 ${rem(12)};
  padding: 0 ${rem(16)};
  border: 1px solid var(--seal);
  border-radius: ${rem(8)};
  background: var(--seal);
  color: var(--paper);
  font-family: var(--sans);
  font-size: ${rem(14)};
  font-weight: 700;
  text-decoration: none;

  i:last-child {
    margin-left: auto;
  }

  &:focus-visible {
    outline: 2px solid var(--seal);
    outline-offset: 2px;
  }

  &:active {
    transform: scale(0.98);
  }

  @media (prefers-reduced-motion: reduce) {
    transform: none;
  }
`

const MobileGitHubLink = styled.a`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  gap: ${rem(7)};
  padding: 0 ${rem(14)};
  border: 1px solid var(--line-soft);
  border-radius: ${rem(8)};
  color: var(--ink-soft);
  font-family: var(--sans);
  font-size: ${rem(14)};
  font-weight: 600;
  text-decoration: none;

  &:focus-visible {
    outline: 2px solid var(--seal);
    outline-offset: 2px;
  }

  @media (hover: hover) and (pointer: fine) {
    &:hover {
      border-color: var(--seal);
      color: var(--seal);
    }
  }
`
