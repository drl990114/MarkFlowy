import { Favorite } from '@styled-icons/material/Favorite/Favorite'
import { Logo } from 'components/Nav/Logo'
import styled, { css } from 'styled-components'
import { footerHeight } from 'utils/sizes'
import { red } from '../../utils/colors'
import { mobile } from '../../utils/media'
import rem from '../../utils/rem'
import Link from '../Link'

export default function Footer() {
  return (
    <Wrapper>
      <LeftSection>
        <LogoLink href='/'>
          <LogoContainer>
            <Logo size={40} />
          </LogoContainer>
          <AppName>MarkFlowy</AppName>
        </LogoLink>
        <CopyrightText>Copyright © 2023-present drl990114</CopyrightText>
      </LeftSection>
      <RightSection>
        <div>
          {'Hosted on '}
          <FooterLink inline href='https://vercel.com'>
            ▲ Vercel
          </FooterLink>
          <br />
          {'Made with '}
          <Heart />
          {' by '}
          <FooterLink inline href='https://github.com/drl990114'>
            @drl990114
          </FooterLink>
          {' and '}
          <FooterLink inline href='https://github.com/drl990114/MarkFlowy/graphs/contributors'>
            contributors
          </FooterLink>
          {'.'}
        </div>
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
  padding: 0 ${rem(20)};
  font-size: 16px;
  height: ${rem(footerHeight)};
  border-top: 1px solid ${(props) => props.theme.borderColor};
  box-sizing: border-box;

  ${mobile(css`
    padding: ${rem(30)} ${rem(20)} ${rem(30)} ${rem(20)};
    flex-direction: column;
    text-align: center;
    gap: ${rem(20)};
  `)};
`

const Heart = styled(Favorite)`
  display: inline-block;
  width: ${rem(17)};
  color: ${red};
  transform: translateY(-10%);
`

const FooterLink = styled(Link)`
  color: ${(props) => props.theme.primaryFontColor};
`

const CopyrightText = styled.span`
  font-size: ${rem(14)};
  color: ${props => props.theme.unselectedFontColor}
`

const LeftSection = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;

`

const LogoLink = styled.a`
  display: flex;
  align-items: center;
  margin-bottom: ${rem(16)};
  text-decoration: none;
  color: ${(props) => props.theme.primaryFontColor};
  gap: ${rem(16)};
`

const LogoContainer = styled.div`
  width: ${rem(32)};
  height: ${rem(32)};
  display: flex;
  align-items: center;
  justify-content: center;
`

const AppName = styled.span`
  font-size: ${rem(20)};
  font-weight: 600;
  color: ${(props) => props.theme.primaryFontColor};
`

const RightSection = styled.div`
  text-align: right;
  font-size: ${rem(16)};

  ${mobile(css`
    text-align: center;
  `)};
`
