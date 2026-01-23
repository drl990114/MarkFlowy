import { i18n } from 'next-i18next'
import styled, { css } from 'styled-components'
import { mobile } from '../../utils/media'
import rem from '../../utils/rem'
import { navbarHeight } from '../../utils/sizes'
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
  onSideToggle,
  onMobileNavToggle,
  isSideFolded,
  isMobileNavFolded,
  showSideNav,
}: NavbarProps) {
  return (
    <>
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
              <Logo />
              <Brand> / </Brand>
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
      <div style={{ height: `${navbarHeight}px` }} />
    </>
  )
}

export const Brand = styled.span`
  font-size: ${rem(20)};
  font-weight: bold;
  margin: 0 12px;
  color: ${(props) => props.theme.unselectedFontColor};
`

const Wrapper = styled.nav<{ $transparent?: boolean; $scrolled?: boolean }>`
  position: fixed;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  margin: 0 auto;
  width: min(${(props) => props.theme.homeMaxWidth}, 100%);
  display: flex;
  align-items: center;
  background-color: ${(props) => props.theme.navBackground};
  box-sizing: border-box;
  color: white;
  flex-wrap: wrap;
  font-family: ${(props) => props.theme.fontFamily};
  font-size: ${rem(15)};
  font-weight: 500;
  justify-content: center;
  height: ${rem(navbarHeight)};
  transition: background 300ms ease-out;
  z-index: 3;
  padding: 0 ${rem(30)};

  ${mobile(css`
    padding: 0 ${rem(20)};
  `)}
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
  display: flex;
  align-items: center;
  vertical-align: center;
  margin-right: ${rem(35)};
`
