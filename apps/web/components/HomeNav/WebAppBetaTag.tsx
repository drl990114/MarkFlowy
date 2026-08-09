import styled from 'styled-components'
import rem from '../../utils/rem'

const WebAppBetaTag = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: ${rem(16)};
  padding: 0 ${rem(5)};
  border-radius: ${rem(999)};
  background: var(--paper);
  color: var(--seal);
  font-family: var(--sans);
  font-size: ${rem(8)};
  font-weight: 800;
  line-height: 1;
  letter-spacing: 0.08em;
  text-transform: uppercase;
`

export default WebAppBetaTag
