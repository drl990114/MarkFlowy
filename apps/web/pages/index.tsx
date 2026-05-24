import FeatureList from 'components/FeatureList'
import { motion } from 'motion/react'
import { GetStaticProps } from 'next'
import { i18n, useTranslation } from 'next-i18next'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import React from 'react'
import styled, { css, keyframes } from 'styled-components'
import Nav from '../components/HomeNav'
import { HoverBorderGradient } from '../components/HoverBorderGradient'
import SeoHead from '../components/SeoHead'
import { useRedirectIfAuthenticated } from '../hooks/useAuth'
import { useMockFiles } from '../hooks/useMockFiles'
import { useSystemType } from '../hooks/useSystemType'
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
  loading: () => <EditorLoading />,
})

const WIRE_ITEMS_ROW_A = [
  'Markdown', 'WYSIWYG', 'AI Copilot', 'Source Code', 'Themes',
  'Hotkeys', 'Tauri', 'Cross-Platform', 'File Manager', 'JSON',
  'Custom Themes', 'Base64', 'Search', 'Multilingual',
]

const WIRE_ITEMS_ROW_B = [
  'Lightweight', 'Dark Mode', 'Extensions', 'Ollama', 'ChatGPT',
  'DeepSeek', 'Translation', 'Summary', 'Shortcuts', 'Tree View',
  'Smart Images', 'TXT', 'Code Blocks', 'Syntax Highlight',
]

export default function Index({
  contributors = [] as Contributor[],
}: {
  contributors?: Contributor[]
}) {
  const checkingAuth = useRedirectIfAuthenticated()
  const { t } = useTranslation()
  const [isMobileNavFolded, setIsMobileNavFolded] = React.useState(true)
  const [activeTab, setActiveTab] = React.useState<'wysiwyg' | 'source'>('wysiwyg')
  const { markdownContent, jsonContent } = useMockFiles()
  const systemType = useSystemType()

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
          onMobileNavToggle={() => setIsMobileNavFolded((x) => !x)}
        />

        <HeroSection>
          <HeroGrid>
            <HeroLeft
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.22, 0.61, 0.36, 1] }}
            >
              <motion.div whileInView={{ opacity: 1, y: 0 }} initial={{ opacity: 0, y: 12 }} viewport={{ once: true }} transition={{ duration: 0.5, ease: [0.22, 0.61, 0.36, 1] }}>
                <HeroLabel>
                  <LabelLine />
                  I &middot; MARKDOWN EDITOR
                </HeroLabel>
              </motion.div>
              <motion.div whileInView={{ opacity: 1, y: 0 }} initial={{ opacity: 0, y: 16 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.05, ease: [0.22, 0.61, 0.36, 1] }}>
                <HeroTitle>
                  <TitleMain>Mark</TitleMain>
                  <TitleItalic>Flowy</TitleItalic>
                  <TitleDot />
                </HeroTitle>
              </motion.div>
              <motion.div whileInView={{ opacity: 1, y: 0 }} initial={{ opacity: 0, y: 16 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 0.61, 0.36, 1] }}>
                <HeroLead>{t('home.hero.subtitle')}</HeroLead>
              </motion.div>
              <motion.div whileInView={{ opacity: 1, y: 0 }} initial={{ opacity: 0, y: 16 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.15, ease: [0.22, 0.61, 0.36, 1] }}>
                <HeroActions>
                  <HoverBorderGradient
                    onClick={() => {
                      window.open(
                        'https://download.upgrade.toolsetlink.com/download?appKey=xpn68m4j5qU0Y1rfDYFHaA',
                      )
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
              <motion.div whileInView={{ opacity: 1, y: 0 }} initial={{ opacity: 0, y: 16 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 0.61, 0.36, 1] }}>
                <StatRings>
                  <StatRing $percent={85}>
                    <RingBg />
                    <RingFill $percent={85} />
                    <RingNumber>5+</RingNumber>
                    <RingLabel>{t('home.features.feature3.title').split(' ')[0]}</RingLabel>
                  </StatRing>
                  <StatRing $percent={72}>
                    <RingBg />
                    <RingFill $percent={72} />
                    <RingNumber>20M</RingNumber>
                    <RingLabel>Size</RingLabel>
                  </StatRing>
                  <StatRing $percent={60}>
                    <RingBg />
                    <RingFill $percent={60} />
                    <RingNumber>2</RingNumber>
                    <RingLabel>{t('home.features.feature1.title').split(' ')[0]}</RingLabel>
                  </StatRing>
                </StatRings>
              </motion.div>
            </HeroLeft>

            <HeroRight
              initial={{ opacity: 0, y: 30, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.15, ease: [0.22, 0.61, 0.36, 1] }}
            >
              <MacWindow>
                <MacTitleBar>
                  <MacButtons>
                    <MacButton $red />
                    <MacButton $yellow />
                    <MacButton $green />
                  </MacButtons>
                  <MacTitle>MarkFlowy</MacTitle>
                </MacTitleBar>
                <EditorTabs>
                  <EditorTab
                    $active={activeTab === 'wysiwyg'}
                    onClick={() => setActiveTab('wysiwyg')}
                  >
                    README.md
                  </EditorTab>
                  <EditorTab
                    $active={activeTab === 'source'}
                    onClick={() => setActiveTab('source')}
                  >
                    config.json
                  </EditorTab>
                </EditorTabs>
                <EditorWrapper $visible={activeTab === 'wysiwyg'}>
                  <Editor
                    fileId='home-markdown'
                    key={`${i18n?.language}_wysiwyg`}
                    viewType='wysiwyg'
                    initialContent={markdownContent}
                  />
                </EditorWrapper>
                <SourceEditorWrapper $visible={activeTab === 'source'}>
                  <Editor
                    fileId='home-json'
                    key={`${i18n?.language}_source_code`}
                    viewType='source_code'
                    initialContent={jsonContent}
                  />
                </SourceEditorWrapper>
              </MacWindow>
            </HeroRight>
          </HeroGrid>
        </HeroSection>

        <WireSection>
          <WireTrack>
            <WireRowA>
              <WireScrollA>
                {[...WIRE_ITEMS_ROW_A, ...WIRE_ITEMS_ROW_A].map((item, i) => (
                  <React.Fragment key={i}>
                    <WireItem>{item}</WireItem>
                    {i < WIRE_ITEMS_ROW_A.length * 2 - 1 && <WireDot />}
                  </React.Fragment>
                ))}
              </WireScrollA>
            </WireRowA>
            <WireRowB>
              <WireScrollB>
                {[...WIRE_ITEMS_ROW_B, ...WIRE_ITEMS_ROW_B].map((item, i) => (
                  <React.Fragment key={i}>
                    <WireItem>{item}</WireItem>
                    {i < WIRE_ITEMS_ROW_B.length * 2 - 1 && <WireDot />}
                  </React.Fragment>
                ))}
              </WireScrollB>
            </WireRowB>
          </WireTrack>
        </WireSection>

        <SectionWrapper>
          <FeatureList />
        </SectionWrapper>

        <ContributorsSection>
          <ContribLabel>
            <LabelLine />
            II &middot; CONTRIBUTORS
          </ContribLabel>
          <ContribTitle>
            {t('home.contributors.title').split(' ').slice(0, -1).join(' ')}{' '}
            <ContribItalic>{t('home.contributors.title').split(' ').slice(-1)}</ContribItalic>
          </ContribTitle>
          <ContribDesc>{t('home.contributors.description')}</ContribDesc>
          <ContribGrid>
            {contributors.map((c) => (
              <ContribItem
                key={c.id}
                href={c.html_url}
                target='_blank'
                rel='noopener noreferrer'
              >
                <ContribAvatar src={c.avatar_url} alt={c.login} />
                <ContribName>{c.login}</ContribName>
              </ContribItem>
            ))}
          </ContribGrid>
        </ContributorsSection>

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
                window.open(
                  'https://download.upgrade.toolsetlink.com/download?appKey=xpn68m4j5qU0Y1rfDYFHaA',
                )
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
                <FooterTagline>
                  Next-generation professional editor driven by AI.
                </FooterTagline>
              </FooterBrand>
              <FooterColumns>
                <FooterCol>
                  <FooterColTitle>Product</FooterColTitle>
                  <FooterLink href='https://github.com/drl990114/MarkFlowy/releases' target='_blank'>
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
                  <FooterLink href='https://github.com/drl990114/MarkFlowy/blob/main/CONTRIBUTING.md' target='_blank'>
                    Contributing
                  </FooterLink>
                  <FooterLink href='https://github.com/drl990114/MarkFlowy/blob/main/CODE_OF_CONDUCT.md' target='_blank'>
                    Code of Conduct
                  </FooterLink>
                  <FooterLink href='https://github.com/drl990114/MarkFlowy/blob/main/LICENSE' target='_blank'>
                    License
                  </FooterLink>
                </FooterCol>
              </FooterColumns>
            </FooterTop>
            <FooterDivider />
            <FooterBottom>
              <FooterCopyright>
                &copy;2023 &ndash; present <Link href='https://github.com/drl990114'>drl990114</Link>. All Rights Reserved.
              </FooterCopyright>
              <FooterKicker>Flow</FooterKicker>
            </FooterBottom>
          </FooterInner>
        </Footer>
      </PageLayout>
    </>
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
`

const HeroSection = styled.section`
  max-width: ${rem(1200)};
  margin: 0 auto;
  padding: ${rem(140)} ${rem(24)} ${rem(80)};
  min-height: 90vh;
  display: flex;
  align-items: center;

  ${mobile(css`
    padding: ${rem(100)} ${rem(20)} ${rem(48)};
    min-height: auto;
  `)}
`

const HeroGrid = styled.div`
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
  display: flex;
  flex-direction: column;
  gap: ${rem(28)};
`

const HeroLabel = styled.div`
  display: flex;
  align-items: center;
  gap: ${rem(12)};
  font-family: var(--sans);
  font-size: ${rem(11)};
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--ink-soft);
`

const LabelLine = styled.span`
  display: inline-block;
  width: ${rem(24)};
  height: 1px;
  background: var(--seal);
`

const HeroTitle = styled.h1`
  font-family: var(--sans);
  font-size: clamp(${rem(42)}, 5.5vw, ${rem(72)});
  font-weight: 800;
  line-height: 1.05;
  letter-spacing: -0.03em;
  color: var(--ink);
  margin: 0;
  display: flex;
  align-items: baseline;
  gap: ${rem(4)};
`

const TitleMain = styled.span``

const TitleItalic = styled.span`
  font-family: var(--serif);
  font-style: italic;
  font-weight: 400;
`

const TitleDot = styled.span`
  display: inline-block;
  width: ${rem(14)};
  height: ${rem(14)};
  border-radius: 50%;
  background: var(--seal);
  box-shadow: 0 0 12px rgba(212, 86, 74, 0.4);
  margin-left: ${rem(4)};
  flex-shrink: 0;
  align-self: center;
`

const HeroLead = styled.p`
  font-family: var(--body);
  font-size: ${rem(18)};
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
`

const GhostButton = styled.a`
  display: inline-flex;
  align-items: center;
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
  transition: all 0.25s cubic-bezier(0.22, 0.61, 0.36, 1);

  &:hover {
    border-color: var(--seal);
    color: var(--seal);
    background: rgba(212, 86, 74, 0.08);
  }

  &:focus-visible {
    outline: 2px solid var(--seal);
    outline-offset: 2px;
  }
`

const StatRings = styled.div`
  display: flex;
  gap: ${rem(32)};
  margin-top: ${rem(8)};

  ${mobile(css`
    gap: ${rem(20)};
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
  -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 3px), black calc(100% - 3px));
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
  -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 3px), black calc(100% - 3px));
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
  height: ${rem(540)};
  background: var(--paper-warm);
  border-radius: ${rem(12)};
  box-shadow: 0 32px 80px -20px var(--shadow), 0 0 0 1px var(--line-faint) inset;
  overflow: hidden;
  position: relative;

  ${mobile(css`
    height: ${rem(400)};
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

const MacButton = styled.button<{ $red?: boolean; $yellow?: boolean; $green?: boolean }>`
  width: ${rem(12)};
  height: ${rem(12)};
  border-radius: 50%;
  border: none;
  cursor: pointer;
  padding: 0;

  ${(props) => props.$red && css`background: #ff5f57;`}
  ${(props) => props.$yellow && css`background: #ffbd2e;`}
  ${(props) => props.$green && css`background: #28c840;`}
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
`

const EditorTab = styled.div<{ $active: boolean }>`
  font-family: var(--sans);
  font-size: ${rem(12)};
  font-weight: 500;
  letter-spacing: -0.01em;
  color: ${(props) => (props.$active ? 'var(--ink)' : 'var(--ink-mute)')};
  cursor: pointer;
  padding: 0 ${rem(20)};
  background: ${(props) => (props.$active ? 'var(--paper-warm)' : 'transparent')};
  border-right: 1px solid var(--line-faint);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s, background 0.2s, border-color 0.2s;
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

  &:hover {
    ${(props) => !props.$active && 'background: var(--line-faint); color: var(--ink-soft);'}
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
`

const SourceEditorWrapper = styled.div<{ $visible: boolean }>`
  display: ${(props) => (props.$visible ? 'block' : 'none')};
  height: calc(100% - ${rem(72)});
  min-width: 0;
  position: relative;
  overflow: hidden;
  background: var(--paper);
  font-family: var(--mono);

  &::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: ${rem(48)};
    pointer-events: none;
    background: linear-gradient(to bottom, transparent, var(--paper));
    z-index: 3;
  }
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
    background: linear-gradient(90deg, rgba(232,230,227,0.04) 25%, rgba(232,230,227,0.08) 50%, rgba(232,230,227,0.04) 75%);
    background-size: 200% 100%;
    animation: ${shimmer} 1.8s infinite linear;
  }

  .skel-line {
    height: ${rem(12)};
    border-radius: ${rem(3)};
    background: linear-gradient(90deg, rgba(232,230,227,0.04) 25%, rgba(232,230,227,0.08) 50%, rgba(232,230,227,0.04) 75%);
    background-size: 200% 100%;
    animation: ${shimmer} 1.8s infinite linear;
  }

  .skel-heading {
    height: ${rem(20)};
    width: 45%;
    border-radius: ${rem(3)};
    background: linear-gradient(90deg, rgba(232,230,227,0.04) 25%, rgba(232,230,227,0.08) 50%, rgba(232,230,227,0.04) 75%);
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
      background: linear-gradient(90deg, var(--line-faint) 25%, var(--line-soft) 50%, var(--line-faint) 75%);
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
`

const WireSection = styled.div`
  overflow: hidden;
  border-top: 1px solid var(--line-faint);
  border-bottom: 1px solid var(--line-faint);
  background: var(--paper-warm);
  padding: ${rem(20)} 0;

  &:hover ${() => WireScrollA}, &:hover ${() => WireScrollB} {
    animation-play-state: paused;
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
`

const WireScrollB = styled.div`
  display: flex;
  align-items: center;
  gap: ${rem(20)};
  width: max-content;
  animation: ${scrollRight} 40s linear infinite;
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
  max-width: ${rem(1200)};
  margin: 0 auto;
  padding: 0 ${rem(24)};
`

const ContributorsSection = styled.section`
  max-width: ${rem(1200)};
  margin: 0 auto;
  padding: ${rem(100)} ${rem(24)};

  ${mobile(css`
    padding: ${rem(60)} ${rem(20)};
  `)}
`

const ContribLabel = styled.div`
  display: flex;
  align-items: center;
  gap: ${rem(12)};
  font-family: var(--sans);
  font-size: ${rem(11)};
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--ink-soft);
  margin-bottom: ${rem(20)};
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
  margin: 0 0 ${rem(48)};
  max-width: ${rem(540)};

  ${mobile(css`
    margin-bottom: ${rem(32)};
  `)}
`

const ContribGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(${rem(140)}, 1fr));
  gap: ${rem(16)};

  ${mobile(css`
    grid-template-columns: repeat(auto-fill, minmax(${rem(100)}, 1fr));
    gap: ${rem(12)};
  `)}
`

const ContribItem = styled.a`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: ${rem(16)} ${rem(12)};
  background: var(--paper-warm);
  border: 1px solid var(--line-faint);
  border-radius: ${rem(10)};
  text-decoration: none;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    border-color: var(--seal);
    transform: translateY(-2px);
    box-shadow: 0 ${rem(8)} ${rem(24)} var(--shadow);
  }
`

const ContribAvatar = styled.img`
  width: ${rem(52)};
  height: ${rem(52)};
  border-radius: 50%;
  margin-bottom: ${rem(10)};
  border: 2px solid transparent;
  transition: border-color 0.3s ease;

  ${ContribItem}:hover & {
    border-color: var(--seal);
  }
`

const ContribName = styled.span`
  font-family: var(--mono);
  font-size: ${rem(12)};
  font-weight: 500;
  color: var(--ink-soft);
  transition: color 0.3s ease;

  ${ContribItem}:hover & {
    color: var(--ink);
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
  transition: transform 0.2s ease, box-shadow 0.2s ease;

  &:hover {
    transform: scale(1.04);
    box-shadow: 0 ${rem(8)} ${rem(32)} rgba(212, 86, 74, 0.4);
  }
`

const Footer = styled.footer`
  background: var(--ink);
  color: var(--paper);
  padding: ${rem(80)} ${rem(24)} ${rem(40)};
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
  font-family: var(--body);
  font-size: ${rem(14)};
  color: var(--on-paper-light-soft);
  text-decoration: none;
  transition: color 0.2s ease;

  &:hover {
    color: var(--seal);
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

    &:hover {
      color: var(--seal);
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
  } catch (_) {}
  return {
    props: {
      ...(await serverSideTranslations(locale || 'en', ['common'])),
      contributors,
    },
  }
}
