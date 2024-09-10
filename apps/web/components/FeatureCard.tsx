'use client'
import styled, { css } from 'styled-components'
import Image from 'next/image'
import { Feature } from './Feature'
import { mobile } from 'utils/media'
import rem from 'utils/rem'

type FeatureCardProps = {
  feature: Feature
}
const FeatureCard = (props: FeatureCardProps) => {
  const { feature } = props

  return (
    <Container>
      <div className='feature-card__left'>
        <h3>{feature.title}</h3>
        {feature.descs.map((desc) => {
          return <p>{desc}</p>
        })}
      </div>
      <div className='feature-card__right'>
        <Image
          src={feature.img}
          alt='Markflowy'
          width={720}
          height={480}
          style={{ width: '100%', height: 'auto', borderRadius: '8px' }}
        />
      </div>
    </Container>
  )
}

const Container = styled.div`
  display: flex;
  justify-content: space-around;
  align-items: flex-start;
  width: 100%;
  column-gap: 3rem;

  .feature-card {
    &__left {
      flex: 1;
      text-align: left;

      @media screen and (max-width: 1280px) {
        width: 100%;
        height: auto;
      }
    }

    &__right {
      width: 720px;
      height: 480px;

      img {
        width: 100%;
        height: 100%;
      }

      @media screen and (max-width: 1280px) {
        width: 100%;
        height: auto;
        display: flex;
        justify-content: flex-start;

        img {
          max-width: 720px;
          height: auto;
        }
      }
    }
  }

  @media screen and (max-width: 1280px) {
    width: 100%;
    flex-direction: column;
    align-items: center;
  }
`

export default FeatureCard
