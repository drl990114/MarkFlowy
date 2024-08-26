import React from 'react';
import styled from 'styled-components';
import { Github } from '@styled-icons/fa-brands';
import rem from '../../utils/rem';
import { navbarHeight } from '../../utils/sizes';
import Link from '../Link';

const Wrapper = styled.nav`
  display: flex;
  align-items: center;
  flex: 1 1 auto;
`;

const SocialLink = styled(Link).attrs((/* props */) => ({
  unstyled: true,
}))`
  display: flex;
  margin-right: ${rem(20)};
  line-height: ${rem(navbarHeight)};
  transition: opacity 0.2s, transform 0.2s;
  cursor: pointer;

  &:last-child {
    margin-right: 0;
  }

  &:hover,
  &:focus {
    opacity: 0.8;
  }

  &:active {
    transform: scale(0.95);
    opacity: 0.6;
  }

  svg {
    path {
      fill: currentColor;
    }
  }
`;

const StyledIcon = styled.div<{ $height?: number; $width?: number }>`
  && {
    width: ${p => rem(Number(p.$width))};
    height: ${p => rem(Number(p.$height))};
  }
`;

const Social = (props: React.ComponentProps<typeof Wrapper>) => (
  <Wrapper {...props}>
    <SocialLink href="https://github.com/drl990114/MarkFlowy" title="GitHub: Source code" target="_blank">
      <StyledIcon as={Github} $height={24} />
    </SocialLink>
  </Wrapper>
);

export default Social;
