import { useTranslation } from 'next-i18next'
import styled, { css } from 'styled-components'
import { mobile } from 'utils/media'
import rem from 'utils/rem'
import FeatureCard from './FeatureCard'

const Container = styled.section`
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 20px 0;
  width: 100%;
  max-width: 1380px;

  .feature-cards {
    display: flex;
    flex-direction: column;
    width: 100%;
    padding: 0 ${rem(60)};
    gap: ${rem(60)};
    box-sizing: border-box;

    ${() =>
      mobile(css`
        padding: 0 ${rem(30)};
      `)};
  }
`

export type Feature = {
  title: string
  descs: string[]
  img: string
}

export default function Feature() {
  const { t } = useTranslation()

  const features = [
    {
      title: t('home.features.feature1.title'),
      descs: [t('home.features.feature1.description')],
      img: '/screenshots/sourcecode.png',
    },
    {
      title: t('home.features.feature2.title'),
      descs: [t('home.features.feature2.description')],
      img: '/screenshots/ai.png',
    },
    {
      title: t('home.features.feature3.title'),
      descs: [t('home.features.feature3.description')],
      img: '/screenshots/darkmode.png',
    },
  ]
  return (
    <Container id='feature'>
      <div className='feature-cards'>
        {features.map((feature) => {
          return <FeatureCard key={feature.title} feature={feature} />
        })}
      </div>
    </Container>
  )
}
