import { motion } from 'motion/react'
import { useTranslation } from 'next-i18next'
import Image from 'next/image'
import Link from 'next/link'
import styled from 'styled-components'
import rem from 'utils/rem'

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
  gap: ${rem(120)};

  @media (max-width: ${rem(980)}) {
    padding: ${rem(40)} 0;
    gap: ${rem(60)};
  }
`

const Row = styled.div<{ $imagePosition: 'left' | 'right' }>`
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: ${rem(60)};
  width: 100%;
  margin: 0 auto;
  align-items: center;
  border-radius: 6px;
  padding: ${rem(60)} ${rem(48)};
  background-color: ${(props) => props.theme.bgColorSecondary};

  @media (max-width: ${rem(980)}) {
    grid-template-columns: 1fr;
    gap: ${rem(32)};
    padding: ${rem(32)} ${rem(24)};
  }
`

const TextColumn = styled(motion.div)<{ $imagePosition: 'left' | 'right' }>`
  grid-column: ${(props) => (props.$imagePosition === 'right' ? '1 / span 4' : '9 / span 4')};
  display: flex;
  flex-direction: column;
  justify-content: center;

  & > *:first-child {
    margin-top: 0;
  }
  & > *:last-child {
    margin-bottom: 0;
  }

  @media (max-width: ${rem(980)}) {
    grid-column: 1 / -1;
    order: 2;
    text-align: center;
    align-items: center;
  }
`

const ImageColumn = styled(motion.div)<{ $imagePosition: 'left' | 'right' }>`
  grid-column: ${(props) => (props.$imagePosition === 'right' ? '5 / span 8' : '1 / span 8')};
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;

  @media (max-width: ${rem(980)}) {
    grid-column: 1 / -1;
    order: 1;
  }
`

const ImageBackground = styled.div`
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 10;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 10px;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;

  background-color: #1a1a1a;
  background-image: radial-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px);
  background-size: 20px 20px;
`

const Title = styled.h2`
  font-size: ${rem(40)};
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: -0.02em;
  color: #ffffff;
  margin-bottom: ${rem(20)};

  @media (max-width: ${rem(980)}) {
    font-size: ${rem(28)};
  }
`

const Description = styled.p`
  font-size: ${rem(18)};
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: ${rem(24)};

  @media (max-width: ${rem(980)}) {
    font-size: ${rem(16)};
  }
`

const LearnMoreLink = styled(Link)`
  font-size: ${rem(16)};
  color: #ff8c00; /* Adjust to match the brand color if needed */
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: ${rem(8)};
  font-weight: 500;
  transition: opacity 0.2s ease;

  &:hover {
    opacity: 0.8;
  }

  &::after {
    content: '→';
  }
`

const FeatureRow = ({ title, descs, img, imagePosition = 'right', link }: FeatureItemProps) => {
  const childrens = [
    <TextColumn
      $imagePosition={imagePosition}
      initial={{ opacity: 0, x: imagePosition === 'right' ? -20 : 20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
    >
      <Title>{title}</Title>
      {descs.map((desc, index) => (
        <Description key={index}>{desc}</Description>
      ))}
      {link && <LearnMoreLink href={link.href}>{link.text}</LearnMoreLink>}
    </TextColumn>,
    <ImageColumn
      $imagePosition={imagePosition}
      initial={{ opacity: 0, scale: 0.95 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay: 0.2 }}
    >
      <ImageBackground>
        <Image
          src={img}
          alt={title}
          width={800}
          height={500}
          style={{ width: '100%', height: 'auto', display: 'block' }}
        />
      </ImageBackground>
    </ImageColumn>,
  ]
  if (imagePosition === 'left') {
    // childrens 换个顺序
    childrens.reverse()
  }
  return <Row $imagePosition={imagePosition}>{childrens}</Row>
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

  return (
    <Section id='features-list'>
      {features.map((feature, index) => (
        <FeatureRow key={index} {...feature} />
      ))}
    </Section>
  )
}
