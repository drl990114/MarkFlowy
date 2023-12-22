import { type FC } from 'react'
import styled, { css } from 'styled-components'

export enum ResizableHandleType {
  Right,
  Left,
  Top,
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
  border-radius: 12px;
  border: 2px solid #fff;
  background: rgba(0, 0, 0, 0.65);
  border: 1px solid rgba(255, 255, 255, 0.5);
  border-radius: 6px;
  transition: opacity 300ms ease-in 0s;
  z-index: 99;

  ${(props) => {
    if (props.visible) {
      return css`
        opacity: 1;
      `
    } else {
      return css`
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
      case ResizableHandleType.Left:
        return css`
          left: 6px;
          top: calc(50% - 20px);
          height: 30px;
          width: 6px;
          cursor: col-resize;
        `
      case ResizableHandleType.Right:
        return css`
          right: 6px;
          top: calc(50% - 20px);
          height: 30px;
          width: 6px;
          cursor: col-resize;
        `
      case ResizableHandleType.Top:
        return css`
          left: calc(50% - 20px);
          top: 6px;
          height: 6px;
          width: 30px;
          cursor: row-resize;
        `
      case ResizableHandleType.Bottom:
        return css`
          right: calc(50% - 20px);
          bottom: 6px;
          height: 6px;
          width: 30px;
          cursor: row-resize;
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
