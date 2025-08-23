import { GetStaticProps } from 'next'
import { useTranslation } from 'next-i18next'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import { useRouter } from 'next/router'
import styled, { css } from 'styled-components'
import { getSections } from 'utils/sections'
import DocsLayout from '../../components/DocsLayout'
import { Header } from '../../components/Layout'
import Link from '../../components/Link'
import { mobile, phone } from '../../utils/media'
import rem from '../../utils/rem'

export default function Documentation() {
  const { t } = useTranslation()
  const router = useRouter()
  const currentLocale = router.locale || 'en'
  const sections = getSections(currentLocale)
  const keys = Object.keys(sections)

  return (
    <DocsLayout
      title={t('docs.sidebar.gettingStarted')}
      description={t('docs.content.description')}
    >
      <Row>
        {keys.map((key) => {
          const section = sections[key]
          return (
            <Column key={key}>
              <Header>
                <span>{t(`fileTitle.${key}`)}</span>
              </Header>

              {section.map(({ slug, title }) => {
                return (
                  <SubHeader key={slug}>
                    <Link href={`/docs${slug}`} locale={currentLocale}>
                      {t(`fileTitle.${title}`)}
                    </Link>
                  </SubHeader>
                )
              })}
            </Column>
          )
        })}
      </Row>
    </DocsLayout>
  )
}

const Row = styled.div`
  display: flex;
  flex-flow: row wrap;
`

const Column = styled.div`
  width: 33%;
  max-width: 33%;
  flex-basis: 33%;
  padding-right: ${rem(15)};

  ${mobile(css`
    width: 50%;
    max-width: 50%;
    flex-basis: 50%;
  `)}
  ${phone(css`
    width: 100%;
    max-width: 100%;
    flex-basis: 100%;
  `)};
`

const SubHeader = styled.h3`
  display: block;
  margin: ${rem(8)} 0;
  font-size: ${rem(18)};
  font-weight: normal;
  font-family: ${(props) => props.theme.fontFamily};
`

export const getStaticProps: GetStaticProps = async ({ locale }) => {
  return {
    props: {
      ...(await serverSideTranslations(locale || 'en', ['common'])),
    },
  }
}
