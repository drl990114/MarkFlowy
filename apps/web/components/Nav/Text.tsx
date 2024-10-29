import styled, { css } from 'styled-components';
import { mobile } from '../../utils/media';
import rem from '../../utils/rem';

const Text = styled.div`
  display: none;
  margin-left: ${rem(15)};
  margin-top: ${rem(5)};
  font-size: ${rem(18)};

  ${mobile(css`
    display: block;
  `)};
`;

export default Text;
