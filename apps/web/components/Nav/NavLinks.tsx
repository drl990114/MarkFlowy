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
    color 0.2s,
    transform 0.2s;
  cursor: pointer;
  letter-spacing: ${rem(0.4)};
  color: var(--ink-mute);

  &:hover {
    color: var(--seal);
  }

  &:focus-visible {
    outline: none;
    text-decoration-line: underline;
    text-underline-offset: 2px;
    opacity: 0.8;
  }

  &:active {
    transform: scale(0.95);
  }
`

interface NavLinksProps {
  className?: string
}

const NavLinks = ({ className }: NavLinksProps) => {
  const { t } = useTranslation()
  return (
    <Wrapper className={className}>
      <NavLink href='/docs'>{t('navigation.docs')}</NavLink>
      <NavSeparator />
      <NavLink href='/releases'>{t('navigation.releases')}</NavLink>
    </Wrapper>
  )
}

export default NavLinks
