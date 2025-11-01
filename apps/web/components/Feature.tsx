import { useTranslation } from 'next-i18next'
import Image from 'next/image'
import { useState } from 'react'
import styled, { css } from 'styled-components'
import { mobile } from 'utils/media'
import rem from 'utils/rem'
import { ImageWrapper } from './ImageWrapper'

export type Feature = {
  title: string
  descs: string[]
  img: string
}

const Container = styled.section`
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 20px 0;
  width: 100%;
  max-width: 1380px;
  padding: 0 ${rem(60)};
  box-sizing: border-box;

  ${() =>
    mobile(css`
      padding: 0 ${rem(30)};
    `)};
`

const TabContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${rem(10)};
  margin-bottom: ${rem(20)};
  justify-content: center;
`

const TabButton = styled.button<{ active: boolean }>`
  padding: ${rem(10)} ${rem(20)};
  border: 1px solid ${(props) => props.theme.borderColor};
  background: transparent;
  border-radius: ${rem(8)};
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: ${rem(16)};
  
  ${(props) =>
    props.active &&
    css`
      background-color: ${(props) => props.theme.navBackground};
      border-color: ${(props) => props.theme.borderColor};
      font-weight: 500;
    `};

  &:hover {
    background-color: ${(props) => props.theme.navBackground};
  }
`

const ContentContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
`

const TextContent = styled.div`
  text-align: center;
  max-width: 800px;
  margin-bottom: ${rem(40)};

  h3 {
    font-size: ${rem(24)};
    margin-bottom: ${rem(20)};
  }

  p {
    margin-bottom: ${rem(10)};
    line-height: 1.6;
  }
`

const ImageContainer = styled.div`
  width: 100%;
  max-width: 900px;
  height: auto;
  display: flex;
  justify-content: center;
`

export default function Feature() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState(0)

  const features = [
    {
      title: t('home.features.feature2.title'),
      descs: [t('home.features.feature2.description')],
      img: '/screenshots/ai.png',
    },
    {
      title: t('home.features.feature1.title'),
      descs: [t('home.features.feature1.description')],
      img: '/screenshots/sourcecode.png',
    },
    {
      title: t('home.features.feature3.title'),
      descs: [t('home.features.feature3.description')],
      img: '/screenshots/darkmode.png',
    },
  ]

  const currentFeature = features[activeTab]

  return (
    <Container id='feature'>
      <div style={{ width: '100%' }}>
        <TabContainer>
          {features.map((feature, index) => (
            <TabButton
              key={feature.title}
              active={activeTab === index}
              onClick={() => setActiveTab(index)}
            >
              {feature.title}
            </TabButton>
          ))}
        </TabContainer>

        <ContentContainer>
          <TextContent>
            {currentFeature.descs.map((desc, index) => (
              <p key={index}>{desc}</p>
            ))}
          </TextContent>
          <ImageContainer>
            <ImageWrapper>
              <Image
                src={currentFeature.img}
                alt={currentFeature.title}
                width={900}
                height={600}
                style={{ width: '100%', height: 'auto', borderRadius: '6px' }}
              />
            </ImageWrapper>
          </ImageContainer>
        </ContentContainer>
      </div>
    </Container>
  )
}
