import { type FC } from 'react'
import styled, { css } from 'styled-components'

export enum ResizableHandleType {
  Right,
  Left,
  Bottom,
  TopRight,
  TopLeft,
  BottomRight,
  BottomLeft,
}

interface ResizableHandleProps extends BaseComponentProps {
  visible: boolean
  handleType: ResizableHandleType
  onResizing?: (e: React.MouseEvent, handleType: ResizableHandleType) => void
}

const ResizableHandleContainer = styled.span<ResizableHandleProps>`
  position: absolute;
  width: 6px;
  height: 6px;
  background: ${(props) => props.theme.accentColor};
  border-radius: 12px;
  border: 2px solid #fff;
  z-index: 99;

  ${(props) => {
    if (props.visible) {
      return css`
        display: inline-block;
        opacity: 1;
      `
    } else {
      return css`
        display: none;
        opacity: 0;
      `
    }
  }}

  ${(props) => {
    switch (props.handleType) {
      case ResizableHandleType.BottomLeft:
        return css`
          left: -6px;
          bottom: -10px;
          cursor: sw-resize;
        `
      case ResizableHandleType.BottomRight:
        return css`
          right: -6px;
          bottom: -10px;
          cursor: se-resize;
        `
      case ResizableHandleType.TopLeft:
        return css`
          left: -6px;
          top: -6px;
          cursor: nw-resize;
        `
      case ResizableHandleType.TopRight:
        return css`
          right: -6px;
          top: -6px;
          cursor: ne-resize;
        `
      default:
        break
    }
  }}
`

export const ResizableHandle: FC<ResizableHandleProps> = (props) => {
  const handleResizing: React.MouseEventHandler = (e) => {
    if (props.onResizing) {
      props.onResizing(e, props.handleType)
    }
  }

  return (
    <ResizableHandleContainer
      className='resizeable-handle'
      visible={props.visible}
      handleType={props.handleType}
      onMouseDown={handleResizing}
    />
  )
}
