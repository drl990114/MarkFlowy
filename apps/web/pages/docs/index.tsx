import type { GetStaticProps } from 'next'
import { useTranslation } from 'next-i18next'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import { useRouter } from 'next/router'
import styled, { css } from 'styled-components'
import { getSections } from 'utils/sections'
import DocsLayout from '../../components/DocsLayout'
import Link from '../../components/Link'
import { mobile, phone } from '../../utils/media'

export default function Documentation() {
  const { t } = useTranslation()
  const router = useRouter()
  const currentLocale = router.locale || 'en'
  const sections = getSections(currentLocale)
  const keys = Object.keys(sections)

  return (
    <DocsLayout
      title={t('docs.sidebar.gettingStarted')}
      description={t('docs.content.description', { defaultValue: t('common.docs') })}
    >
      <Row>
        {keys.map((key) => {
          const section = sections[key]
          return (
            <Column key={key}>
              <SectionTitle>{t(`fileTitle.${key}`)}</SectionTitle>

              <DocumentList>
                {section.map(({ slug, title }) => {
                  return (
                    <DocumentItem key={slug}>
                      <DocumentLink href={`/docs${slug}`} locale={currentLocale}>
                        <DocumentTitle>{t(`fileTitle.${title}`)}</DocumentTitle>
                      </DocumentLink>
                    </DocumentItem>
                  )
                })}
              </DocumentList>
            </Column>
          )
        })}
      </Row>
    </DocsLayout>
  )
}

const Row = styled.ul`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
  margin: 2rem 0 4rem;
  padding: 0;
  list-style: none;

  ${mobile(css`
    grid-template-columns: repeat(2, minmax(0, 1fr));
  `)}

  ${phone(css`
    grid-template-columns: minmax(0, 1fr);
  `)};
`

const Column = styled.li`
  min-width: 0;
  padding: 1rem;
  border: 1px solid var(--line-soft);
  border-radius: 0.75rem;
  background: color-mix(in srgb, var(--ink) 4%, transparent);
`

const SectionTitle = styled.h2`
  margin: 0 0 0.625rem;
  color: var(--ink);
  font-family: var(--sans);
  font-size: 0.9375rem;
  font-weight: 500;
  line-height: 1.375rem;
  text-wrap: balance;
`

const DocumentList = styled.ul`
  display: grid;
  gap: 0.125rem;
  margin: 0;
  padding: 0;
  list-style: none;
`

const DocumentItem = styled.li`
  min-width: 0;
`

const DocumentLink = styled(Link)`
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

  @media (prefers-reduced-motion: reduce) {
    transition-duration: 0ms;
  }
`

const DocumentTitle = styled.span`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const getStaticProps: GetStaticProps = async ({ locale }) => {
  return {
    props: {
      ...(await serverSideTranslations(locale || 'en', ['common'])),
    },
  }
}
