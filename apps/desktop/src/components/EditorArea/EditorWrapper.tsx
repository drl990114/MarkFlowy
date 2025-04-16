import styled, { css } from 'styled-components'

interface EditorWrapperProps {
  active: boolean
  fullWidth: boolean
}

export const EditorWrapper = styled.div.attrs<EditorWrapperProps>((props) => props)`
  min-height: 100%;
  overflow: hidden;

  ${(props) =>
    props.active
      ? css({
          maxWidth: props.fullWidth ? 'auto' : '800px',
          margin: '0 auto',
          padding: '0 20px',
          paddingTop: '6px',
          paddingBottom: '8rem',
          marginInlineStart: 'auto',
          marginInlineEnd: 'auto',
        })
      : css({
          display: 'none',
        })}
`
