import { useTranslation } from 'next-i18next'
import { useRouter } from 'next/router'
import styled, { css } from 'styled-components'
import { getSections } from 'utils/sections'
import Link from '../Link'

export interface SimpleSidebarMenuProps {
  pages?: {
    title: string
    pathname: string
    sections: { title: string }[]
    href: string
  }[]
}

const normalizePath = (path: string) => {
  const normalized = path.split(/[?#]/, 1)[0].replace(/\/+$/, '')
  return normalized || '/'
}

const resolvePageHref = (href: string) => {
  if (href.startsWith('/') || href.startsWith('#') || /^https?:\/\//.test(href)) {
    return href
  }

  return `#${href}`
}

export const SimpleSidebarMenu = ({ pages = [] }: SimpleSidebarMenuProps) => {
  const router = useRouter()
  const { t } = useTranslation()
  const currentPath = router.asPath

  return (
    <MenuInner>
      <MenuHeader>{t('navigation.releases')}</MenuHeader>

      <MenuList>
        {pages.map(({ href, title }) => {
          const resolvedHref = resolvePageHref(href)
          const isActive = resolvedHref.startsWith('#')
            ? currentPath.endsWith(resolvedHref)
            : normalizePath(currentPath) === normalizePath(resolvedHref)

          return (
            <MenuItem key={`${href}-${title}`}>
              <MenuLink
                href={resolvedHref}
                title={title}
                aria-current={isActive ? 'page' : undefined}
                $isActive={isActive}
              >
                <MenuItemText>{title}</MenuItemText>
              </MenuLink>
            </MenuItem>
          )
        })}
      </MenuList>
    </MenuInner>
  )
}

export const DocsSidebarMenu = () => {
  const router = useRouter()
  const currentLocale = router.locale || 'en'
  const currentPath = normalizePath(router.asPath)
  const sections = getSections(currentLocale)
  const keys = Object.keys(sections)
  const { t } = useTranslation()

  return (
    <MenuInner>
      <MenuHeader>{t('common.docs')}</MenuHeader>

      {keys.map((key) => {
        const section = sections[key]

        return (
          <Section key={key}>
            <SectionTitle>{t(`fileTitle.${key}`)}</SectionTitle>

            <MenuList>
              {section.map(({ slug, title }) => {
                const href = `/docs${slug}`
                const isActive = currentPath === normalizePath(href)
                const label = t(`fileTitle.${title}`)

                return (
                  <MenuItem key={slug}>
                    <MenuLink
                      href={href}
                      locale={currentLocale}
                      title={label}
                      aria-current={isActive ? 'page' : undefined}
                      $isActive={isActive}
                    >
                      <MenuItemText>{label}</MenuItemText>
                    </MenuLink>
                  </MenuItem>
                )
              })}
            </MenuList>
          </Section>
        )
      })}
    </MenuInner>
  )
}

const MenuInner = styled.div`
  box-sizing: border-box;
  min-height: 100%;
  padding: 0.75rem 0.75rem calc(1.5rem + env(safe-area-inset-bottom));
`

const MenuHeader = styled.div`
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 2.375rem;
  margin-bottom: 0.75rem;
  padding: 0.5rem 0.625rem;
  border: 1px solid var(--line-soft);
  border-radius: 0.625rem;
  background: color-mix(in srgb, var(--ink) 7%, transparent);
  box-sizing: border-box;
  overflow: hidden;
  color: var(--ink);
  font-family: var(--sans);
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 1.25rem;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const Section = styled.section`
  margin-bottom: 0.25rem;

  &:last-child {
    margin-bottom: 0;
  }
`

const SectionTitle = styled.div`
  display: flex;
  align-items: center;
  min-height: 2.25rem;
  padding: 0.5rem;
  color: var(--ink);
  font-family: var(--sans);
  font-size: 0.8125rem;
  font-weight: 500;
  line-height: 1.25rem;
  text-wrap: pretty;
`

const MenuList = styled.ul`
  display: grid;
  gap: 0.0625rem;
  margin: 0 0 0.25rem 0.75rem;
  padding: 0 0 0 0.5rem;
  border-left: 1px solid var(--line-faint);
  list-style: none;
`

const MenuItem = styled.li`
  min-width: 0;
`

const MenuLink = styled(Link)<{ $isActive?: boolean }>`
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 2rem;
  margin: 0;
  padding: 0.375rem 0.5rem;
  border-radius: 0.5rem;
  box-sizing: border-box;
  color: var(--ink-mute);
  font-family: var(--body);
  font-size: 0.8125rem;
  font-weight: 400;
  line-height: 1.25rem;
  text-decoration: none;
  touch-action: manipulation;
  transition:
    background-color 150ms ease,
    color 150ms ease;

  &:focus-visible {
    outline: 2px solid var(--seal);
    outline-offset: 2px;
  }

  @media (hover: hover) and (pointer: fine) {
    &:hover {
      background: color-mix(in srgb, var(--ink) 5%, transparent);
      color: var(--ink);
    }
  }

  ${({ $isActive }) =>
    $isActive &&
    css`
      background: color-mix(in srgb, var(--ink) 9%, transparent);
      color: var(--ink);
      font-weight: 500;
    `}

  @media (prefers-reduced-motion: reduce) {
    transition-duration: 0ms;
  }
`

const MenuItemText = styled.span`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`
