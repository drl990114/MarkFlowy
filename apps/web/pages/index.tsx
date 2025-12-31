import Feature from 'components/Feature'
import HighlightLink from 'components/HighLightLink'
import { SupportPlatforms } from 'components/SupportPlatforms'
import { motion } from 'motion/react'
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

type Contributor = {
  id: number
  login: string
  avatar_url: string
  html_url: string
}

export default function Index({
  contributors = [] as Contributor[],
}: {
  contributors?: Contributor[]
}) {
  const { t } = useTranslation()
  const [isMobileNavFolded, setIsMobileNavFolded] = React.useState(true)
  const [mousePosition, setMousePosition] = React.useState({ x: 0, y: 0 })

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const localesDescMap = {
    en: (
      <SupportingTagline>
        MarkFlowy is an <HighlightLink>open-source</HighlightLink> markdown editor application,
        dedicated to providing a <HighlightLink>lighter, smarter, and more focused</HighlightLink> editing experience
      </SupportingTagline>
    ),
    zh: (
      <SupportingTagline>
        MarkFlowy 是一款 <HighlightLink>开源</HighlightLink> 的 Markdown 编辑器应用,
        致力于提供<HighlightLink>更轻巧、更智能、更专注</HighlightLink> 的编辑体验
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
        <motion.div 
          style={{
            position: 'fixed',
            pointerEvents: 'none',
            inset: 0,
            zIndex: 1000,
          }}
          animate={{ 
            background: `radial-gradient(400px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(255,255,255,0.1), transparent 40%)` 
          }} 
          transition={{ type: "spring", damping: 30, stiffness: 200 }} 
        />
        <Content $hero style={{ minHeight: '0' }}>
          <Title>
            <Tagline>{t('home.hero.subtitle')}</Tagline>
            {localesDescMap[(i18n?.language as keyof typeof localesDescMap) || 'en']}
          </Title>

          <Links>
            <Button
              $primary
              href='https://download.upgrade.toolsetlink.com/download?appKey=xpn68m4j5qU0Y1rfDYFHaA'
              target='_blank'
              rel='noopener'
            >
              {t('home.hero.download')}
            </Button>

            <Button href={`${i18n?.language ? `/${i18n.language}` : ''}/playground`}>
              {t('playground.title')}
            </Button>
          </Links>

          <SupportPlatforms />
        </Content>
        <Hr />
        <Feature />
        <Hr />
        <ContributorsSection>
          <ContributorsTitle>{t('home.contributors.title')}</ContributorsTitle>
          <ContributorsDescription>{t('home.contributors.description')}</ContributorsDescription>
          <ContribGrid>
            {contributors.map((c) => (
              <ContribItem key={c.id} href={c.html_url} target='_blank' rel='noopener noreferrer'>
                <Avatar src={c.avatar_url} alt={c.login} />
                <ContribInfo>
                  <Name>{c.login}</Name>
                </ContribInfo>
              </ContribItem>
            ))}
          </ContribGrid>
        </ContributorsSection>
      </Wrapper>
      <Footer />
    </>
  )
}

const Tagline = styled.h1`
  font-size: 3rem;
  line-height: 1.1;
  margin: 0 0 0.5em;

  @media screen and (max-width: 800px) {
    font-size: 3rem;
  }
`

const SupportingTagline = styled.p`
  font-size: 1.1rem;
  margin: 0;
  font-weight: 400;

  @media screen and (max-width: 800px) {
    font-size: 1rem;
  }
`

const Hr = styled.hr`
  width: 100%;
  height: 1px;
  border: 0;
  background-color: ${(props) => props.theme.borderColor};
  margin: 2rem 0;
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
  width: 10rem;

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
  margin: 3rem 0 1.6rem 0;

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

const ContributorsSection = styled.section`
  width: 100%;
  max-width: 1100px;
  padding: 2rem 1rem 3rem;
  box-sizing: border-box;
`

const ContributorsTitle = styled.h2`
  font-size: 1.75rem;
  font-weight: 700;
  margin: 1rem 0 1.5rem;
`
const ContributorsDescription = styled.p`
  font-size: 1.2rem;
  margin: 0;
  font-weight: 400;
`

const ContribGrid = styled.div`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: center;
  margin-top: 2rem;
`

const ContribItem = styled.a`
  margin: 0.5rem;
  padding: 0.75rem;
  display: flex;
  flex-direction: row;
  align-items: center;
  position: relative;
  border-radius: 10px;
  color: ${(props) => props.theme.primaryFontColor};
  text-decoration: none !important;
  border: 1px solid ${(props) => props.theme.borderColor};
  transition: 0.5s;

  &:hover {
    border: 1px solid ${(props) => props.theme.borderColorFocused};
  }
`

const Avatar = styled.img`
  display: inline-flex;
  width: 44px;
  height: 44px;
  border-radius: 50%;
`

const ContribInfo = styled.div`
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  text-decoration: none !important;
  text-align: left;
  margin-left: 1rem;
  color: ${(props) => props.theme.primaryFontColor};
`

const Name = styled.span`
  font-size: 1rem;
  font-weight: bold;
  word-break: break-word;
`

const BOTS_ID = [49699333, 29139614, 41898282, 29791463]

export const getStaticProps: GetStaticProps = async ({ locale }) => {
  // Fetch contributors from GitHub at build time
  let contributors: Contributor[] = []
  try {
    const res = await fetch('https://api.github.com/repos/drl990114/MarkFlowy/contributors')
    if (res.ok) {
      const data = await res.json()
      contributors = (Array.isArray(data) ? data : [])
        .map((c: any) => ({
          id: c.id,
          login: c.login,
          avatar_url: c.avatar_url,
          html_url: c.html_url,
        }))
        .filter((c) => !BOTS_ID.includes(c.id)) // filter out bots
    }
  } catch (_) {
    // Ignore fetch errors and fall back to empty list
  }
  return {
    props: {
      ...(await serverSideTranslations(locale || 'en', ['common'])),
      contributors,
    },
  }
}
