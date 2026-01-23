import FeatureList from 'components/FeatureList'
import { GetStaticProps } from 'next'
import { i18n, useTranslation } from 'next-i18next'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import React from 'react'
import styled, { css } from 'styled-components'
import Nav from '../components/HomeNav'
import { HoverBorderGradient } from '../components/HoverBorderGradient'
import SeoHead from '../components/SeoHead'
import { useMockFiles } from '../hooks/useMockFiles'
import { mobile } from '../utils/media'
import rem from '../utils/rem'

type Contributor = {
  id: number
  login: string
  avatar_url: string
  html_url: string
}

const Editor = dynamic(() => import('../components/Editor'), {
  ssr: false,
  loading: () => <EditorLoading>Loading Editor...</EditorLoading>,
})

export default function Index({
  contributors = [] as Contributor[],
}: {
  contributors?: Contributor[]
}) {
  const { t } = useTranslation()
  const [isMobileNavFolded, setIsMobileNavFolded] = React.useState(true)
  const [activeTab, setActiveTab] = React.useState<'markdown' | 'json'>('markdown')
  const { markdownContent, jsonContent } = useMockFiles()

  return (
    <>
      <SeoHead title='MarkFlowy'>
        <meta name='robots' content='noodp' />
      </SeoHead>

      <MarketingLayout>
        <HeaderWrapper>
          <Nav
            showSideNav={false}
            isMobileNavFolded={isMobileNavFolded}
            onMobileNavToggle={() => setIsMobileNavFolded((x) => !x)}
          />
        </HeaderWrapper>

        <MainContent>
          {/* Hero Section */}
          <HeroSection>
            <HeroContent>
              <HeroTitle>
                <TitleLine>{t('home.hero.subtitle')}</TitleLine>
              </HeroTitle>

              <HeroActions>
                <HoverBorderGradient
                  onClick={() => {
                    window.open(
                      'https://download.upgrade.toolsetlink.com/download?appKey=xpn68m4j5qU0Y1rfDYFHaA',
                    )
                  }}
                >
                  <DownloadIcon />
                  <span>{t('home.hero.download')}</span>
                </HoverBorderGradient>
              </HeroActions>
            </HeroContent>
          </HeroSection>

          <ProductSection>
            <BgImageContainer>
              <BgImage></BgImage>
            </BgImageContainer>
            <MacContainer>
              <MacTitleBar>
                <MacButtons>
                  <MacButton red={true} />
                  <MacButton yellow={true} />
                  <MacButton green={true} />
                </MacButtons>
                <MacTitle>MarkFlowy</MacTitle>
              </MacTitleBar>
              <EditorTabs>
                <EditorTab
                  $active={activeTab === 'markdown'}
                  onClick={() => setActiveTab('markdown')}
                >
                  intro.md
                </EditorTab>
                <EditorTab $active={activeTab === 'json'} onClick={() => setActiveTab('json')}>
                  about.json
                </EditorTab>
              </EditorTabs>
              <EditorWrapper $visible={activeTab === 'markdown'}>
                <Editor
                  key={`${i18n?.language}_wysiwyg`}
                  viewType='wysiwyg'
                  initialContent={markdownContent}
                />
              </EditorWrapper>
              <EditorWrapper $visible={activeTab === 'json'}>
                <Editor
                  key={`${i18n?.language}_source_code`}
                  viewType='source_code'
                  initialContent={jsonContent}
                />
              </EditorWrapper>
            </MacContainer>
          </ProductSection>

          {/* Feature Grid */}
          <SectionWrapper>
            <FeatureList />
          </SectionWrapper>

          {/* Open Source Section */}
          <SectionWrapper>
            <ContributorsSection>
              <ContributorsTitle>{t('home.contributors.title')}</ContributorsTitle>
              <ContributorsDescription>
                {t('home.contributors.description')}
              </ContributorsDescription>
              <ContribGrid>
                {contributors.map((c) => (
                  <ContribItem
                    key={c.id}
                    href={c.html_url}
                    target='_blank'
                    rel='noopener noreferrer'
                  >
                    <Avatar src={c.avatar_url} alt={c.login} />
                    <ContribInfo>
                      <Name>{c.login}</Name>
                    </ContribInfo>
                  </ContribItem>
                ))}
              </ContribGrid>
            </ContributorsSection>
          </SectionWrapper>
        </MainContent>

        {/* Footer */}
        <Footer>
          <FooterContent>
            <FooterLogoContainer>
              <FooterLogo src='/logo.svg' alt='MarkFlowy' />
              <FooterAppName>MarkFlowy</FooterAppName>
            </FooterLogoContainer>
            <FooterLinksRow>
              <FooterLinkItem href='https://github.com/drl990114/MarkFlowy' target='_blank'>
                GitHub
              </FooterLinkItem>
              <FooterLinkItem href='/docs'>Documentation</FooterLinkItem>
              <FooterLinkItem
                href='https://github.com/drl990114/MarkFlowy/releases'
                target='_blank'
              >
                Releases
              </FooterLinkItem>
            </FooterLinksRow>
            <FooterCopyright>
              ©2023 - present <Link href='https://github.com/drl990114'>drl990114</Link>. All
              Rights Reserved.
            </FooterCopyright>
          </FooterContent>
        </Footer>
      </MarketingLayout>
    </>
  )
}

const DownloadIcon = () => {
  return (
    <svg
      width='66'
      height='65'
      viewBox='0 0 66 65'
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
      style={{ width: rem(12), height: rem(12) }}
    >
      <path
        d='M8 8.05571C8 8.05571 54.9009 18.1782 57.8687 30.062C60.8365 41.9458 9.05432 57.4696 9.05432 57.4696'
        stroke='currentColor'
        strokeWidth='15'
        strokeMiterlimit='3.86874'
        strokeLinecap='round'
      />
    </svg>
  )
}

// Layout
const MarketingLayout = styled.div`
  background: ${(props) => props.theme.bgColor};
  color: ${(props) => props.theme.primaryFontColor};
  font-family: ${(props) => props.theme.fontFamily};
  min-height: 100vh;
  width: 100%;
  position: relative;
`

const HeaderWrapper = styled.div`
  position: relative;
`

const MainContent = styled.div`
  width: 100%;
  max-width: 1300px;
  margin: 0 auto;
  padding: ${rem(40)} ${rem(30)};
  min-height: 100vh;

  ${mobile(css`
    padding: 0 ${rem(20)};
  `)}
`

const MacContainer = styled.div`
  width: min(80%, 1000px);
  height: 600px;
  background: #14120b;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  overflow: hidden;
  margin: 0 auto;
  z-index: 1;

  ${mobile(css`
    width: 90%;
    height: 400px;
  `)}
`

const MacTitleBar = styled.div`
  position: relative;
  height: 36px;
  background: #1e1e1e;
  display: flex;
  align-items: center;
  padding: 0 12px;
  border-bottom: 1px solid #2a2822;
`

const MacButtons = styled.div`
  position: absolute;
  left: 12px;
  display: flex;
  gap: 8px;
  z-index: 2;
`

const MacButton = styled.button<{ red?: boolean; yellow?: boolean; green?: boolean }>`
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: none;
  cursor: pointer;

  ${(props) =>
    props.red &&
    css`
      background: #ff5f57;
    `}

  ${(props) =>
    props.yellow &&
    css`
      background: #ffbd2e;
    `}
  
  ${(props) =>
    props.green &&
    css`
      background: #28c840;
    `}
`

const MacTitle = styled.div`
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell,
    sans-serif;
  font-size: 13px;
  color: #abaaa8;
  font-weight: 500;
`

const EditorTabs = styled.div`
  display: flex;
  background: #1e1e1e;
  border-bottom: 1px solid #2a2822;
  height: 36px;
`

const EditorTab = styled.div<{ $active: boolean }>`
  font-size: 12px;
  color: ${(props) => (props.$active ? '#ffffff' : '#969696')};
  cursor: pointer;
  padding: 0 20px;
  background: ${(props) => (props.$active ? '#14120b' : 'transparent')};
  border-right: 1px solid #2a2822;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  position: relative;

  ${(props) =>
    props.$active &&
    css`
      &::after {
        content: '';
        position: absolute;
        bottom: -1px;
        left: 0;
        right: 0;
        height: 1px;
        background: #14120b;
      }
    `}

  &:hover {
    color: #ffffff;
    ${(props) => !props.$active && 'background: rgba(255, 255, 255, 0.03);'}
  }
`

const EditorWrapper = styled.div<{ $visible: boolean }>`
  display: ${(props) => (props.$visible ? 'block' : 'none')};
  height: calc(100% - 72px); // 36px titlebar + 36px tabs
`

const EditorLoading = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  width: 100%;
  background: #14120b;
  color: #abaaa8;
  font-size: 13px;
  gap: 12px;

  &::before {
    content: '';
    width: 24px;
    height: 24px;
    border: 2px solid rgba(171, 170, 168, 0.2);
    border-top-color: #abaaa8;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`

// Hero Section
const HeroSection = styled.section`
  position: relative;
  padding: ${rem(60)} ${rem(40)} ${rem(60)} 0;
  width: min(${(props) => props.theme.homeMaxWidth}, calc(100% - ${rem(20)}));
  display: flex;
  flex-direction: column;
  gap: ${rem(24)};

  ${mobile(css`
    padding: ${rem(50)} ${rem(20)} ${rem(30)} 0;
  `)}
`

const HeroContent = styled.div`
  width: 100%;
  max-width: 1200px;
  margin: 0;
  display: flex;
  flex-direction: column;
  text-align: left;
`

const HeroTitle = styled.h1`
  font-size: ${rem(26)};
  font-weight: 400;
  line-height: 1.25;
  letter-spacing: 0.02em;
  margin: 0;
  text-align: left;

  ${mobile(css`
    font-size: ${rem(22)};
    letter-spacing: 0.03em;
  `)}
`

const TitleLine = styled.span`
  display: block;
  white-space: pre-wrap;
`

const HeroActions = styled.div`
  display: flex;
  gap: ${rem(16)};
  flex-wrap: wrap;
  margin-top: ${rem(12)};
`

// Product Section
const SectionWrapper = styled.div``

const BgImageContainer = styled.div`
  position: absolute;
  top: 0;
  left: 50%;
  width: 100%;
  height: 100%;
  transform: translateX(-50%);
  overflow: hidden;

  ${mobile(css`
    padding: 0;
  `)}
`

const BgImage = styled.div`
  max-width: ${(props) => props.theme.homeMaxWidth};
  height: 100%;
  background-image: url('./bg.png');
  background-repeat: no-repeat;
  background-position: center center;
  background-size: cover;
  box-sizing: border-box;
  border-radius: 6px;

  @media (max-width: 768px) {
    min-height: 440px;
    height: min(500px, 60vh);
  }
`

const ProductSection = styled.section`
  position: relative;
  width: 100%;
  height: min(780px, 70vh);
  min-height: 680px;
  margin: 0 auto;
  display: flex;
  justify-content: center;
  align-items: center;

  ${mobile(css`
    padding: rem(10);
    min-height: 440px;
    height: min(500px, 60vh);
  `)}
`

const ContributorsSection = styled.section`
  width: 100%;
  max-width: ${rem(1200)};
  margin: 0 auto;
  padding: ${rem(100)} ${rem(24)};
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;

  ${mobile(css`
    padding: ${rem(60)} ${rem(20)};
  `)}
`

const ContributorsTitle = styled.h2`
  font-size: ${rem(40)};
  font-weight: 700;
  line-height: 1.2;
  color: #ffffff;
  margin-bottom: ${rem(16)};

  ${mobile(css`
    font-size: ${rem(32)};
  `)}
`

const ContributorsDescription = styled.p`
  font-size: ${rem(18)};
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.6);
  max-width: ${rem(600)};
  margin: 0 auto ${rem(48)};

  ${mobile(css`
    font-size: ${rem(16)};
    margin-bottom: ${rem(32)};
  `)}
`

const ContribGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(${rem(160)}, 1fr));
  gap: ${rem(20)};
  width: 100%;

  ${mobile(css`
    grid-template-columns: repeat(auto-fill, minmax(${rem(140)}, 1fr));
    gap: ${rem(12)};
  `)}
`

const ContribItem = styled.a`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: ${rem(20)};
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: ${rem(12)};
  text-decoration: none;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: #ff8c00;
    transform: translateY(-4px);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  }
`

const Avatar = styled.img`
  width: ${rem(64)};
  height: ${rem(64)};
  border-radius: 50%;
  margin-bottom: ${rem(12)};
  border: 2px solid transparent;
  transition: border-color 0.3s ease;

  ${ContribItem}:hover & {
    border-color: #ff8c00;
  }
`

const ContribInfo = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
`

const Name = styled.span`
  font-size: ${rem(14)};
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
  transition: color 0.3s ease;

  ${ContribItem}:hover & {
    color: #ffffff;
  }
`

// Footer
const Footer = styled.footer`
  width: 100%;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  padding: ${rem(80)} 0 ${rem(40)};
  background: ${(props) => props.theme.bgColorSecondary};
`

const FooterContent = styled.div`
  max-width: ${rem(1200)};
  margin: 0 auto;
  padding: 0 ${rem(24)};
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
`

const FooterLogoContainer = styled.div`
  display: flex;
  align-items: center;
  gap: ${rem(12)};
  margin-bottom: ${rem(24)};
`

const FooterLogo = styled.img`
  width: ${rem(32)};
  height: ${rem(32)};
`

const FooterAppName = styled.span`
  font-size: ${rem(20)};
  font-weight: 600;
  color: #ffffff;
  letter-spacing: -0.02em;
`

const FooterLinksRow = styled.div`
  display: flex;
  gap: ${rem(32)};
  margin-bottom: ${rem(40)};

  ${mobile(css`
    gap: ${rem(20)};
    flex-wrap: wrap;
    justify-content: center;
  `)}
`

const FooterLinkItem = styled.a`
  font-size: ${rem(14)};
  color: rgba(255, 255, 255, 0.5);
  text-decoration: none;
  transition: color 0.2s ease;

  &:hover {
    color: #ff8c00;
  }
`

const FooterCopyright = styled.p`
  font-size: ${rem(13)};
  color: rgba(255, 255, 255, 0.3);
  margin: 0;
`

const BOTS_ID = [49699333, 29139614, 41898282, 29791463]

export const getStaticProps: GetStaticProps = async ({ locale }) => {
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
        .filter((c) => !BOTS_ID.includes(c.id))
    }
  } catch (_) {
    // Ignore fetch errors
  }
  return {
    props: {
      ...(await serverSideTranslations(locale || 'en', ['common'])),
      contributors,
    },
  }
}
