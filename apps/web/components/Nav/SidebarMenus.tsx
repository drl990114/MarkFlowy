import { useTranslation } from 'next-i18next'
import { useRouter } from 'next/router'
import styled from 'styled-components'
import { getSections } from 'utils/sections'
import rem from '../../utils/rem'
import Link from '../Link'

export interface SimpleSidebarMenuProps {
  pages?: { title: string; pathname: string; sections: { title: string }[]; href: string }[]
}

export const SimpleSidebarMenu = () => {
  const router = useRouter()
  const currentLocale = router.locale || 'en'
  const sections = getSections(currentLocale)
  const { t } = useTranslation()
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
                  <Link href={`/docs${slug}`}>{t(`fileTitle.${title}`)}</Link>
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
  const router = useRouter()
  const currentLocale = router.locale || 'en'
  const sections = getSections(currentLocale)
  const keys = Object.keys(sections)
  const { t } = useTranslation()

  return (
    <MenuInner>
      {keys.map((key) => {
        const section = sections[key]

        return (
          <Section key={key}>
            <SectionTitle>
              <span>{t(`fileTitle.${key}`)}</span>
            </SectionTitle>

            {section.map(({ slug, title }) => {
              return (
                <SubSection key={title}>
                  <Link href={`/docs${slug}`}>{t(`fileTitle.${title}`)}</Link>
                </SubSection>
              )
            })}
          </Section>
        )
      })}
    </MenuInner>
  )
}
