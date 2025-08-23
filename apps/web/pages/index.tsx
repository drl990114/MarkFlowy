import Feature from 'components/Feature'
import { GetStaticProps } from 'next'
import { i18n, useTranslation } from 'next-i18next'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import React from 'react'
import styled, { css } from 'styled-components'
import Footer from '../components/Footer'
import { Content } from '../components/Layout'
import Nav from '../components/Nav'
import SeoHead from '../components/SeoHead'
import rem from '../utils/rem'

export default function Index() {
  const { t } = useTranslation()
  const [isMobileNavFolded, setIsMobileNavFolded] = React.useState(true)
  const localesDescMap = {
    en: (
      <SupportingTagline>
        MarkFlowy is an <HighlightLink>open-source</HighlightLink> markdown editor application that
        supports Windows, Linux, and macOS, designed to make editing more{' '}
        <HighlightLink>efficient</HighlightLink> and <HighlightLink>comfortable</HighlightLink>.
      </SupportingTagline>
    ),
    zh: (
      <SupportingTagline>
        MarkFlowy 是一款 <HighlightLink>开源</HighlightLink> 的 Markdown 编辑器应用，支持
        Windows、Linux 和 macOS，旨在提供 <HighlightLink>更高效</HighlightLink> 、
        <HighlightLink>舒适</HighlightLink> 的编辑体验
      </SupportingTagline>
    ),
  }
  return (
    <>
      <SeoHead title='MarkFlowy'>
        <meta name='robots' content='noodp' />
      </SeoHead>

      <Nav
        showSideNav={false}
        isMobileNavFolded={isMobileNavFolded}
        onMobileNavToggle={() => setIsMobileNavFolded((x) => !x)}
      />

      <Wrapper>
        <Content $hero style={{ backgroundColor: 'transparent', minHeight: '0' }}>
          <Title>
            <Tagline>{t('home.hero.subtitle')}</Tagline>
            {localesDescMap[(i18n?.language as keyof typeof localesDescMap) || 'en']}
          </Title>

          <Links>
            <Button
              $primary
              href='https://github.com/drl990114/MarkFlowy/releases'
              target='_blank'
              rel='noopener'
            >
              {t('home.hero.download')}
            </Button>

            <Button href={`${i18n?.language ? `/${i18n.language}` : ''}/docs`}>
              {t('common.docs')}
            </Button>
          </Links>
        </Content>
        <Feature />
      </Wrapper>
      <Footer />
    </>
  )
}

const Tagline = styled.h1`
  font-weight: 700;
  font-size: 3.75rem;
  line-height: 1.1;
  margin: 0 0 0.5em;

  @media screen and (max-width: 800px) {
    font-size: 3rem;
  }
`

const SupportingTagline = styled.p`
  font-size: 1.3rem;
  margin: 0;
  font-weight: 400;

  @media screen and (max-width: 800px) {
    font-size: 1rem;
  }
`

const HighlightLink = styled.a`
  display: inline-block;
  position: relative;
  text-decoration: none;
  transition: color 0.2s ease;

  &:hover {
    &::before {
      height: 0.25em;
      border-radius: 2px;
    }
  }

  &::before {
    content: '';
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    height: 0.125em;
    border-radius: 6px;
    box-sizing: border-box;
    background-image: linear-gradient(to right, #47b6ff, #ec4899);
  }
`

const Button = styled.a<{ $primary?: boolean }>`
  --accent-color: #037acc;

  /* This renders the buttons above... Edit me! */
  background: transparent;
  border-radius: 8px;
  color: ${(props) => props.theme.primaryFontColor};
  display: inline-block;
  margin: 0.5rem 1rem;
  padding: 0.5rem 0;
  transition: all 200ms ease-in-out;
  width: 11rem;

  &:hover {
    filter: brightness(0.85);
  }

  &:active {
    filter: brightness(1);
  }

  ${(props) =>
    props.$primary &&
    css`
      border: 1px solid var(--accent-color);
      background: var(--accent-color);
    `}
`

const Title = styled.div`
  align-items: center;
  display: flex;
  flex-direction: column;
  margin: 3rem 0;

  > * {
    flex-shrink: 0;
  }
`

const Wrapper = styled.div.attrs((props) => ({
  className: 'hero-header', // for integration tests
  ...props,
}))`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  background-color: ${(props) => props.theme.bgColor};
  color: ${(props) => props.theme.primaryFontColor};
  box-sizing: border-box;
  min-height: 100vh;
`

const Links = styled.div`
  margin: ${rem(36)} 0;
`

export const getStaticProps: GetStaticProps = async ({ locale }) => {
  return {
    props: {
      ...(await serverSideTranslations(locale || 'en', ['common'])),
    },
  }
}
