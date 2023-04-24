import styled, { css } from 'styled-components'
import { useRemirrorContext } from '@remirror/react'
import type { FC } from 'react'
import React from 'react'

const Container = styled.div<{ codeEditor?: boolean }>`
  position: relative;
  padding: 0 1em;
  white-space: pre-wrap;
  min-height: 100px;
  flex: 1;

  .remirror-is-empty:first-of-type::before {
    position: absolute;
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
  }

  .remirror-floating-popover {
    /* padding: var(--rmr-space-2); */
    padding: 0;
    border: none;
    max-height: calc(100vh - 56px);
  }

  .remirror-positioner {
    position: absolute;
    min-width: 1px;
    min-height: 1px;
    pointer-events: none;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    user-select: none;
    cursor: none;
    z-index: -1;
  }

  .remirror-positioner-widget {
    width: 0;
    height: 0;
    position: absolute;
  }

  ${props =>
    props.codeEditor
    && css`
      padding: 0;
      min-height: unset;

      .remirror-editor {
        height: 100%;
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
