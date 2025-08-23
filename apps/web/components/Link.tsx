import UnstyledLink, { LinkProps as UnstyledLinkProps } from 'next/link';
import React from 'react';
import styled from 'styled-components';
import { lightGrey, red } from '../utils/colors';
import rem from '../utils/rem';

type AnchorProps = JSX.IntrinsicElements['a'];

export interface LinkProps extends UnstyledLinkProps, Omit<AnchorProps, keyof UnstyledLinkProps | 'ref'> {
  inline?: boolean;
  ref?: React.Ref<HTMLAnchorElement>;
  unstyled?: boolean;
  white?: boolean;
  target?: '_self' | '_blank' | '_parent' | '_top';
}

export default function Link({
  ['aria-label']: ariaLabel,
  children,
  className,
  inline,
  title,
  unstyled,
  white,
  target,
  ...rest
}: LinkProps) {
  let Child: keyof JSX.IntrinsicElements | React.ComponentType<any> = StyledLink;

  if (inline) {
    Child = InlineLink;
  } else if (unstyled) {
    Child = 'a';
  }

  let dataAttrs;
  if (white) {
    dataAttrs = { 'data-white': white };
  }

  return (
    <UnstyledLink passHref legacyBehavior {...rest}>
      <Child aria-label={ariaLabel} className={className} title={title} {...dataAttrs} target={target}>
        {children}
      </Child>
    </UnstyledLink>
  );
}

export const StyledLink = styled.a`
  display: inline-block;
  color: inherit;
  cursor: pointer;
  padding: ${rem(2)} ${rem(8)};
  margin: ${rem(-2)} ${rem(-8)};

  @media (min-width: ${1000 / 16}em) {
    border-radius: ${rem(3)};

    &:hover {
      background: ${lightGrey};
    }
  }
`;

export const InlineLink = styled.a.attrs((/* props */) => ({
  target: '_blank',
  rel: 'noopener',
}))`
  cursor: pointer;
  text-decoration: underline;

  &:hover {
    color: ${red};
  }

  &[data-white] {
    color: white !important;
  }
`;
