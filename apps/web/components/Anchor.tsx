import { Link as LinkIcon } from '@styled-icons/material';
import styled, { css } from 'styled-components';
import { mobile } from '../utils/media';
import rem from '../utils/rem';
import { Header, SubHeader, TertiaryHeader } from './Layout';

export interface AnchorProps {
  id?: string;
  level?: number;
}

export default function Anchor({ children, level, id, ...props }: React.PropsWithChildren<AnchorProps>) {
  let override = undefined;

  switch (level) {
    case 3:
      override = SubHeader;
      break;
    case 4:
      override = TertiaryHeader;
      break;
    default:
      override = Header;
      break;
  }

  return (
    <AnchorHeader {...props} as={override}>
      <InvisibleAnchor id={id} />

      {children}

      <AnchorPrimitive href={`#${id}`} aria-label={id}>
        <AnchorIcon />
      </AnchorPrimitive>
    </AnchorHeader>
  );
}

const InvisibleAnchor = styled.div.attrs((/* props */) => ({
  'aria-hidden': true,
}))`
  position: relative;
  display: block;
  visibility: hidden;
  height: 0;

  top: ${rem(-70)};

  ${mobile(css`
    top: ${rem(-90)};
  `)};
`;

const AnchorPrimitive = styled.a`
  display: none;
  color: inherit;
  margin-left: ${rem(10)};
`;

const AnchorIcon = styled(LinkIcon).attrs((/* props */) => ({
  width: null,
  height: null,
}))`
  width: ${rem(20)};
  opacity: 0.7;
  margin-top: ${rem(-5)};

  &:hover {
    opacity: 0.9;
  }
`;

const AnchorHeader = styled.div`
  position: relative;

  ${mobile(css`
    /* stylelint-disable-next-line */
    ${AnchorPrimitive} {
      display: inline-block;
    }
  `)}

  &:hover ${AnchorPrimitive} {
    display: inline-block;
  }
`;
