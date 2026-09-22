import { AnimatePresence, motion, useIsPresent, useReducedMotion } from 'motion/react'
import { useTranslation } from 'next-i18next'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { DOWNLOAD_URL } from '../../utils/website'
import LanguageSwitcher from '../Nav/LanguageSwitcher'
import { Logo } from '../Nav/Logo'
import NavButton from '../Nav/NavButton'
import ThemeSwitcher from '../ThemeSwitcher'
import SiteArrow from './Arrow'
import { siteMenus, type SiteMenu } from './navigation'

export interface SiteHeaderProps {
  isSideFolded?: boolean
  isMobileNavFolded?: boolean
  onSideToggle?: () => void
  onMobileNavToggle?: () => void
  showSideNav?: boolean
}

function MenuColumns({ menu, onNavigate }: { menu: SiteMenu; onNavigate: () => void }) {
  const { t } = useTranslation()
  const present = useIsPresent()
  return (
    <div className='mf-menu-columns' data-columns={menu.sections.length} inert={!present}>
      {menu.sections.map((section) => (
        <section className='mf-menu-column' key={section.title}>
          <h2>{t(section.title)}</h2>
          <ul>
            {section.links.map((link) => (
              <li key={link.href}>
                <Link href={link.href} onClick={onNavigate} className='mf-menu-link'>
                  <span className='mf-menu-link-title'>
                    {t(link.title)}
                    <SiteArrow />
                  </span>
                  {link.description && (
                    <span className='mf-menu-link-description'>{t(link.description)}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

export default function SiteHeader({
  isSideFolded,
  isMobileNavFolded = true,
  onSideToggle,
  onMobileNavToggle,
  showSideNav = false,
}: SiteHeaderProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const reduceMotion = useReducedMotion()
  const headerRef = useRef<HTMLElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const triggers = useRef<(HTMLButtonElement | null)[]>([])
  const mobileTriggers = useRef<(HTMLButtonElement | null)[]>([])
  const mobileContentRef = useRef<HTMLDivElement>(null)
  const returnToMobileTrigger = useRef(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const focusMenu = useRef(false)
  const keyboardMenu = useRef(false)
  const previousIndex = useRef(0)
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const [mobileMenu, setMobileMenu] = useState<string | null>(null)
  const [panelHeight, setPanelHeight] = useState(0)
  const [direction, setDirection] = useState(1)
  const mobileOpen = !isMobileNavFolded
  const mobileOpenRef = useRef(mobileOpen)
  const open = mobileOpen || activeMenu !== null
  const currentMenu = siteMenus.find((menu) => menu.id === activeMenu)
  const currentMobileMenu = siteMenus.find((menu) => menu.id === mobileMenu)
  const instantMenu = reduceMotion || keyboardMenu.current
  const transition = { duration: instantMenu ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] as const }
  const contentTransition = {
    opacity: { duration: instantMenu ? 0 : 0.16 },
    transform: { duration: instantMenu ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] as const },
  }
  const attachContent = useCallback((element: HTMLDivElement | null) => {
    if (!element) return
    contentRef.current = element
    // Presence keeps the previous panel mounted during its exit. Its cleanup
    // must not erase the ref to the newly selected panel.
    return () => {
      if (contentRef.current === element) contentRef.current = null
    }
  }, [])

  const cancelHover = useCallback(() => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current)
    hoverTimer.current = null
  }, [])
  const close = useCallback(() => {
    cancelHover()
    setActiveMenu(null)
    setMobileMenu(null)
    // A link click and Next's routeChangeStart can both close the same menu.
    if (mobileOpenRef.current) {
      mobileOpenRef.current = false
      onMobileNavToggle?.()
    }
  }, [cancelHover, onMobileNavToggle])
  const selectMenu = (index: number) => {
    cancelHover()
    setDirection(index >= previousIndex.current ? 1 : -1)
    previousIndex.current = index
    setActiveMenu(siteMenus[index].id)
  }

  useEffect(() => {
    router.events.on('routeChangeStart', close)
    return () => router.events.off('routeChangeStart', close)
  }, [close, router.events])
  useEffect(() => cancelHover, [cancelHover])
  useEffect(() => {
    mobileOpenRef.current = mobileOpen
  }, [mobileOpen])
  useEffect(() => {
    const content = contentRef.current
    if (!content || !activeMenu) return
    const measure = () => setPanelHeight(content.getBoundingClientRect().height)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(content)
    if (focusMenu.current) {
      content.querySelector<HTMLAnchorElement>('a')?.focus()
      focusMenu.current = false
    }
    return () => observer.disconnect()
  }, [activeMenu, router.locale])
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) close()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      keyboardMenu.current = true
      close()
      if (mobileOpen) toggleRef.current?.focus()
      else triggers.current[previousIndex.current]?.focus()
    }
    const media = window.matchMedia('(min-width: 1001px)')
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    media.addEventListener('change', close)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      media.removeEventListener('change', close)
    }
  }, [close, mobileOpen, open])

  return (
    <>
      <div
        className='mf-navigation-scrim'
        data-open={open}
        data-instant={instantMenu}
        aria-hidden='true'
      />
      <header
        ref={headerRef}
        className='mf-site-header'
        data-home={router.pathname === '/'}
        data-open={open}
        data-keyboard={keyboardMenu.current}
        onPointerEnter={cancelHover}
        onPointerLeave={(event) => {
          if (event.pointerType !== 'mouse' || keyboardMenu.current) return
          cancelHover()
          if (activeMenu) hoverTimer.current = setTimeout(() => setActiveMenu(null), 180)
        }}
        onBlur={(event) => {
          if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) close()
        }}
      >
        <a className='mf-skip-link' href='#main-content'>
          {t('site.nav.skip')}
        </a>
        <div className='mf-site-header-inner'>
          {showSideNav && onSideToggle && (
            <NavButton
              className='mf-site-sidebar-toggle'
              type='button'
              onClick={onSideToggle}
              aria-expanded={isSideFolded === false}
              aria-controls='docs-sidebar'
              aria-label={t('common.docs')}
            >
              <i className='ri-side-bar-line' aria-hidden='true' />
            </NavButton>
          )}
          <Link
            href='/'
            className='mf-site-brand'
            aria-label='MarkFlowy'
            onPointerEnter={() => {
              cancelHover()
              setActiveMenu(null)
            }}
          >
            <Logo size={28} />
            <span>MarkFlowy</span>
          </Link>
          <nav className='mf-site-desktop-nav' aria-label={t('site.nav.main')}>
            {siteMenus.map((menu, index) => (
              <NavButton
                key={menu.id}
                ref={(element) => {
                  triggers.current[index] = element
                }}
                className='mf-nav-trigger'
                id={`mf-nav-${menu.id}`}
                type='button'
                aria-expanded={activeMenu === menu.id}
                aria-controls={activeMenu === menu.id ? 'mf-site-mega-menu' : undefined}
                onPointerEnter={(event) => {
                  if (event.pointerType !== 'mouse') return
                  keyboardMenu.current = false
                  cancelHover()
                  hoverTimer.current = setTimeout(() => selectMenu(index), activeMenu ? 0 : 100)
                }}
                onPointerLeave={cancelHover}
                onClick={(event) => {
                  keyboardMenu.current = event.detail === 0
                  if (event.detail === 0 && activeMenu === menu.id) close()
                  else selectMenu(index)
                }}
                onKeyDown={(event) => {
                  keyboardMenu.current = true
                  if (event.key === 'ArrowDown') {
                    event.preventDefault()
                    if (activeMenu === menu.id)
                      contentRef.current?.querySelector<HTMLAnchorElement>('a')?.focus()
                    else {
                      focusMenu.current = true
                      selectMenu(index)
                    }
                  }
                  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
                    event.preventDefault()
                    const next =
                      (index + (event.key === 'ArrowRight' ? 1 : -1) + siteMenus.length) %
                      siteMenus.length
                    triggers.current[next]?.focus()
                    if (activeMenu) selectMenu(next)
                  }
                }}
              >
                {t(menu.title)}
                <svg
                  className='mf-nav-chevron'
                  viewBox='0 0 12 12'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth='1.5'
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  aria-hidden='true'
                  focusable='false'
                >
                  <path className='mf-nav-chevron-left' d='m3 4 3 3' />
                  <path className='mf-nav-chevron-right' d='m6 7 3-3' />
                </svg>
              </NavButton>
            ))}
            <Link
              href='/releases'
              onPointerEnter={() => {
                cancelHover()
                setActiveMenu(null)
              }}
              aria-current={router.pathname === '/releases' ? 'page' : undefined}
            >
              {t('navigation.releases')}
            </Link>
          </nav>
          <div
            className='mf-site-header-actions'
            onPointerEnter={() => {
              cancelHover()
              setActiveMenu(null)
            }}
          >
            <LanguageSwitcher />
            <ThemeSwitcher />
            <Link className='mf-button mf-button-secondary mf-site-web-link' href='/workspace'>
              {t('navigation.webApp')}
              <span className='mf-beta'>Beta</span>
            </Link>
            <Link className='mf-button mf-header-download' href={DOWNLOAD_URL}>
              {t('navigation.download')}
              <SiteArrow />
            </Link>
          </div>
          <NavButton
            ref={toggleRef}
            className='mf-site-menu-toggle'
            type='button'
            aria-expanded={mobileOpen}
            aria-controls='mf-site-mobile-menu'
            aria-label={t(mobileOpen ? 'navigation.closeMenu' : 'navigation.openMenu')}
            onClick={(event) => {
              keyboardMenu.current = event.detail === 0
              onMobileNavToggle?.()
            }}
          >
            <span className='mf-menu-toggle-lines' aria-hidden='true' />
          </NavButton>
        </div>
        <AnimatePresence custom={instantMenu}>
          {currentMenu && (
            <motion.div
              key='desktop-menu'
              id='mf-site-mega-menu'
              className='mf-site-mega-menu'
              aria-labelledby={`mf-nav-${currentMenu.id}`}
              initial={{ clipPath: 'inset(0 -60px 100% -60px)', opacity: 0 }}
              animate={{
                height: panelHeight || 'auto',
                clipPath: 'inset(0 -60px -60px -60px)',
                opacity: 1,
              }}
              variants={{
                exit: (instant: boolean) => ({
                  clipPath: 'inset(0 -60px 100% -60px)',
                  opacity: 0,
                  transition: { ...transition, duration: instant ? 0 : 0.2 },
                }),
              }}
              exit='exit'
              transition={transition}
              onPointerEnter={cancelHover}
            >
              <AnimatePresence initial={false} mode='popLayout' custom={direction}>
                <motion.div
                  key={currentMenu.id}
                  ref={attachContent}
                  custom={direction}
                  variants={{
                    enter: (value: number) => ({
                      transform: `translateX(${instantMenu ? 0 : value * 18}px)`,
                      opacity: 0,
                    }),
                    visible: { transform: 'translateX(0%)', opacity: 1 },
                    exit: (value: number) => ({
                      transform: `translateX(${instantMenu ? 0 : value * -18}px)`,
                      opacity: 0,
                    }),
                  }}
                  initial='enter'
                  animate='visible'
                  exit='exit'
                  transition={contentTransition}
                >
                  <MenuColumns menu={currentMenu} onNavigate={close} />
                </motion.div>
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence custom={instantMenu}>
          {mobileOpen && (
            <motion.div
              id='mf-site-mobile-menu'
              className='mf-site-mobile-menu'
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              variants={{
                exit: (instant: boolean) => ({
                  height: 0,
                  opacity: 0,
                  transition: { ...transition, duration: instant ? 0 : 0.2 },
                }),
              }}
              exit='exit'
              transition={transition}
            >
              <AnimatePresence initial={false} mode='wait'>
                <motion.div
                  key={mobileMenu || 'root'}
                  ref={mobileContentRef}
                  initial={{
                    opacity: 0,
                    transform: `translateX(${instantMenu ? 0 : mobileMenu ? 20 : -20}px)`,
                  }}
                  animate={{ opacity: 1, transform: 'translateX(0px)' }}
                  exit={{
                    opacity: 0,
                    transform: `translateX(${instantMenu ? 0 : mobileMenu ? 20 : -20}px)`,
                  }}
                  transition={{ ...transition, duration: instantMenu ? 0 : 0.16 }}
                  onAnimationComplete={() => {
                    if (!mobileOpenRef.current) return
                    if (mobileMenu)
                      mobileContentRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
                    else if (returnToMobileTrigger.current) {
                      mobileTriggers.current[previousIndex.current]?.focus()
                      returnToMobileTrigger.current = false
                    }
                  }}
                >
                  {currentMobileMenu ? (
                    <>
                      <NavButton
                        className='mf-mobile-back'
                        type='button'
                        onClick={(event) => {
                          keyboardMenu.current = event.detail === 0
                          previousIndex.current = siteMenus.findIndex(
                            (menu) => menu.id === mobileMenu,
                          )
                          returnToMobileTrigger.current = true
                          setMobileMenu(null)
                        }}
                      >
                        <i className='ri-arrow-left-line' aria-hidden='true' />
                        {t('site.nav.back')}
                      </NavButton>
                      <MenuColumns menu={currentMobileMenu} onNavigate={close} />
                    </>
                  ) : (
                    <nav className='mf-mobile-root' aria-label={t('site.nav.main')}>
                      {siteMenus.map((menu, index) => (
                        <NavButton
                          type='button'
                          key={menu.id}
                          ref={(element) => {
                            mobileTriggers.current[index] = element
                          }}
                          onClick={(event) => {
                            keyboardMenu.current = event.detail === 0
                            setMobileMenu(menu.id)
                          }}
                        >
                          {t(menu.title)}
                          <i className='ri-arrow-right-s-line' aria-hidden='true' />
                        </NavButton>
                      ))}
                      <Link href='/releases' onClick={close}>
                        {t('navigation.releases')}
                      </Link>
                      <Link href='/workspace' onClick={close}>
                        {t('navigation.webApp')}
                        <span className='mf-beta'>Beta</span>
                      </Link>
                    </nav>
                  )}
                </motion.div>
              </AnimatePresence>
              <div className='mf-mobile-cta'>
                <Link className='mf-button' href={DOWNLOAD_URL} onClick={close}>
                  {t('home.hero.download')}
                  <SiteArrow />
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>
    </>
  )
}
