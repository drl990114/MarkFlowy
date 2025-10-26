import styled, { css } from 'styled-components'

interface EditorWrapperProps {
  active: boolean
  fullWidth: boolean
}

export const EditorWrapper = styled.div.attrs<EditorWrapperProps>((props) => props)`
  flex: 1;
  height: 100%;
  overflow: auto;
  box-sizing: border-box;

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
