import styled from 'styled-components';
import { resetInput } from '../../utils/form';
import rem from '../../utils/rem';
import { navbarHeight } from '../../utils/sizes';

const NavButton = styled.button`
  ${resetInput};
  background: transparent;
  cursor: pointer;
  flex: 0 0 auto;
  height: ${rem(navbarHeight)};
  padding: 0 ${rem(10)};
  text-align: center;
  transition: all 200ms ease-in-out;
  vertical-align: middle;

  &:hover {
    filter: brightness(0.85);
  }

  &:active {
    filter: brightness(1);
  }

  & + & {
    padding-left: 0;
  }
`;

export default NavButton;
