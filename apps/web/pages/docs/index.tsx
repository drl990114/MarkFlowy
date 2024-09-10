import styled, { css } from 'styled-components'
import DocsLayout from '../../components/DocsLayout'
import { Header } from '../../components/Layout'
import Link from '../../components/Link'
import { mobile, phone } from '../../utils/media'
import rem from '../../utils/rem'
import { getSections } from 'utils/sections'

export default function Documentation() {
  const sections = getSections()
  const keys = Object.keys(sections)

  return (
    <DocsLayout
      title='Documentation'
      description='Learn how to use styled-components and to style your apps without stress'
    >
      <Row>
        {keys.map((key) => {
          const section = sections[key]
          return (
            <Column key={key}>
              <Header>
                <span>{key}</span>
              </Header>

              {section.map(({ slug, title, _raw }) => {
                return (
                  <SubHeader key={slug}>
                    <Link href={`/docs/${slug}`}>{title}</Link>
                  </SubHeader>
                )
              })}
            </Column>
          )
        })}
      </Row>
    </DocsLayout>
  )
}

const Row = styled.div`
  display: flex;
  flex-flow: row wrap;
`

const Column = styled.div`
  width: 33%;
  max-width: 33%;
  flex-basis: 33%;
  padding-right: ${rem(15)};

  ${mobile(css`
    width: 50%;
    max-width: 50%;
    flex-basis: 50%;
  `)} ${phone(css`
    width: 100%;
    max-width: 100%;
    flex-basis: 100%;
  `)};
`

const SubHeader = styled.h3`
  display: block;
  margin: ${rem(8)} 0;
  font-size: ${rem(18)};
  font-weight: normal;
  font-family: ${(props) => props.theme.fontFamily};
`
