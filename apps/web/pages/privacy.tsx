import type { GetStaticProps } from 'next'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import React from 'react'
import styled, { css } from 'styled-components'
import HomeFooter from '../components/HomeFooter'
import Nav from '../components/HomeNav'
import SeoHead from '../components/SeoHead'
import { mobile } from '../utils/media'
import rem from '../utils/rem'

interface PrivacySection {
  title: string
  content: {
    type: 'paragraph' | 'list'
    text?: string
    items?: (string | { text: string; isHtml?: boolean })[]
  }[]
}

const privacySections: PrivacySection[] = [
  {
    title: 'Introduction',
    content: [
      {
        type: 'paragraph',
        text: 'MarkFlowy ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our MarkFlowy application and services.',
      },
      {
        type: 'paragraph',
        text: 'Please read this Privacy Policy carefully. If you do not agree with the terms of this Privacy Policy, please do not access the application.',
      },
    ],
  },
  {
    title: 'Information We Do Not Collect',
    content: [
      {
        type: 'paragraph',
        text: 'MarkFlowy is designed with privacy in mind. We do not collect or store:',
      },
      {
        type: 'list',
        items: [
          'Your documents, files, or any content you create or edit',
          'Your personal information such as name, email address, or phone number',
          'Your browsing history or usage patterns',
          'Any data from your local file system beyond what you explicitly choose to open',
        ],
      },
    ],
  },
  {
    title: 'Local Data Storage',
    content: [
      {
        type: 'paragraph',
        text: 'All your data is stored locally on your device:',
      },
      {
        type: 'list',
        items: [
          'Your documents and files remain on your local file system',
          "Application settings and preferences are stored locally using Tauri's secure storage",
          'Workspace information and bookmarks are stored locally on your device',
          'AI chat history (if enabled) is stored locally and never sent to our servers',
        ],
      },
    ],
  },
  {
    title: 'AI Features and Third-Party Services',
    content: [
      {
        type: 'paragraph',
        text: 'MarkFlowy offers optional AI-powered features that integrate with third-party AI providers:',
      },
      {
        type: 'list',
        items: [
          { text: '<strong>OpenAI Integration:</strong> If you choose to use OpenAI features, your API key and requests are sent directly to OpenAI\'s servers. We do not intercept or store your API keys or AI requests.', isHtml: true },
          { text: '<strong>DeepSeek Integration:</strong> Similar to OpenAI, your DeepSeek API key and requests are sent directly to DeepSeek\'s servers.', isHtml: true },
          { text: '<strong>Ollama Integration:</strong> For local Ollama deployments, all AI processing happens on your local machine.', isHtml: true },
          { text: '<strong>Google Gemini Integration:</strong> Your Gemini API key and requests are sent directly to Google\'s servers.', isHtml: true },
        ],
      },
      {
        type: 'paragraph',
        text: 'Please review the respective privacy policies of these third-party providers:',
      },
      {
        type: 'list',
        items: [
          { text: '<a href="https://openai.com/privacy" target="_blank" rel="noopener noreferrer">OpenAI Privacy Policy</a>', isHtml: true },
          { text: '<a href="https://www.deepseek.com/privacy" target="_blank" rel="noopener noreferrer">DeepSeek Privacy Policy</a>', isHtml: true },
          { text: '<a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google Privacy Policy</a>', isHtml: true },
        ],
      },
    ],
  },
  {
    title: 'Open Source and Transparency',
    content: [
      {
        type: 'paragraph',
        text: 'MarkFlowy is an open-source application. You can inspect our source code at any time to verify our privacy claims:',
      },
      {
        type: 'list',
        items: [
          { text: 'Source code is available on <a href="https://github.com/drl990114/MarkFlowy" target="_blank" rel="noopener noreferrer">GitHub</a>', isHtml: true },
          'All data handling is transparent and auditable',
          'Community contributions are welcome and reviewed',
        ],
      },
    ],
  },
  {
    title: 'Data Security',
    content: [
      {
        type: 'paragraph',
        text: 'We implement appropriate technical and organizational measures to protect your data:',
      },
      {
        type: 'list',
        items: [
          'All data remains on your local device',
          'No cloud synchronization of your documents',
          'Application settings are stored securely using platform-specific secure storage',
        ],
      },
    ],
  },
  {
    title: 'Your Rights',
    content: [
      {
        type: 'paragraph',
        text: 'Since all your data is stored locally, you have complete control over your information:',
      },
      {
        type: 'list',
        items: [
          'You can access all your data directly on your file system',
          'You can delete application settings by clearing the application data',
          'You can uninstall the application at any time, which removes all local data',
        ],
      },
    ],
  },
  {
    title: 'Changes to This Privacy Policy',
    content: [
      {
        type: 'paragraph',
        text: 'We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last Updated" date.',
      },
      {
        type: 'paragraph',
        text: 'You are advised to review this Privacy Policy periodically for any changes. Changes to this Privacy Policy are effective when they are posted on this page.',
      },
    ],
  },
  {
    title: 'Contact Us',
    content: [
      {
        type: 'paragraph',
        text: 'If you have any questions about this Privacy Policy, please contact us:',
      },
      {
        type: 'list',
        items: [
          { text: 'By visiting our GitHub repository: <a href="https://github.com/drl990114/MarkFlowy" target="_blank" rel="noopener noreferrer">https://github.com/drl990114/MarkFlowy</a>', isHtml: true },
          'By creating an issue on our GitHub issues page',
        ],
      },
    ],
  },
]

function renderContentItem(item: PrivacySection['content'][number], index: number) {
  if (item.type === 'paragraph' && item.text) {
    return <Paragraph key={index} dangerouslySetInnerHTML={{ __html: item.text }} />
  }

  if (item.type === 'list' && item.items) {
    return (
      <List key={index}>
        {item.items.map((listItem, idx) => {
          if (typeof listItem === 'string') {
            return <ListItem key={idx}>{listItem}</ListItem>
          }
          return (
            <ListItem
              key={idx}
              dangerouslySetInnerHTML={{ __html: listItem.text }}
            />
          )
        })}
      </List>
    )
  }

  return null
}

export default function PrivacyPage() {
  const [isMobileNavFolded, setIsMobileNavFolded] = React.useState(true)

  return (
    <>
      <SeoHead
        title='Privacy Policy - MarkFlowy'
        description='Read the MarkFlowy privacy policy, including local storage and optional AI services.'
        availableLocales={['en']}
      />

      <PageLayout>
        <HeaderWrapper>
          <Nav
            showSideNav={false}
            isMobileNavFolded={isMobileNavFolded}
            onMobileNavToggle={() => setIsMobileNavFolded((x) => !x)}
          />
        </HeaderWrapper>

        <MainContent>
          <ContentContainer>
            <PageTitle>Privacy Policy</PageTitle>
            <LastUpdated>Last Updated: March 28, 2026</LastUpdated>

            {privacySections.map((section, sectionIndex) => (
              <Section key={sectionIndex}>
                <SectionTitle>
                  {sectionIndex + 1}. {section.title}
                </SectionTitle>
                {section.content.map((contentItem, contentIndex) =>
                  renderContentItem(contentItem, contentIndex)
                )}
              </Section>
            ))}
          </ContentContainer>
        </MainContent>

        <FooterWrapper>
          <HomeFooter />
        </FooterWrapper>
      </PageLayout>
    </>
  )
}

export const getStaticProps: GetStaticProps = async ({ locale }) => {
  return {
    props: {
      ...(await serverSideTranslations(locale ?? 'en', ['common'])),
    },
  }
}

// Styled Components
const PageLayout = styled.div`
  background: ${(props) => props.theme.bgColor};
  color: ${(props) => props.theme.primaryFontColor};
  font-family: ${(props) => props.theme.fontFamily};
  min-height: 100vh;
  display: flex;
  flex-direction: column;
`

const HeaderWrapper = styled.header`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: ${(props) => props.theme.bgColor};
`

const MainContent = styled.main`
  flex: 1;
  padding-top: ${rem(80)};
`

const ContentContainer = styled.div`
  max-width: ${rem(900)};
  margin: 0 auto;
  padding: ${rem(40)} ${rem(20)};

  ${mobile(css`
    padding: ${rem(20)} ${rem(16)};
  `)};
`

const PageTitle = styled.h1`
  font-size: ${rem(42)};
  font-weight: 700;
  margin-bottom: ${rem(8)};
  color: ${(props) => props.theme.primaryFontColor};

  ${mobile(css`
    font-size: ${rem(32)};
  `)};
`

const LastUpdated = styled.p`
  font-size: ${rem(14)};
  color: ${(props) => props.theme.unselectedFontColor};
  margin-bottom: ${rem(40)};
`

const Section = styled.section`
  margin-bottom: ${rem(32)};
`

const SectionTitle = styled.h2`
  font-size: ${rem(24)};
  font-weight: 600;
  margin-bottom: ${rem(16)};
  color: ${(props) => props.theme.primaryFontColor};

  ${mobile(css`
    font-size: ${rem(20)};
  `)};
`

const Paragraph = styled.p`
  font-size: ${rem(16)};
  line-height: 1.7;
  margin-bottom: ${rem(16)};
  color: ${(props) => props.theme.primaryFontColor};
`

const List = styled.ul`
  margin-bottom: ${rem(16)};
  padding-left: ${rem(24)};
`

const ListItem = styled.li`
  font-size: ${rem(16)};
  line-height: 1.7;
  margin-bottom: ${rem(8)};
  color: ${(props) => props.theme.primaryFontColor};

  a {
    color: ${(props) => props.theme.primaryFontColor};
    text-decoration: underline;

    &:hover {
      opacity: 0.8;
    }
  }
`

const FooterWrapper = styled.footer`
  border-top: 1px solid ${(props) => props.theme.borderColor};
`
