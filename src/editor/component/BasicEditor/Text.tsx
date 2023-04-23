import styled, { css } from 'styled-components'
import { useRemirrorContext } from '@remirror/react'
import type { FC } from 'react'
import React from 'react'
import { adjustColorOpacity, colors } from '../../theme'

const Container = styled.div<{ codeEditor?: boolean }>`
  position: relative;
  background-color: ${colors.white};
  color: ${colors.dark};
  padding: 0 1em;
  white-space: pre-wrap;
  min-height: 100px;
  flex: 1;

  .remirror-is-empty:first-of-type::before {
    position: absolute;
    color: ${colors.grey2};
    pointer-events: none;
    height: 0;
    font-style: italic;
    content: attr(data-placeholder);
  }

  :not(:first-of-type) {
    border-top-left-radius: 0;
    border-top-right-radius: 0;
    border-top: none;
  }

  .remirror-editor {
    outline: none;

    pre {
      color: ${colors.dark};
      background-color: ${adjustColorOpacity(colors.grey6, 0.5)};
      padding: 1em;
    }
  }

  ${props =>
    props.codeEditor
    && css`
      padding: 0;
      min-height: unset;

      .remirror-editor {
        height: 100%;

        pre {
          margin: 0 !important;
        }
      }
    `}
`

interface ITextProps {
  children?: React.ReactNode
  className?: string
  codeEditor?: boolean
}

const Text: FC<ITextProps> = ({ children, ...props }) => {
  const { getRootProps } = useRemirrorContext()

  return (
    <Container {...props} {...getRootProps()}>
      {children}
    </Container>
  )
}

export default Text