import FeatureList from 'components/FeatureList'
import { motion, useReducedMotion } from 'motion/react'
import type { GetStaticProps } from 'next'
import { i18n, useTranslation } from 'next-i18next'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import React from 'react'
import styled, { css, keyframes } from 'styled-components'
import ContributorGlobe from '../components/ContributorGlobe'
import Nav from '../components/HomeNav'
import { HoverBorderGradient } from '../components/HoverBorderGradient'
import SeoHead from '../components/SeoHead'
import { useRedirectIfAuthenticated } from '../hooks/useAuth'
import { useMockFiles } from '../hooks/useMockFiles'
import { useSystemType } from '../hooks/useSystemType'
import { mobile, phone } from '../utils/media'
import rem from '../utils/rem'

type Contributor = {
  id: number
  login: string
  avatar_url: string
  html_url: string
}

const Editor = dynamic(() => import('../components/Editor').then((mod) => mod.default), {
  ssr: false,
  loading: () => <EditorLoading />,
})

const HomeEditorPreview = dynamic(() => Promise.resolve(HomeEditorPreviewContent), {
  ssr: false,
  loading: () => (
    <MacWindow>
      <EditorLoading />
    </MacWindow>
  ),
})

const WIRE_ITEMS_ROW_A = [
  'Markdown',
  'WYSIWYG',
  'AI Copilot',
  'Source Code',
  'Themes',
  'Hotkeys',
  'Tauri',
  'Cross-Platform',
  'File Manager',
  'JSON',
  'Custom Themes',
  'Base64',
  'Search',
  'Multilingual',
]

const WIRE_ITEMS_ROW_B = [
  'Lightweight',
  'Dark Mode',
  'Extensions',
  'Ollama',
  'ChatGPT',
  'DeepSeek',
  'Translation',
  'Summary',
  'Shortcuts',
  'Tree View',
  'Smart Images',
  'TXT',
  'Code Blocks',
  'Syntax Highlight',
]

const createWireLoop = (items: string[]) =>
  ['first', 'second'].flatMap((loop) => items.map((label) => ({ key: `${loop}-${label}`, label })))

const WIRE_LOOP_ROW_A = createWireLoop(WIRE_ITEMS_ROW_A)
const WIRE_LOOP_ROW_B = createWireLoop(WIRE_ITEMS_ROW_B)

export default function Index({
  contributors = [] as Contributor[],
}: {
  contributors?: Contributor[]
}) {
  const checkingAuth = useRedirectIfAuthenticated()
  const { t } = useTranslation()
  const [isMobileNavFolded, setIsMobileNavFolded] = React.useState(true)
  const systemType = useSystemType()
  const shouldReduceMotion = useReducedMotion()
  const handleMobileNavToggle = React.useCallback(
    () => setIsMobileNavFolded((isFolded) => !isFolded),
    [],
  )

  if (checkingAuth) {
    return (
      <LoadingContainer>
        <LoadingSpinner />
      </LoadingContainer>
    )
  }

  const renderSystemIcon = () => {
    switch (systemType) {
      case 'windows':
        return <i className='ri-windows-fill' style={{ marginRight: '8px' }}></i>
      case 'macos':
        return <i className='ri-apple-fill' style={{ marginRight: '8px' }}></i>
      case 'linux':
        return <i className='ri-ubuntu-fill' style={{ marginRight: '8px' }}></i>
      default:
        return <DownloadIcon style={{ marginRight: '8px' }} />
    }
  }

  return (
    <>
      <SeoHead title='MarkFlowy'>
        <meta name='robots' content='noodp' />
      </SeoHead>

      <PageLayout>
        <Nav
          showSideNav={false}
          isMobileNavFolded={isMobileNavFolded}
          onMobileNavToggle={handleMobileNavToggle}
        />

        <HeroSection>
          <HeroGrid>
            <HeroLeft
              initial={shouldReduceMotion ? false : { opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: shouldReduceMotion ? 0 : 0.7,
                ease: [0.22, 0.61, 0.36, 1],
              }}
            >
              <motion.div
                whileInView={{ opacity: 1, y: 0 }}
                initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
                viewport={{ once: true }}
                transition={{
                  duration: shouldReduceMotion ? 0 : 0.6,
                  delay: shouldReduceMotion ? 0 : 0.05,
                  ease: [0.22, 0.61, 0.36, 1],
                }}
              >
                <HeroTitle>
                  <TitleMain>Mark</TitleMain>
                  <FlowyText />
                  <TitleDot aria-hidden='true' />
                </HeroTitle>
              </motion.div>
              <motion.div
                whileInView={{ opacity: 1, y: 0 }}
                initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
                viewport={{ once: true }}
                transition={{
                  duration: shouldReduceMotion ? 0 : 0.6,
                  delay: shouldReduceMotion ? 0 : 0.1,
                  ease: [0.22, 0.61, 0.36, 1],
                }}
              >
                <HeroLead>{t('home.hero.subtitle')}</HeroLead>
              </motion.div>
              <motion.div
                whileInView={{ opacity: 1, y: 0 }}
                initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
                viewport={{ once: true }}
                transition={{
                  duration: shouldReduceMotion ? 0 : 0.6,
                  delay: shouldReduceMotion ? 0 : 0.15,
                  ease: [0.22, 0.61, 0.36, 1],
                }}
              >
                <HeroActions>
                  <HoverBorderGradient
                    onClick={() => {
                      window.open('https://github.com/drl990114/MarkFlowy/releases')
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center' }}>
                      {renderSystemIcon()}
                      {t('home.hero.download')}
                    </span>
                  </HoverBorderGradient>
                  <GhostButton href='https://github.com/drl990114/MarkFlowy' target='_blank'>
                    <i className='ri-github-fill' style={{ marginRight: '8px' }}></i>
                    GitHub
                  </GhostButton>
                </HeroActions>
              </motion.div>
              <motion.div
                whileInView={{ opacity: 1, y: 0 }}
                initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
                viewport={{ once: true }}
                transition={{
                  duration: shouldReduceMotion ? 0 : 0.6,
                  delay: shouldReduceMotion ? 0 : 0.2,
                  ease: [0.22, 0.61, 0.36, 1],
                }}
              >
                <StatRings>
                  <StatRing $percent={85}>
                    <RingBg />
                    <RingFill $percent={85} />
                    <RingNumber>10K+</RingNumber>
                    <RingLabel>{t('home.statRings.users')}</RingLabel>
                  </StatRing>
                  <StatRing $percent={72}>
                    <RingBg />
                    <RingFill $percent={72} />
                    <RingNumber>3</RingNumber>
                    <RingLabel>{t('home.statRings.years')}</RingLabel>
                  </StatRing>
                  <StatRing $percent={60}>
                    <RingBg />
                    <RingFill $percent={60} />
                    <RingNumber>2K+</RingNumber>
                    <RingLabel>{t('home.statRings.githubStars')}</RingLabel>
                  </StatRing>
                </StatRings>
              </motion.div>
            </HeroLeft>

            <HeroRight
              initial={shouldReduceMotion ? false : { opacity: 0, y: 30, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{
                duration: shouldReduceMotion ? 0 : 0.8,
                delay: shouldReduceMotion ? 0 : 0.15,
                ease: [0.22, 0.61, 0.36, 1],
              }}
            >
              <HomeEditorPreview />
            </HeroRight>
          </HeroGrid>
        </HeroSection>

        <WireSection>
          <WireTrack>
            <WireRowA>
              <WireScrollA>
                {WIRE_LOOP_ROW_A.map((item) => (
                  <React.Fragment key={item.key}>
                    <WireItem>{item.label}</WireItem>
                    <WireDot />
                  </React.Fragment>
                ))}
              </WireScrollA>
            </WireRowA>
            <WireRowB>
              <WireScrollB>
                {WIRE_LOOP_ROW_B.map((item) => (
                  <React.Fragment key={item.key}>
                    <WireItem>{item.label}</WireItem>
                    <WireDot />
                  </React.Fragment>
                ))}
              </WireScrollB>
            </WireRowB>
          </WireTrack>
        </WireSection>

        <SectionWrapper>
          <FeatureList />
        </SectionWrapper>

        {contributors.length > 0 && (
          <ContributorsSection aria-labelledby='contributors-heading'>
            <ContribLayout>
              <ContribCopy>
                <ContribMeta>
                  <ContribMetaDot />
                  {t('home.contributors.count', {
                    count: Math.min(contributors.length, 16),
                  })}
                </ContribMeta>
                <ContribTitle id='contributors-heading'>
                  {t('home.contributors.titleLead')}{' '}
                  <ContribItalic>{t('home.contributors.titleAccent')}</ContribItalic>
                </ContribTitle>
                <ContribDesc>{t('home.contributors.description')}</ContribDesc>
                <ContribLink
                  href='https://github.com/drl990114/MarkFlowy/graphs/contributors'
                  target='_blank'
                  rel='noopener noreferrer'
                >
                  {t('home.contributors.viewAll')}
                  <span aria-hidden='true'>↗</span>
                </ContribLink>
              </ContribCopy>

              <ContributorGlobe contributors={contributors} />
            </ContribLayout>
          </ContributorsSection>
        )}

        <CTASection>
          <CTAInner>
            <CTALabel>
              <CTALabelLine />
              III &middot; GET STARTED
            </CTALabel>
            <CTATitle>
              Start <CTAItalic>Writing</CTAItalic> Today
            </CTATitle>
            <CTADesc>{t('home.hero.subtitle')}</CTADesc>
            <CTAButton
              onClick={() => {
                window.open('https://github.com/drl990114/MarkFlowy/releases')
              }}
            >
              {t('home.hero.download')}
            </CTAButton>
          </CTAInner>
        </CTASection>

        <Footer>
          <FooterInner>
            <FooterTop>
              <FooterBrand>
                <FooterLogo src='/logo.svg' alt='MarkFlowy' />
                <FooterAppName>MarkFlowy</FooterAppName>
                <FooterTagline>Next-generation professional editor driven by AI.</FooterTagline>
              </FooterBrand>
              <FooterColumns>
                <FooterCol>
                  <FooterColTitle>Product</FooterColTitle>
                  <FooterLink
                    href='https://github.com/drl990114/MarkFlowy/releases'
                    target='_blank'
                  >
                    Releases
                  </FooterLink>
                  <FooterLink href='/docs'>Documentation</FooterLink>
                  <FooterLink href='/playground'>{t('playground.title')}</FooterLink>
                </FooterCol>
                <FooterCol>
                  <FooterColTitle>Community</FooterColTitle>
                  <FooterLink href='https://github.com/drl990114/MarkFlowy' target='_blank'>
                    GitHub
                  </FooterLink>
                  <FooterLink href='https://github.com/drl990114/MarkFlowy/issues' target='_blank'>
                    Issues
                  </FooterLink>
                  <FooterLink href='https://github.com/drl990114/MarkFlowy/pulls' target='_blank'>
                    Pull Requests
                  </FooterLink>
                </FooterCol>
                <FooterCol>
                  <FooterColTitle>Legal</FooterColTitle>
                  <FooterLink href='/privacy'>Privacy Policy</FooterLink>
                  <FooterLink href='/docs'>{t('common.docs')}</FooterLink>
                </FooterCol>
                <FooterCol>
                  <FooterColTitle>Resources</FooterColTitle>
                  <FooterLink
                    href='https://github.com/drl990114/MarkFlowy/blob/main/CONTRIBUTING.md'
                    target='_blank'
                  >
                    Contributing
                  </FooterLink>
                  <FooterLink
                    href='https://github.com/drl990114/MarkFlowy/blob/main/CODE_OF_CONDUCT.md'
                    target='_blank'
                  >
                    Code of Conduct
                  </FooterLink>
                  <FooterLink
                    href='https://github.com/drl990114/MarkFlowy/blob/main/LICENSE'
                    target='_blank'
                  >
                    License
                  </FooterLink>
                </FooterCol>
              </FooterColumns>
            </FooterTop>
            <FooterDivider />
            <FooterBottom>
              <FooterCopyright>
                &copy;2023 &ndash; present{' '}
                <Link href='https://github.com/drl990114'>drl990114</Link>. All Rights Reserved.
              </FooterCopyright>
              <FooterKicker>Flow</FooterKicker>
            </FooterBottom>
          </FooterInner>
        </Footer>
      </PageLayout>
    </>
  )
}

function HomeEditorPreviewContent() {
  const [activeTab, setActiveTab] = React.useState<'wysiwyg' | 'source'>('wysiwyg')
  const { markdownContent, jsonContent } = useMockFiles()

  return (
    <MacWindow>
      <MacTitleBar>
        <MacButtons aria-hidden='true'>
          <MacButton $red />
          <MacButton $yellow />
          <MacButton $green />
        </MacButtons>
        <MacTitle>MarkFlowy</MacTitle>
      </MacTitleBar>
      <EditorTabs role='tablist' aria-label='Editor preview files'>
        <EditorTab
          $active={activeTab === 'wysiwyg'}
          role='tab'
          aria-selected={activeTab === 'wysiwyg'}
          aria-controls='home-markdown-preview'
          onClick={() => setActiveTab('wysiwyg')}
        >
          README.md
        </EditorTab>
        <EditorTab
          $active={activeTab === 'source'}
          role='tab'
          aria-selected={activeTab === 'source'}
          aria-controls='home-source-preview'
          onClick={() => setActiveTab('source')}
        >
          config.json
        </EditorTab>
      </EditorTabs>
      <EditorWrapper id='home-markdown-preview' role='tabpanel' $visible={activeTab === 'wysiwyg'}>
        <Editor
          fileId='home-markdown'
          key={`${i18n?.language}_wysiwyg`}
          viewType='wysiwyg'
          initialContent={markdownContent}
        />
      </EditorWrapper>
      <SourceEditorWrapper
        id='home-source-preview'
        role='tabpanel'
        $visible={activeTab === 'source'}
      >
        <Editor
          fileId='home-json'
          key={`${i18n?.language}_source_code`}
          viewType='source_code'
          initialContent={jsonContent}
        />
      </SourceEditorWrapper>
    </MacWindow>
  )
}

const DownloadIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox='0 0 24 24'
    width='1.2em'
    height='1.2em'
    fill='none'
    stroke='currentColor'
    strokeWidth='2'
    strokeLinecap='round'
    strokeLinejoin='round'
    {...props}
  >
    <path d='M21 15v-4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' />
    <polyline points='7 10 12 15 17 10' />
    <line x1='12' y1='15' x2='12' y2='3' />
  </svg>
)

const PageLayout = styled.div`
  background: var(--paper);
  color: var(--ink);
  font-family: var(--body);
  min-height: 100vh;
  width: 100%;
  position: relative;
  overflow-x: hidden;
  overflow-x: clip;
`

const HeroSection = styled.section`
  width: 100%;
  box-sizing: border-box;
  max-width: ${rem(1200)};
  margin: 0 auto;
  padding: calc(clamp(${rem(112)}, 10vw, ${rem(140)}) + env(safe-area-inset-top))
    clamp(${rem(16)}, 4vw, ${rem(24)}) clamp(${rem(56)}, 7vw, ${rem(80)});
  min-height: 90vh;
  display: flex;
  align-items: center;

  ${mobile(css`
    padding-top: calc(${rem(96)} + env(safe-area-inset-top));
    padding-bottom: ${rem(48)};
    min-height: auto;
  `)}

  ${phone(css`
    padding-left: ${rem(20)};
    padding-right: ${rem(20)};
  `)}
`

const HeroGrid = styled.div`
  width: 100%;
  min-width: 0;
  display: grid;
  grid-template-columns: 0.78fr 1.22fr;
  gap: ${rem(60)};
  align-items: center;

  ${mobile(css`
    grid-template-columns: 1fr;
    gap: ${rem(40)};
  `)}
`

const HeroLeft = styled(motion.div)`
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: clamp(${rem(20)}, 3vw, ${rem(28)});
`

const HeroTitle = styled.h1`
  font-family: var(--sans);
  font-size: clamp(${rem(42)}, 5.5vw, ${rem(72)});
  font-weight: 600;
  line-height: 1;
  letter-spacing: -0.03em;
  color: var(--ink);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0;
  max-width: 100%;

  ${phone(css`
    font-size: clamp(${rem(36)}, 13vw, ${rem(48)});
  `)}
`

const TitleMain = styled.span`
  display: inline-flex;
  align-items: center;
  line-height: 1;
`

const FlowyMark = styled(motion.span)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 1em;
  line-height: 1;
  transform: translateY(${rem(4)});
  flex-shrink: 0;
`

const FlowySvg = styled(motion.svg)`
  display: block;
  width: auto;
  height: calc(1.04em + 4px);
  overflow: visible;
`

const TitleDot = styled.span`
  display: inline-block;
  width: ${rem(14)};
  height: ${rem(14)};
  border-radius: 50%;
  background: var(--seal);
  box-shadow: 0 0 12px rgba(212, 86, 74, 0.4);
  margin-left: ${rem(6)};
  flex-shrink: 0;
  align-self: center;
`

const HeroLead = styled.p`
  font-family: var(--body);
  font-size: clamp(${rem(15)}, 1.8vw, ${rem(18)});
  line-height: 1.75;
  color: var(--ink-soft);
  margin: 0;
  max-width: ${rem(460)};
  white-space: pre-line;
  padding-left: ${rem(16)};
  border-left: 2px solid var(--line-soft);
`

const HeroActions = styled.div`
  display: flex;
  gap: ${rem(16)};
  flex-wrap: wrap;
  align-items: center;

  @media (max-width: 26.25em) {
    display: grid;
    grid-template-columns: 1fr;
    width: 100%;
  }
`

const GhostButton = styled.a`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: ${rem(8)} ${rem(24)};
  border: 1px solid var(--line);
  border-radius: 9999px;
  font-family: var(--sans);
  font-size: ${rem(14)};
  font-weight: 600;
  color: var(--ink);
  text-decoration: none;
  background: transparent;
  cursor: pointer;
  transition:
    border-color 0.25s ease,
    color 0.25s ease,
    background 0.25s ease,
    transform 0.18s cubic-bezier(0.23, 1, 0.32, 1);

  &:focus-visible {
    outline: 2px solid var(--seal);
    outline-offset: 2px;
  }

  &:active {
    transform: scale(0.98);
  }

  @media (hover: hover) and (pointer: fine) {
    &:hover {
      border-color: var(--seal);
      color: var(--seal);
      background: rgba(212, 86, 74, 0.08);
    }
  }

  @media (max-width: 26.25em) {
    width: 100%;
    box-sizing: border-box;
  }
`

const StatRings = styled.div`
  display: flex;
  gap: clamp(${rem(8)}, 3vw, ${rem(32)});
  margin-top: ${rem(8)};
  max-width: 100%;

  ${mobile(css`
    width: min(100%, ${rem(320)});
    justify-content: space-between;
  `)}
`

const StatRing = styled.div<{ $percent: number }>`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${rem(6)};
  width: ${rem(80)};
  height: ${rem(96)};
`

const RingBg = styled.div`
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: ${rem(80)};
  height: ${rem(80)};
  border-radius: 50%;
  background: var(--line-soft);
  mask: radial-gradient(farthest-side, transparent calc(100% - 3px), black calc(100% - 3px));
  -webkit-mask: radial-gradient(
    farthest-side,
    transparent calc(100% - 3px),
    black calc(100% - 3px)
  );
`

const RingFill = styled.div<{ $percent: number }>`
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: ${rem(80)};
  height: ${rem(80)};
  border-radius: 50%;
  background: conic-gradient(var(--seal) ${(p) => p.$percent}%, transparent ${(p) => p.$percent}%);
  mask: radial-gradient(farthest-side, transparent calc(100% - 3px), black calc(100% - 3px));
  -webkit-mask: radial-gradient(
    farthest-side,
    transparent calc(100% - 3px),
    black calc(100% - 3px)
  );
`

const RingNumber = styled.span`
  font-family: 'Inter Tight', var(--sans);
  font-size: ${rem(28)};
  font-weight: 800;
  color: var(--ink);
  line-height: 1;
  padding-top: ${rem(18)};
  padding-bottom: ${rem(2)};
  z-index: 1;
  position: relative;
`

const RingLabel = styled.span`
  font-family: var(--sans);
  font-size: ${rem(11)};
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ink-mute);
  z-index: 1;
  position: relative;
`

const HeroRight = styled(motion.div)`
  display: flex;
  justify-content: center;
  min-width: 0;

  ${mobile(css`
    width: 100%;
  `)}
`

const MacWindow = styled.div`
  width: 100%;
  min-width: 0;
  height: clamp(${rem(440)}, 48vw, ${rem(540)});
  background: var(--paper-warm);
  border-radius: ${rem(12)};
  box-shadow:
    0 32px 80px -20px var(--shadow),
    0 0 0 1px var(--line-faint) inset;
  overflow: hidden;
  position: relative;

  ${mobile(css`
    height: clamp(${rem(360)}, 58vw, ${rem(440)});
  `)}

  ${phone(css`
    height: clamp(${rem(320)}, 105vw, ${rem(400)});
    border-radius: ${rem(8)};
    box-shadow:
      0 20px 48px -20px var(--shadow),
      0 0 0 1px var(--line-faint) inset;
  `)}
`

const MacTitleBar = styled.div`
  position: relative;
  height: ${rem(36)};
  background: var(--paper-deep);
  display: flex;
  align-items: center;
  padding: 0 ${rem(12)};
  border-bottom: 1px solid var(--line-faint);
`

const MacButtons = styled.div`
  position: absolute;
  left: ${rem(12)};
  display: flex;
  gap: ${rem(8)};
  z-index: 2;
`

const MacButton = styled.span<{ $red?: boolean; $yellow?: boolean; $green?: boolean }>`
  display: block;
  width: ${rem(12)};
  height: ${rem(12)};
  border-radius: 50%;

  ${(props) =>
    props.$red &&
    css`
      background: #ff5f57;
    `}
  ${(props) =>
    props.$yellow &&
    css`
      background: #ffbd2e;
    `}
  ${(props) =>
    props.$green &&
    css`
      background: #28c840;
    `}
`

const MacTitle = styled.div`
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  font-family: var(--sans);
  font-size: ${rem(13)};
  color: var(--ink-mute);
  font-weight: 500;
`

const EditorTabs = styled.div`
  display: flex;
  background: var(--paper-deep);
  border-bottom: 1px solid var(--line-faint);
  height: ${rem(36)};

  ${phone(css`
    height: 46px;
  `)}
`

const EditorTab = styled.button.attrs(() => ({
  type: 'button',
}))<{ $active: boolean }>`
  font-family: var(--sans);
  font-size: ${rem(12)};
  font-weight: 500;
  letter-spacing: -0.01em;
  color: ${(props) => (props.$active ? 'var(--ink)' : 'var(--ink-mute)')};
  cursor: pointer;
  padding: 0 ${rem(20)};
  background: ${(props) => (props.$active ? 'var(--paper-warm)' : 'transparent')};
  border: 0;
  border-right: 1px solid var(--line-faint);
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    color 0.2s,
    background 0.2s,
    border-color 0.2s;
  position: relative;

  ${(props) =>
    props.$active &&
    css`
      color: var(--ink);
      &::after {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 2px;
        background: var(--seal);
      }
    `}

  &:focus-visible {
    outline: 2px solid var(--seal);
    outline-offset: -2px;
    z-index: 1;
  }

  @media (hover: hover) and (pointer: fine) {
    &:hover {
      ${(props) => !props.$active && 'background: var(--line-faint); color: var(--ink-soft);'}
    }
  }
`

const EditorWrapper = styled.div<{ $visible: boolean }>`
  display: ${(props) => (props.$visible ? 'block' : 'none')};
  height: calc(100% - ${rem(72)});
  min-width: 0;
  position: relative;
  overflow: hidden;

  &::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: ${rem(48)};
    pointer-events: none;
    background: linear-gradient(to bottom, transparent, var(--paper-warm));
    z-index: 3;
  }

  ${phone(css`
    height: calc(100% - ${rem(36)} - 46px);
  `)}
`

const SourceEditorWrapper = styled.div<{ $visible: boolean }>`
  display: ${(props) => (props.$visible ? 'block' : 'none')};
  height: calc(100% - ${rem(72)});
  min-width: 0;
  position: relative;
  overflow: hidden;
  background: var(--paper-warm);
  font-family: var(--mono);

  &::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: ${rem(48)};
    pointer-events: none;
    background: linear-gradient(to bottom, transparent, var(--paper-warm));
    z-index: 3;
  }

  ${phone(css`
    height: calc(100% - ${rem(36)} - 46px);
  `)}
`

const shimmer = keyframes`
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`

const EditorLoading = styled.div`
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: flex-start;
  height: 100%;
  width: 100%;
  background: var(--paper-warm);
  padding: ${rem(20)};
  gap: ${rem(12)};
  overflow: hidden;

  .skel-toolbar {
    display: flex;
    gap: ${rem(8)};
    margin-bottom: ${rem(8)};
  }

  .skel-btn {
    width: ${rem(56)};
    height: ${rem(24)};
    border-radius: ${rem(4)};
    background: linear-gradient(
      90deg,
      rgba(232, 230, 227, 0.04) 25%,
      rgba(232, 230, 227, 0.08) 50%,
      rgba(232, 230, 227, 0.04) 75%
    );
    background-size: 200% 100%;
    animation: ${shimmer} 1.8s infinite linear;
  }

  .skel-line {
    height: ${rem(12)};
    border-radius: ${rem(3)};
    background: linear-gradient(
      90deg,
      rgba(232, 230, 227, 0.04) 25%,
      rgba(232, 230, 227, 0.08) 50%,
      rgba(232, 230, 227, 0.04) 75%
    );
    background-size: 200% 100%;
    animation: ${shimmer} 1.8s infinite linear;
  }

  .skel-heading {
    height: ${rem(20)};
    width: 45%;
    border-radius: ${rem(3)};
    background: linear-gradient(
      90deg,
      rgba(232, 230, 227, 0.04) 25%,
      rgba(232, 230, 227, 0.08) 50%,
      rgba(232, 230, 227, 0.04) 75%
    );
    background-size: 200% 100%;
    animation: ${shimmer} 1.8s infinite linear;
    margin-bottom: ${rem(8)};
  }

  .skel-body {
    display: flex;
    flex-direction: column;
    gap: ${rem(8)};
    flex: 1;
  }

  .skel-gutter {
    display: flex;
    flex-direction: column;
    gap: ${rem(8)};
    width: ${rem(32)};
    flex-shrink: 0;

    span {
      height: ${rem(12)};
      border-radius: ${rem(2)};
      background: linear-gradient(
        90deg,
        var(--line-faint) 25%,
        var(--line-soft) 50%,
        var(--line-faint) 75%
      );
      background-size: 200% 100%;
      animation: ${shimmer} 1.8s infinite linear;
      opacity: 0.4;
    }
  }

  .skel-code {
    display: flex;
    flex-direction: column;
    gap: ${rem(8)};
    flex: 1;
  }

  @media (prefers-reduced-motion: reduce) {
    .skel-btn,
    .skel-line,
    .skel-heading,
    .skel-gutter span {
      animation: none;
    }
  }
`

const WireSection = styled.div`
  overflow: hidden;
  border-top: 1px solid var(--line-faint);
  border-bottom: 1px solid var(--line-faint);
  background: var(--paper-warm);
  padding: ${rem(20)} 0;

  @media (hover: hover) and (pointer: fine) {
    &:hover ${() => WireScrollA}, &:hover ${() => WireScrollB} {
      animation-play-state: paused;
    }
  }
`

const WireTrack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${rem(12)};
`

const WireRowA = styled.div`
  overflow: hidden;
  width: 100%;
`

const WireRowB = styled.div`
  overflow: hidden;
  width: 100%;
`

const scrollLeft = keyframes`
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
`

const scrollRight = keyframes`
  from { transform: translateX(-50%); }
  to { transform: translateX(0); }
`

const WireScrollA = styled.div`
  display: flex;
  align-items: center;
  gap: ${rem(20)};
  width: max-content;
  animation: ${scrollLeft} 40s linear infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

const WireScrollB = styled.div`
  display: flex;
  align-items: center;
  gap: ${rem(20)};
  width: max-content;
  animation: ${scrollRight} 40s linear infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
    transform: translateX(-50%);
  }
`

const WireItem = styled.span`
  font-family: var(--sans);
  font-size: ${rem(11)};
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ink-mute);
  white-space: nowrap;
  flex-shrink: 0;
`

const WireDot = styled.span`
  width: ${rem(3)};
  height: ${rem(3)};
  border-radius: 50%;
  background: var(--seal);
  flex-shrink: 0;
`

const SectionWrapper = styled.div`
  width: 100%;
  box-sizing: border-box;
  max-width: ${rem(1200)};
  margin: 0 auto;
  padding: 0 clamp(${rem(20)}, 4vw, ${rem(24)});
`

const ContributorsSection = styled.section`
  width: 100%;
  box-sizing: border-box;
  max-width: ${rem(1200)};
  margin: 0 auto;
  padding: clamp(${rem(60)}, 8vw, ${rem(100)}) clamp(${rem(20)}, 4vw, ${rem(24)});

  ${mobile(css`
    padding: ${rem(60)} ${rem(20)};
  `)}
`

const ContribLayout = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 0.78fr) minmax(0, 1.22fr);
  align-items: center;
  gap: clamp(${rem(28)}, 6vw, ${rem(76)});

  ${mobile(css`
    grid-template-columns: minmax(0, 1fr);
    gap: ${rem(36)};
  `)}
`

const ContribCopy = styled.div`
  min-width: 0;
  max-width: ${rem(520)};

  ${mobile(css`
    max-width: ${rem(640)};
  `)}
`

const ContribMeta = styled.div`
  display: inline-flex;
  align-items: center;
  gap: ${rem(9)};
  margin-bottom: ${rem(20)};
  color: var(--ink-mute);
  font-family: var(--mono);
  font-size: ${rem(11)};
  font-weight: 600;
  letter-spacing: 0.12em;
  line-height: 1.4;
  text-transform: uppercase;
`

const ContribMetaDot = styled.span`
  width: ${rem(7)};
  height: ${rem(7)};
  border-radius: 50%;
  background: var(--seal);
  box-shadow: 0 0 ${rem(12)} color-mix(in srgb, var(--seal) 62%, transparent);
`

const ContribTitle = styled.h2`
  font-family: var(--sans);
  font-size: clamp(${rem(32)}, 4vw, ${rem(48)});
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: -0.02em;
  color: var(--ink);
  margin: 0 0 ${rem(16)};
`

const ContribItalic = styled.span`
  font-family: var(--serif);
  font-style: italic;
  font-weight: 400;
`

const ContribDesc = styled.p`
  font-family: var(--body);
  font-size: ${rem(17)};
  line-height: 1.7;
  color: var(--ink-soft);
  margin: 0 0 ${rem(28)};
  max-width: ${rem(540)};

  ${mobile(css`
    margin-bottom: ${rem(24)};
  `)}
`

const ContribLink = styled.a`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  gap: ${rem(8)};
  padding: 0 ${rem(18)};
  border: 1px solid var(--line);
  border-radius: 999px;
  color: var(--ink);
  font-family: var(--sans);
  font-size: ${rem(14)};
  font-weight: 650;
  text-decoration: none;
  transition:
    border-color 0.25s ease,
    color 0.25s ease,
    background 0.25s ease,
    transform 0.25s cubic-bezier(0.23, 1, 0.32, 1),
    box-shadow 0.25s ease;

  span {
    color: var(--seal);
    transition: transform 180ms cubic-bezier(0.23, 1, 0.32, 1);
  }

  &:focus-visible {
    outline: 2px solid var(--seal);
    outline-offset: 3px;
  }

  &:active {
    transform: scale(0.97);
  }

  @media (hover: hover) and (pointer: fine) {
    &:hover {
      border-color: var(--seal);
      color: var(--seal);
      background: color-mix(in srgb, var(--seal) 8%, transparent);
      box-shadow: 0 ${rem(10)} ${rem(26)} ${rem(-16)} var(--seal);

      span {
        transform: translate(${rem(2)}, ${rem(-2)});
      }
    }
  }
`

const CTASection = styled.section`
  background: var(--ink);
  color: var(--paper);
  padding: ${rem(100)} ${rem(24)};
  border-bottom: 1px solid var(--on-paper-light-line);

  ${mobile(css`
    padding: ${rem(64)} ${rem(20)};
  `)}
`

const CTAInner = styled.div`
  max-width: ${rem(1200)};
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: ${rem(20)};
`

const CTALabel = styled.div`
  display: flex;
  align-items: center;
  gap: ${rem(12)};
  font-family: var(--sans);
  font-size: ${rem(11)};
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--on-paper-light-muted);
`

const CTALabelLine = styled.span`
  display: inline-block;
  width: ${rem(24)};
  height: 1px;
  background: var(--seal);
`

const CTATitle = styled.h2`
  font-family: var(--sans);
  font-size: clamp(${rem(36)}, 5vw, ${rem(64)});
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: -0.03em;
  color: var(--paper);
  margin: 0;
`

const CTAItalic = styled.span`
  font-family: var(--serif);
  font-style: italic;
  font-weight: 400;
`

const CTADesc = styled.p`
  font-family: var(--body);
  font-size: ${rem(17)};
  line-height: 1.7;
  color: var(--on-paper-light-soft);
  margin: 0;
  max-width: ${rem(480)};
  white-space: pre-line;
`

const CTAButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 48px;
  gap: ${rem(8)};
  padding: ${rem(14)} ${rem(36)};
  background: var(--seal);
  color: #fff;
  border: none;
  border-radius: 9999px;
  font-family: var(--sans);
  font-size: ${rem(15)};
  font-weight: 700;
  letter-spacing: 0.02em;
  cursor: pointer;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;

  &:active {
    transform: scale(0.98);
  }

  &:focus-visible {
    outline: 2px solid var(--paper);
    outline-offset: 3px;
  }

  @media (hover: hover) and (pointer: fine) {
    &:hover {
      transform: scale(1.04);
      box-shadow: 0 ${rem(8)} ${rem(32)} rgba(212, 86, 74, 0.4);
    }
  }
`

const Footer = styled.footer`
  background: var(--ink);
  color: var(--paper);
  padding: clamp(${rem(56)}, 7vw, ${rem(80)}) clamp(${rem(20)}, 4vw, ${rem(24)})
    calc(${rem(40)} + env(safe-area-inset-bottom));
  border-top: 1px solid var(--on-paper-light-line-soft);
`

const FooterInner = styled.div`
  max-width: ${rem(1200)};
  margin: 0 auto;
`

const FooterTop = styled.div`
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: ${rem(60)};

  ${mobile(css`
    grid-template-columns: 1fr;
    gap: ${rem(40)};
  `)}
`

const FooterBrand = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${rem(12)};
`

const FooterLogo = styled.img`
  width: ${rem(28)};
  height: ${rem(28)};
`

const FooterAppName = styled.span`
  font-family: var(--sans);
  font-size: ${rem(20)};
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--paper);
`

const FooterTagline = styled.p`
  font-family: var(--body);
  font-size: ${rem(14)};
  line-height: 1.6;
  color: var(--on-paper-light-muted);
  margin: 0;
  max-width: ${rem(280)};
`

const FooterColumns = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: ${rem(32)};

  ${mobile(css`
    grid-template-columns: repeat(2, 1fr);
    gap: ${rem(24)};
  `)}
`

const FooterCol = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${rem(10)};
`

const FooterColTitle = styled.span`
  font-family: var(--sans);
  font-size: ${rem(11)};
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--on-paper-light-muted);
  margin-bottom: ${rem(4)};
`

const FooterLink = styled.a`
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  font-family: var(--body);
  font-size: ${rem(14)};
  color: var(--on-paper-light-soft);
  text-decoration: none;
  transition: color 0.2s ease;

  &:focus-visible {
    outline: 2px solid var(--seal);
    outline-offset: 2px;
  }

  @media (hover: hover) and (pointer: fine) {
    &:hover {
      color: var(--seal);
    }
  }
`

const FooterDivider = styled.div`
  height: 1px;
  background: var(--on-paper-light-line-soft);
  margin: ${rem(40)} 0 ${rem(24)};
`

const FooterBottom = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-end;

  ${phone(css`
    align-items: flex-start;
    flex-direction: column;
    gap: ${rem(20)};
  `)}
`

const FooterCopyright = styled.p`
  font-family: var(--body);
  font-size: ${rem(13)};
  color: var(--on-paper-light-muted);
  margin: 0;

  a {
    color: var(--on-paper-light-muted);
    text-decoration: none;
    transition: color 0.2s ease;

    ${phone(css`
      display: inline-flex;
      align-items: center;
      min-height: 44px;
    `)}

    &:focus-visible {
      outline: 2px solid var(--seal);
      outline-offset: 2px;
    }

    @media (hover: hover) and (pointer: fine) {
      &:hover {
        color: var(--seal);
      }
    }
  }
`

const FooterKicker = styled.span`
  font-family: var(--serif);
  font-style: italic;
  font-size: ${rem(48)};
  font-weight: 400;
  color: var(--on-paper-light-line-soft);
  line-height: 1;
  letter-spacing: -0.03em;

  ${mobile(css`
    font-size: ${rem(32)};
  `)}
`

const LoadingContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: var(--paper);
`

type FlowyStroke = {
  id: string
  d: string
  width: number
}

const FLOWY_STROKES: readonly FlowyStroke[] = [
  {
    id: 'f-stem',
    d: 'M11 56 C13 55 16 55 18 56 M16 56 C19 44 20 29 24 16 M18 17 C26 12 38 12 45 16',
    width: 2.55,
  },
  {
    id: 'f-crossbar',
    d: 'M19 34 C26 31 34 32 40 34',
    width: 2.1,
  },
  {
    id: 'l',
    d: 'M45 49 C49 39 51 26 54 16 C55 12 59 12 59 16 C59 25 54 37 51 43 C49 48 51 52 55 52 C58 52 60 49 62 45',
    width: 2.5,
  },
  {
    id: 'o',
    d: 'M64 41 C65 32 70 27 77 28 C84 29 86 37 83 44 C80 51 73 54 67 50 C63 47 62 43 64 41 Z',
    width: 2.55,
  },
  {
    id: 'w',
    d: 'M88 30 C89 40 88 50 93 52 C98 53 101 41 102 30 C102 40 103 51 108 52 C114 53 117 40 119 29',
    width: 2.5,
  },
  {
    id: 'y',
    d: 'M122 30 C123 41 124 50 129 52 C134 53 138 40 140 29 C138 43 136 55 131 61 C128 65 123 65 122 62 C121 58 126 55 136 53',
    width: 2.5,
  },
]

const FlowyPathSet = ({
  stroke = 'var(--ink)',
  widthScale = 1,
}: {
  stroke?: string
  widthScale?: number
}) => (
  <g fill='none' stroke={stroke} strokeLinecap='round' strokeLinejoin='round'>
    {FLOWY_STROKES.map((path) => (
      <path key={path.id} d={path.d} strokeWidth={path.width * widthScale} />
    ))}
  </g>
)

const FlowyRibbonMotion = ({ replayKey }: { replayKey: number }) => (
  <>
    <motion.g
      initial={{ opacity: 0, transform: 'scaleX(0.96)' }}
      animate={{ opacity: 1, transform: 'scaleX(1)' }}
      transition={{ duration: 0.38, ease: [0.23, 1, 0.32, 1] }}
      style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
    >
      <FlowyPathSet />
    </motion.g>
    <g
      key={replayKey}
      fill='none'
      stroke='var(--seal)'
      strokeLinecap='round'
      strokeLinejoin='round'
      style={{ filter: 'drop-shadow(0 0 2px var(--seal))' }}
    >
      {FLOWY_STROKES.map((stroke, index) => (
        <motion.path
          key={stroke.id}
          d={stroke.d}
          strokeWidth={stroke.width * 1.08}
          initial={{ pathLength: 0.16, pathOffset: 0, opacity: 0 }}
          animate={{ pathLength: 0.16, pathOffset: 0.84, opacity: [0, 0.95, 0] }}
          transition={{
            pathOffset: {
              duration: 1.05,
              delay: 0.16 + index * 0.08,
              ease: [0.77, 0, 0.175, 1],
            },
            opacity: {
              duration: 1.05,
              delay: 0.16 + index * 0.08,
              times: [0, 0.18, 1],
              ease: 'easeOut',
            },
          }}
        />
      ))}
    </g>
  </>
)

const FlowyText = () => {
  const shouldReduceMotion = useReducedMotion()
  const [ribbonReplayKey, setRibbonReplayKey] = React.useState(0)

  const replayRibbon = () => {
    if (shouldReduceMotion) return
    setRibbonReplayKey((currentKey) => currentKey + 1)
  }

  return (
    <FlowyMark aria-label='Flowy' onHoverStart={replayRibbon} onHoverEnd={replayRibbon}>
      <FlowySvg viewBox='4 4 141 68' shapeRendering='geometricPrecision' aria-hidden='true'>
        {shouldReduceMotion ? <FlowyPathSet /> : <FlowyRibbonMotion replayKey={ribbonReplayKey} />}
      </FlowySvg>
    </FlowyMark>
  )
}

const LoadingSpinner = styled.div`
  width: ${rem(40)};
  height: ${rem(40)};
  border: 3px solid var(--line-soft);
  border-top-color: var(--seal);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

const BOTS_ID = [49699333, 29139614, 41898282, 29791463]

const isContributor = (value: unknown): value is Contributor => {
  if (!value || typeof value !== 'object') return false

  const contributor = value as Record<string, unknown>
  return (
    typeof contributor.id === 'number' &&
    typeof contributor.login === 'string' &&
    typeof contributor.avatar_url === 'string' &&
    typeof contributor.html_url === 'string'
  )
}

export const getStaticProps: GetStaticProps = async ({ locale }) => {
  let contributors: Contributor[] = []
  try {
    const res = await fetch('https://api.github.com/repos/drl990114/MarkFlowy/contributors', {
      headers: { Accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(8000),
    })
    if (res.ok) {
      const data: unknown = await res.json()
      contributors = (Array.isArray(data) ? data : [])
        .filter(isContributor)
        .filter((contributor) => !BOTS_ID.includes(contributor.id))
        .slice(0, 24)
    }
  } catch {
    contributors = []
  }
  return {
    props: {
      ...(await serverSideTranslations(locale || 'en', ['common'])),
      contributors,
    },
  }
}
