import { useTranslation } from 'next-i18next'
import styled from 'styled-components'
import rem from '../../utils/rem'
import { navbarHeight } from '../../utils/sizes'
import Navbar from './Navbar'
import Sidebar from './Sidebar'
import { DocsSidebarMenu, SimpleSidebarMenu, type SimpleSidebarMenuProps } from './SidebarMenus'

export interface NavProps {
  isSideFolded?: boolean
  isMobileNavFolded?: boolean
  onSideToggle?: () => void
  onMobileNavToggle?: () => void
  showSideNav?: boolean
  useDocsSidebarMenu?: boolean
  pages?: SimpleSidebarMenuProps['pages']
}

const Nav = (props: NavProps) => {
  const {
    isSideFolded,
    isMobileNavFolded,
    onSideToggle,
    onMobileNavToggle,
    showSideNav,
    useDocsSidebarMenu,
    pages,
  } = props
  const { t } = useTranslation()
  const isSidebarOpen = isSideFolded === false

  return (
    <div>
      <Navbar
        showSideNav={showSideNav}
        isSideFolded={isSideFolded}
        isMobileNavFolded={isMobileNavFolded}
        onSideToggle={onSideToggle}
        onMobileNavToggle={onMobileNavToggle}
      />

      {showSideNav !== false && (
        <>
          <Sidebar
            id='docs-sidebar'
            aria-label={useDocsSidebarMenu !== false ? t('common.docs') : t('navigation.releases')}
            $isFolded={isSideFolded}
          >
            {useDocsSidebarMenu !== false ? (
              <DocsSidebarMenu />
            ) : (
              <SimpleSidebarMenu pages={pages} />
            )}
          </Sidebar>
          <SidebarBackdrop
            type='button'
            aria-label={t('navigation.closeMenu', { defaultValue: 'Close menu' })}
            aria-hidden={!isSidebarOpen}
            tabIndex={isSidebarOpen ? 0 : -1}
            $isVisible={isSidebarOpen}
            onClick={onSideToggle}
          />
        </>
      )}
    </div>
  )
}

export default Nav

const SidebarBackdrop = styled.button<{ $isVisible: boolean }>`
  display: none;

  @media (max-width: ${1000 / 16}em) {
    position: fixed;
    inset: ${rem(navbarHeight)} 0 0;
    z-index: 1;
    display: block;
    padding: 0;
    border: 0;
    background: color-mix(in srgb, var(--paper-deep) 62%, transparent);
    opacity: ${({ $isVisible }) => ($isVisible ? 1 : 0)};
    pointer-events: ${({ $isVisible }) => ($isVisible ? 'auto' : 'none')};
    transition: opacity 150ms ease;

    &:focus-visible {
      outline: 2px solid var(--seal);
      outline-offset: -2px;
    }

    @media (prefers-reduced-motion: reduce) {
      transition-duration: 0ms;
    }
  }
`
