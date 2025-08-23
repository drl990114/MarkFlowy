import { i18n } from 'next-i18next'
import styled, { css } from 'styled-components'
import { mobile } from '../../utils/media'
import rem from '../../utils/rem'
import { navbarHeight } from '../../utils/sizes'
import Link from '../Link'
import LanguageSwitcher from './LanguageSwitcher'
import MobileNavbar from './MobileNavbar'
import NavLinks from './NavLinks'
import Social from './Social'

export interface NavbarProps {
  onSideToggle?: () => void
  onMobileNavToggle?: () => void
  isSideFolded?: boolean
  isMobileNavFolded?: boolean
  showSideNav?: boolean
}

export default function Navbar({
  onSideToggle,
  onMobileNavToggle,
  isSideFolded,
  isMobileNavFolded,
  showSideNav,
}: NavbarProps) {
  return (
    <Wrapper>
      <MobileNavbar
        isSideFolded={isSideFolded}
        isMobileNavFolded={isMobileNavFolded}
        onSideToggle={onSideToggle}
        onMobileNavToggle={onMobileNavToggle}
        showSideNav={showSideNav}
      />

      <NormalNavbar>
        <StartWrapper>
          <LogoLink aria-label='MarkFlowy logo' href={`./${i18n?.language || 'en'}`}>
            <strong>MarkFlowy</strong>
          </LogoLink>

          <NavLinks />
        </StartWrapper>
      </NormalNavbar>

      <EndWrapper
        /** @ts-ignore */
        css={css`
          margin-left: auto;
          margin-right: 16px;

          ${mobile(css`
            margin-right: 48px;
          `)}
        `}
      >
        <LanguageSwitcher style={{ marginRight: 8 }} />
        <StyledSocial style={{ marginLeft: 8 }} />
      </EndWrapper>
    </Wrapper>
  )
}

const Wrapper = styled.nav<{ $transparent?: boolean }>`
  align-items: center;
  background-color: ${(props) => props.theme.navBackground};
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
  box-sizing: border-box;
  color: white;
  display: flex;
  flex-wrap: wrap;
  font-family: ${(props) => props.theme.fontFamily};
  font-size: ${rem(15)};
  font-weight: 500;
  justify-content: center;
  height: ${rem(navbarHeight)};
  left: 0;
  padding: 0;
  position: fixed;
  transition: background 300ms ease-out;
  width: 100%;
  z-index: 3;
`

const StartWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-start;
`

const EndWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
`
/* stylelint-disable */
const StyledSocial = styled(Social)``
/* stylelint-enable */

const NormalNavbar = styled.div`
  display: flex;
  align-items: center;
  padding: 0 ${rem(20)};
  justify-content: space-between;

  ${StartWrapper}, ${EndWrapper} ${StyledSocial} {
    ${mobile(css`
      display: none;
    `)};
  }
`

const LogoLink = styled(Link).attrs((/* props */) => ({
  unstyled: true,
  href: '/',
}))`
  display: inline-block;
  vertical-align: center;
  margin-right: ${rem(35)};
`
