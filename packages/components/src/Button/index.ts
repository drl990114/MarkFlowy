import styled from 'styled-components'
import { Button as AkButton } from '@ariakit/react'
import { lighten } from '@markflowy/theme'

const Button = styled(AkButton)`
  display: flex;
  user-select: none;
  align-items: center;
  justify-content: center;
  margin: 0;
  white-space: nowrap;
  border-radius: ${(props) => props.theme.smallBorderRadius};
  border-style: none;
  background-color: ${(props) => props.theme.accentColor};
  padding-left: ${(props) => props.theme.midPadding};
  padding-right: ${(props) => props.theme.midPadding};
  padding-top: ${(props) => props.theme.smallPadding};
  padding-bottom: ${(props) => props.theme.smallPadding};
  font-size: 14px;
  color: ${(props) => props.theme.primaryFontColor};
  text-decoration-line: none;
  outline-width: 2px;
  outline-offset: 2px;

  &:hover {
    background-color: ${(props) => lighten(props.theme.accentColor, '0.2')};
  }

  &[aria-disabled='true'] {
    opacity: 0.5;
  }

  &[aria-expanded='true'] {
    background-color: hsl(204 20% 96%);
  }

  &[data-focus-visible] {
    outline-style: solid;
  }

  &:active,
  &[data-active] {
    padding-top: 0.125rem;
    box-shadow:
      inset 0 0 0 1px var(--border),
      inset 0 2px 0 var(--border);
  }
`

export default Button
