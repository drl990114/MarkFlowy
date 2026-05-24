import { motion } from 'motion/react'
import { useTranslation } from 'next-i18next'
import Image from 'next/image'
import Link from 'next/link'
import styled, { css } from 'styled-components'
import { mobile } from '../utils/media'
import rem from '../utils/rem'

export type FeatureItemProps = {
  title: string
  descs: string[]
  img: string
  imagePosition?: 'left' | 'right'
  link?: {
    text: string
    href: string
  }
}

const Section = styled.section`
  width: 100%;
  padding: ${rem(80)} 0;
  display: flex;
  flex-direction: column;
  gap: ${rem(80)};

  ${mobile(css`
    padding: ${rem(40)} 0;
    gap: ${rem(48)};
  `)}
`

const SectionRule = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid var(--line-soft);
  padding-top: ${rem(16)};

  ${mobile(css`
    padding-top: ${rem(12)};
  `)}
`

const RomanNumeral = styled.span`
  font-family: var(--serif);
  font-style: italic;
  color: var(--seal);
  font-size: ${rem(18)};
  letter-spacing: 0.02em;

  ${mobile(css`
    font-size: ${rem(15)};
  `)}
`

const RuleMeta = styled.span`
  font-family: var(--sans);
  font-size: ${rem(11)};
  font-weight: 500;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ink-mute);

  ${mobile(css`
    font-size: ${rem(10)};
  `)}
`

const SectionHeader = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${rem(20)};
  max-width: ${rem(800)};

  ${mobile(css`
    gap: ${rem(14)};
  `)}
`

const SectionLabel = styled.span`
  display: flex;
  align-items: center;
  gap: ${rem(10)};
  font-family: var(--sans);
  font-size: ${rem(12)};
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ink-mute);

  &::before {
    content: '';
    display: inline-block;
    width: ${rem(24)};
    height: 2px;
    background: var(--seal);
  }
`

const DisplayTitle = styled.h2`
  font-family: var(--sans);
  font-size: clamp(${rem(40)}, 4.6vw, ${rem(66)});
  font-weight: 800;
  line-height: 1.05;
  letter-spacing: -0.03em;
  color: var(--ink);
  margin: 0;

  ${mobile(css`
    font-size: clamp(${rem(28)}, 8vw, ${rem(40)});
  `)}
`

const ItalicEmphasis = styled.span`
  font-family: var(--serif);
  font-style: italic;
  font-weight: 400;
`

const SealDot = styled.span`
  color: var(--seal);
`

const LeadParagraph = styled.p`
  font-family: var(--body);
  font-size: ${rem(18)};
  line-height: 1.65;
  color: var(--ink-soft);
  margin: 0;
  max-width: ${rem(580)};

  ${mobile(css`
    font-size: ${rem(15)};
  `)}
`

const FeatureRowWrapper = styled(motion.div)`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${rem(60)};
  align-items: center;
  padding: ${rem(48)} 0;

  ${mobile(css`
    grid-template-columns: 1fr;
    gap: ${rem(28)};
    padding: ${rem(28)} 0;
  `)}
`

const TextColumn = styled(motion.div)`
  display: flex;
  flex-direction: column;
  gap: ${rem(16)};
`

const FeatureTitle = styled.h3`
  font-family: var(--sans);
  font-size: ${rem(24)};
  font-weight: 600;
  line-height: 1.15;
  letter-spacing: -0.02em;
  color: var(--ink);
  margin: 0;

  ${mobile(css`
    font-size: ${rem(20)};
  `)}
`

const FeatureDesc = styled.p`
  font-family: var(--body);
  font-size: ${rem(16)};
  line-height: 1.65;
  color: var(--ink-soft);
  margin: 0;

  ${mobile(css`
    font-size: ${rem(14)};
  `)}
`

const LearnMoreLink = styled(Link)`
  font-family: var(--sans);
  font-size: ${rem(14)};
  font-weight: 500;
  color: var(--seal);
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: ${rem(6)};
  transition: opacity 0.2s ease, transform 0.2s ease;

  &:hover {
    opacity: 0.85;
    transform: translateX(4px);
  }

  &::after {
    content: '→';
  }
`

const ImageColumn = styled(motion.div)`
  position: relative;
`

const ImageFrame = styled.div`
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 10;
  background: var(--paper-warm);
  border-radius: ${rem(10)};
  overflow: hidden;
  box-shadow: var(--shadow);

  ${mobile(css`
    border-radius: ${rem(8)};
  `)}
`

const CapabilityGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${rem(20)};

  ${mobile(css`
    grid-template-columns: 1fr;
    gap: ${rem(14)};
  `)}
`

const CapabilityCard = styled(motion.div)`
  border: 1px solid var(--line-soft);
  border-radius: ${rem(8)};
  padding: ${rem(28)};
  display: flex;
  flex-direction: column;
  gap: ${rem(12)};
  transition: border-color 0.25s ease, transform 0.25s ease, box-shadow 0.25s ease;
  cursor: default;

  &:hover {
    border-color: var(--seal);
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
  }

  ${mobile(css`
    padding: ${rem(20)};
    gap: ${rem(8)};
  `)}
`

const CapabilityNumber = styled.span`
  font-family: var(--serif);
  font-style: italic;
  font-size: ${rem(20)};
  color: var(--seal);
  line-height: 1;

  ${mobile(css`
    font-size: ${rem(17)};
  `)}
`

const CapabilityTag = styled.span`
  font-family: var(--sans);
  font-size: ${rem(10)};
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--ink-mute);
`

const CapabilityTitle = styled.h4`
  font-family: var(--sans);
  font-size: ${rem(18)};
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: -0.01em;
  color: var(--ink);
  margin: 0;

  ${mobile(css`
    font-size: ${rem(16)};
  `)}
`

const CapabilityBody = styled.p`
  font-family: var(--body);
  font-size: ${rem(14)};
  line-height: 1.6;
  color: var(--ink-soft);
  margin: 0;

  ${mobile(css`
    font-size: ${rem(13)};
  `)}
`

const FeatureRow = ({ title, descs, img, imagePosition = 'right', link }: FeatureItemProps) => {
  const textElement = (
    <TextColumn
      initial={{ opacity: 0, x: imagePosition === 'right' ? -30 : 30 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
    >
      <FeatureTitle>{title}</FeatureTitle>
      {descs.map((desc, index) => (
        <FeatureDesc key={index}>{desc}</FeatureDesc>
      ))}
      {link && <LearnMoreLink href={link.href}>{link.text}</LearnMoreLink>}
    </TextColumn>
  )

  const imageElement = (
    <ImageColumn
      initial={{ opacity: 0, x: imagePosition === 'right' ? 30 : -30 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay: 0.15 }}
    >
      <ImageFrame>
        <Image
          src={img}
          alt={title}
          width={800}
          height={500}
          style={{ width: '100%', height: 'auto', display: 'block' }}
        />
      </ImageFrame>
    </ImageColumn>
  )

  return (
    <FeatureRowWrapper>
      {imagePosition === 'right' ? (
        <>
          {textElement}
          {imageElement}
        </>
      ) : (
        <>
          {imageElement}
          {textElement}
        </>
      )}
    </FeatureRowWrapper>
  )
}

export default function FeatureList() {
  const { t } = useTranslation()

  const features: FeatureItemProps[] = [
    {
      title: t('home.features.feature2.title'),
      descs: [t('home.features.feature2.description')],
      img: '/screenshots/ai.png',
      imagePosition: 'right',
    },
    {
      title: t('home.features.feature1.title'),
      descs: [t('home.features.feature1.description')],
      img: '/screenshots/sourcecode.png',
      imagePosition: 'left',
    },
    {
      title: t('home.features.feature3.title'),
      descs: [t('home.features.feature3.description')],
      img: '/screenshots/darkmode.png',
      imagePosition: 'right',
    },
  ]

  const capabilities = [
    {
      number: '01',
      tag: t('home.features.capability1.tag'),
      title: t('home.features.capability1.title'),
      body: t('home.features.capability1.body'),
    },
    {
      number: '02',
      tag: t('home.features.capability2.tag'),
      title: t('home.features.capability2.title'),
      body: t('home.features.capability2.body'),
    },
    {
      number: '03',
      tag: t('home.features.capability3.tag'),
      title: t('home.features.capability3.title'),
      body: t('home.features.capability3.body'),
    },
    {
      number: '04',
      tag: t('home.features.capability4.tag'),
      title: t('home.features.capability4.title'),
      body: t('home.features.capability4.body'),
    },
  ]

  return (
    <Section id='features-list'>
      <SectionRule>
        <RomanNumeral>II</RomanNumeral>
        <RuleMeta>Features · 03</RuleMeta>
      </SectionRule>

      <SectionHeader>
        <SectionLabel>Features</SectionLabel>
        <DisplayTitle>
          Built for <ItalicEmphasis>writers</ItalicEmphasis>,<br />
          designed for <ItalicEmphasis>flow</ItalicEmphasis><SealDot>.</SealDot>
        </DisplayTitle>
        <LeadParagraph>{t('home.features.lead')}</LeadParagraph>
      </SectionHeader>

      {features.map((feature, index) => (
        <FeatureRow key={index} {...feature} />
      ))}

      <SectionRule>
        <RomanNumeral>III</RomanNumeral>
        <RuleMeta>Capabilities · 04</RuleMeta>
      </SectionRule>

      <CapabilityGrid>
        {capabilities.map((cap, index) => (
          <CapabilityCard
            key={index}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45, delay: index * 0.08 }}
          >
            <CapabilityNumber>{cap.number}</CapabilityNumber>
            <CapabilityTag>{cap.tag}</CapabilityTag>
            <CapabilityTitle>{cap.title}</CapabilityTitle>
            <CapabilityBody>{cap.body}</CapabilityBody>
          </CapabilityCard>
        ))}
      </CapabilityGrid>
    </Section>
  )
}
