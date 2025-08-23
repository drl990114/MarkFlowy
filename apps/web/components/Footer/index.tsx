import { Favorite } from '@styled-icons/material/Favorite/Favorite'
import styled, { css } from 'styled-components'
import { footerHeight } from 'utils/sizes'
import { red } from '../../utils/colors'
import { mobile } from '../../utils/media'
import rem from '../../utils/rem'
import { Content } from '../Layout'
import Link from '../Link'

export default function Footer() {
  return (
    <Wrapper>
      <FooterContent $hero $footer>
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
      </FooterContent>
    </Wrapper>
  )
}

const Wrapper = styled.footer`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  color: ${(props) => props.theme.primaryFontColor};
  background: ${(props) => props.theme.footerBgColor};
  font-size: 16px;
  height: ${rem(footerHeight)};
  box-sizing: border-box;
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

const FooterContent = styled(Content)`

  ${mobile(css`
    padding: ${rem(30)} ${rem(20)} ${rem(30)} ${rem(20)};
  `)};
`
