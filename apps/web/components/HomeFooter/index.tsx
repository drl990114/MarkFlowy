import { Logo } from 'components/Nav/Logo'
import styled, { css } from 'styled-components'
import { mobile } from '../../utils/media'
import rem from '../../utils/rem'
import Link from '../Link'

const footerLinks = {
  Product: [
    { label: 'Features', href: '/features' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'Changelog', href: '/changelog' },
    { label: 'Roadmap', href: '/roadmap' },
  ],
  Community: [
    { label: 'GitHub', href: 'https://github.com/drl990114/MarkFlowy' },
    { label: 'Contributors', href: 'https://github.com/drl990114/MarkFlowy/graphs/contributors' },
    { label: 'Discord', href: '/discord' },
    { label: 'Twitter', href: 'https://twitter.com/markflowy' },
  ],
  Resources: [
    { label: 'Documentation', href: '/docs' },
    { label: 'API', href: '/docs/api' },
    { label: 'Blog', href: '/blog' },
    { label: 'Support', href: '/support' },
  ],
  Legal: [
    { label: 'Privacy', href: '/privacy' },
    { label: 'Terms', href: '/terms' },
    { label: 'License', href: '/license' },
    { label: 'Security', href: '/security' },
  ],
}

export default function HomeFooter() {
  return (
    <Wrapper>
      <Content>
        <TopSection>
          <BrandColumn>
            <LogoLink href='/'>
              <Logo size={32} />
              <AppName>MarkFlowy</AppName>
            </LogoLink>
            <Tagline>A minimalist markdown editor for focused writing.</Tagline>
            <CopyrightFaint>© 2023-present drl990114. All rights reserved.</CopyrightFaint>
          </BrandColumn>
          <LinkColumns>
            {Object.entries(footerLinks).map(([title, links]) => (
              <LinkColumn key={title}>
                <ColumnTitle>{title}</ColumnTitle>
                <ColumnLinks>
                  {links.map((link) => (
                    <li key={link.label}>
                      <FooterLink href={link.href} unstyled>
                        {link.label}
                      </FooterLink>
                    </li>
                  ))}
                </ColumnLinks>
              </LinkColumn>
            ))}
          </LinkColumns>
        </TopSection>
        <Divider />
        <BottomRow>
          <BottomCopyright>© 2023-present drl990114</BottomCopyright>
          <MadeWith>
            Made with ♥ by{' '}
            <FooterLink href='https://github.com/drl990114' unstyled>
              @drl990114
            </FooterLink>
          </MadeWith>
        </BottomRow>
        <MegaKicker aria-hidden='true'>Flow</MegaKicker>
      </Content>
    </Wrapper>
  )
}

const Wrapper = styled.footer`
  background: var(--ink);
  color: var(--paper);
  border-top: 1px solid var(--on-paper-light-line-soft);
  position: relative;
  overflow: hidden;
`

const Content = styled.div`
  max-width: ${rem(1360)};
  margin: 0 auto;
  padding: ${rem(80)} ${rem(64)} ${rem(40)};
  position: relative;

  ${mobile(css`
    padding: ${rem(48)} ${rem(24)} ${rem(32)};
  `)};
`

const TopSection = styled.div`
  display: flex;
  justify-content: space-between;
  gap: ${rem(64)};

  ${mobile(css`
    flex-direction: column;
    gap: ${rem(48)};
  `)};
`

const BrandColumn = styled.div`
  display: flex;
  flex-direction: column;
  max-width: ${rem(280)};
  flex-shrink: 0;

  ${mobile(css`
    max-width: none;
  `)};
`

const LogoLink = styled.a`
  display: flex;
  align-items: center;
  gap: ${rem(12)};
  text-decoration: none;
  color: var(--paper);
  margin-bottom: ${rem(20)};
`

const AppName = styled.span`
  font-family: var(--sans);
  font-size: ${rem(18)};
  font-weight: 700;
  color: var(--paper);
`

const Tagline = styled.p`
  font-family: var(--body);
  font-size: ${rem(14)};
  color: var(--on-paper-light-muted);
  line-height: 1.6;
  margin: 0 0 ${rem(24)};
`

const CopyrightFaint = styled.span`
  font-family: var(--body);
  font-size: ${rem(12)};
  color: var(--on-paper-light-faint);
`

const LinkColumns = styled.div`
  display: flex;
  gap: ${rem(64)};

  ${mobile(css`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: ${rem(32)};
  `)};
`

const LinkColumn = styled.div`
  display: flex;
  flex-direction: column;
  min-width: ${rem(120)};
`

const ColumnTitle = styled.h4`
  font-family: var(--sans);
  font-size: ${rem(11)};
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  color: var(--on-paper-light-muted);
  margin: 0 0 ${rem(20)};
`

const ColumnLinks = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: ${rem(12)};
`

const FooterLink = styled(Link)`
  font-family: var(--body);
  font-size: ${rem(14)};
  color: var(--on-paper-light-soft);
  text-decoration: none;
  transition: color 0.2s ease;
  display: inline-block;
  padding: 0;
  margin: 0;

  &:hover {
    color: var(--seal);
  }
`

const Divider = styled.div`
  height: 1px;
  background: var(--on-paper-light-line-soft);
  margin: ${rem(48)} 0 ${rem(24)};

  ${mobile(css`
    margin: ${rem(36)} 0 ${rem(20)};
  `)};
`

const BottomRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;

  ${mobile(css`
    flex-direction: column;
    gap: ${rem(8)};
    text-align: center;
  `)};
`

const BottomCopyright = styled.span`
  font-family: var(--body);
  font-size: ${rem(12)};
  color: var(--on-paper-light-faint);
`

const MadeWith = styled.span`
  font-family: var(--body);
  font-size: ${rem(12)};
  color: var(--on-paper-light-faint);
`

const MegaKicker = styled.span`
  font-family: var(--serif);
  font-style: italic;
  font-size: clamp(${rem(80)}, 12vw, ${rem(200)});
  color: var(--on-paper-light-line-soft);
  position: absolute;
  bottom: -0.15em;
  right: 0;
  line-height: 1;
  pointer-events: none;
  user-select: none;
`
