import { useTranslation } from 'next-i18next'
import styled from 'styled-components'
import rem from '../../utils/rem'
import { navbarHeight } from '../../utils/sizes'
import Link from '../Link'
import NavSeparator from './NavSeparator'

const Wrapper = styled.nav`
  display: flex;
  align-items: center;
  flex: 0 0 auto;
  margin-right: ${rem(30)};
`

const NavLink = styled(Link).attrs((/* props */) => ({
  unstyled: true,
}))`
  flex: 0 0 auto;
  display: inline-block;
  line-height: ${rem(navbarHeight)};
  transition:
    opacity 0.2s,
    transform 0.2s;
  cursor: pointer;
  letter-spacing: ${rem(0.4)};
  color: ${props => props.theme.unselectedFontColor};

  &:hover,
  &:focus {
  color: currentColor;
    opacity: 0.8;
  }

  &:active {
    transform: scale(0.95);
    opacity: 0.6;
  }
`

const NavLinks = () => {
  const { t } = useTranslation()
  return (
    <Wrapper>
      <NavLink href='/docs'>{t("navigation.docs")}</NavLink>
      <NavSeparator />
      <NavLink href='/releases'>{t('navigation.releases')}</NavLink>
    </Wrapper>
  )
}

export default NavLinks
