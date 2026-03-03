import styled, { css } from 'styled-components'

interface EditorWrapperProps {
  active: boolean
  fullWidth: boolean
}

export const EditorWrapper = styled.div.attrs<EditorWrapperProps>((props) => props)`
  flex: 1;
  height: 100%;
  box-sizing: border-box;
  position: relative;
  display: grid;
  grid-template-columns: 1fr;

  > * {
    grid-column: 1;
    grid-row: 1;
  }

  ${(props) =>
    props.active
      ? css({
          maxWidth: props.fullWidth ? 'auto' : '800px',
          margin: '0 auto',
          paddingBottom: '3rem',
          marginInlineStart: 'auto',
          marginInlineEnd: 'auto',
        })
      : css({
          display: 'none',
        })}
`

export const EditorToc = styled.div`
  position: sticky;
  right: 0;
  top: 0;
  height: 100%;
  overflow: hidden;
  z-index: 5;
  justify-self: end;
  align-self: start;
  margin: 12px 12px 0 0;
  pointer-events: auto;
`
