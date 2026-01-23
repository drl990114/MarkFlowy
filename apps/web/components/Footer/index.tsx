import { Logo } from 'components/Nav/Logo'
import styled, { css } from 'styled-components'
import { mobile } from '../../utils/media'
import rem from '../../utils/rem'
import Link from '../Link'

export default function Footer() {
  return (
    <Wrapper>
      <LeftSection>
        <Brand href='/'>
          <Logo size={24} />
          <AppName>MarkFlowy</AppName>
        </Brand>
        <CopyrightText>
          ©2023 - present . All rights reserved.
        </CopyrightText>
      </LeftSection>

      <RightSection>
        <Nav>
          <FooterLink href='https://github.com/drl990114/MarkFlowy' target='_blank'>
            GitHub
          </FooterLink>
          <FooterLink href='https://github.com/drl990114/MarkFlowy/graphs/contributors' target='_blank'>
            Contributors
          </FooterLink>
          <FooterLink href='https://vercel.com' target='_blank'>
            Vercel
          </FooterLink>
        </Nav>
      </RightSection>
    </Wrapper>
  )
}

const Wrapper = styled.footer`
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: ${(props) => props.theme.primaryFontColor};
  background: ${(props) => props.theme.footerBgColor};
  padding: 0 ${rem(40)};
  height: ${rem(80)};
  border-top: 1px solid ${(props) => props.theme.borderColor};
  box-sizing: border-box;

  ${mobile(css`
    height: auto;
    padding: ${rem(40)} ${rem(20)};
    flex-direction: column;
    gap: ${rem(24)};
    text-align: center;
  `)};
`

const LeftSection = styled.div`
  display: flex;
  align-items: center;
  gap: ${rem(24)};

  ${mobile(css`
    flex-direction: column;
    gap: ${rem(12)};
  `)};
`

const Brand = styled.a`
  display: flex;
  align-items: center;
  gap: ${rem(10)};
  text-decoration: none;
  color: ${(props) => props.theme.primaryFontColor};
  transition: opacity 0.2s;

  &:hover {
    opacity: 0.8;
  }
`

const AppName = styled.span`
  font-size: ${rem(18)};
  font-weight: 600;
  letter-spacing: -0.01em;
`

const CopyrightText = styled.span`
  font-size: ${rem(13)};
  color: ${(props) => props.theme.unselectedFontColor};

  ${mobile(css`
    font-size: ${rem(12)};
  `)};
`

const RightSection = styled.div`
  display: flex;
  align-items: center;
`

const Nav = styled.nav`
  display: flex;
  gap: ${rem(24)};

  ${mobile(css`
    gap: ${rem(16)};
  `)};
`

const FooterLink = styled(Link)`
  font-size: ${rem(14)};
  color: ${(props) => props.theme.unselectedFontColor};
  transition: color 0.2s;
  text-decoration: none;

  &:hover {
    color: ${(props) => props.theme.primaryFontColor};
  }
`
