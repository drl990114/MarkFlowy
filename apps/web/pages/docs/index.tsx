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
      <Description>{t('docs.content.description', { defaultValue: t('common.docs') })}</Description>
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
                        <span aria-hidden='true'>→</span>
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

const Description = styled.p`
  max-width: 38rem;
  margin: 0;
  color: var(--ink-soft);
  font-size: 1.0625rem;
  line-height: 1.75;
  text-wrap: pretty;
`

const Row = styled.ul`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1.25rem;
  margin: 2.5rem 0 0;
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
  padding: 1.25rem;
  border: 1px solid var(--line-soft);
  border-radius: 0.75rem;
  background: var(--paper);
`

const SectionTitle = styled.h2`
  margin: 0 0 0.875rem;
  color: var(--ink);
  font-family: var(--sans);
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.5rem;
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
  justify-content: space-between;
  gap: 0.75rem;
  width: 100%;
  min-height: 2.5rem;
  margin: 0;
  padding: 0.5rem;
  border-radius: 0.375rem;
  box-sizing: border-box;
  color: var(--ink-mute);
  font-family: var(--body);
  font-size: 0.875rem;
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
      background: color-mix(in srgb, var(--seal) 5%, transparent);
      color: var(--seal);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    transition-duration: 0ms;
  }
`

const DocumentTitle = styled.span`
  min-width: 0;
  overflow-wrap: anywhere;
`

export const getStaticProps: GetStaticProps = async ({ locale }) => {
  return {
    props: {
      ...(await serverSideTranslations(locale || 'en', ['common'])),
    },
  }
}
