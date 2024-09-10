import styled from 'styled-components'
import rem from '../../utils/rem'
import { StyledLink } from '../Link'
import { getSections } from 'utils/sections'

export interface SimpleSidebarMenuProps {
  pages?: { title: string; pathname: string; sections: { title: string }[]; href: string }[]
}

export const SimpleSidebarMenu = () => {
  const sections = getSections()
  const keys = Object.keys(sections)
  return (
    <MenuInner>
      {keys.map((key) => {
        const section = sections[key]
        return (
          <Section>
            <SectionTitle>
              <span>{key}</span>
            </SectionTitle>

            {section.map(({ slug, title }) => {
              return (
                <SubSection key={title}>
                  <StyledLink href={`/docs/${slug}`}>{title}</StyledLink>
                </SubSection>
              )
            })}
          </Section>
        )
      })}
    </MenuInner>
  )
}

const MenuInner = styled.div`
  display: block;
  box-sizing: border-box;
  height: 100%;
  padding-top: ${rem(60)};
`

const Section = styled.div`
  margin-bottom: ${rem(20)};
`

const SectionTitle = styled.h4`
  display: block;
  margin: ${rem(10)} ${rem(40)};
`

const SubSection = styled.h5`
  display: block;
  margin: ${rem(10)} ${rem(40)} ${rem(10)} ${rem(55)};
  font-size: 0.9rem;
  font-weight: normal;
`

export interface DocsSidebarMenuProps {}

export const DocsSidebarMenu = () => {
  const sections = getSections()
  const keys = Object.keys(sections)

  return (
    <MenuInner>
      {keys.map((key) => {
        const section = sections[key]

        return (
          <Section key={key}>
            <SectionTitle>
              <span>{key}</span>
            </SectionTitle>

            {section.map(({ slug, title }) => {
              return (
                <SubSection key={title}>
                  <StyledLink href={`/docs/${slug}`}>{title}</StyledLink>
                </SubSection>
              )
            })}
          </Section>
        )
      })}
    </MenuInner>
  )
}
