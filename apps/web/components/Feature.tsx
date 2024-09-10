import FeatureCard from './FeatureCard'
import styled, { css } from 'styled-components'
import rem from 'utils/rem'
import { mobile } from 'utils/media'

const Container = styled.section`
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 20px 0;
  width: 100%;

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
  const features = [
    {
      title: 'High availability',
      descs: [
        `MarkFlowy uses the remirror editor, which not only provides high scalability, but also has a great editing experience. And, MarkFlowy supports multiple editing modes, such as 'source code', 'wysiwyg'.`,
      ],
      img: '/screenshots/sourcecode.png',
    },
    {
      title: 'Custom Theme',
      descs: [
        `MarkFlowy comes with a dark theme and supports custom themes. You can also share themes with others.`,
      ],
      img: '/screenshots/darkmode.png',
    },
    {
      title: 'Built-in ChatGPT',
      descs: [
        `Currently supports one-click export of conversations、translate markdown articles and et article abstract, making chatgpt your smart assistant.`,
      ],
      img: '/screenshots/chatgpt.png',
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
