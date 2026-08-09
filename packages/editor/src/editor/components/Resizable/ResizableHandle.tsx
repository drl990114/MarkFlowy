import { type FC } from 'react'
import styled, { css } from 'styled-components'
import { editorZIndex } from '../../theme/z-index'

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
  selected?: boolean
  onResizing?: (event: React.PointerEvent, handleType: ResizableHandleType) => void
}

const ResizableHandleContainer = styled.span<{
  $handleType: ResizableHandleType
  $selected: boolean
  $visible: boolean
}>`
  position: absolute;
  width: 20px;
  height: 20px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  opacity: ${(props) => (props.$visible ? 1 : 0)};
  pointer-events: ${(props) => (props.$visible ? 'auto' : 'none')};
  touch-action: none;
  transition: opacity 120ms ease-out;
  z-index: ${editorZIndex.resizableHandle};

  &::after {
    content: '';
    position: absolute;
    inset: 5px;
    box-sizing: border-box;
    border: 2px solid ${(props) => props.theme.accentColor};
    border-radius: 50%;
    background: ${(props) => props.theme.bgColor};
    box-shadow: 0 1px 3px ${(props) => props.theme.boxShadowColor};
    transform: scale(${(props) => (props.$selected ? 1 : 0.82)});
    transition: transform 120ms ease-out;
  }

  ${(props) => {
    switch (props.$handleType) {
      case ResizableHandleType.BottomLeft:
        return css`
          left: -10px;
          bottom: -10px;
          cursor: sw-resize;
        `
      case ResizableHandleType.BottomRight:
        return css`
          right: -10px;
          bottom: -10px;
          cursor: se-resize;
        `
      case ResizableHandleType.TopLeft:
        return css`
          left: -10px;
          top: -10px;
          cursor: nw-resize;
        `
      case ResizableHandleType.TopRight:
        return css`
          right: -10px;
          top: -10px;
          cursor: ne-resize;
        `
      case ResizableHandleType.Left:
        return css`
          left: -10px;
          top: calc(50% - 10px);
          cursor: col-resize;
        `
      case ResizableHandleType.Right:
        return css`
          right: -10px;
          top: calc(50% - 10px);
          cursor: col-resize;
        `
      case ResizableHandleType.Top:
        return css`
          left: calc(50% - 10px);
          top: -10px;
          cursor: row-resize;
        `
      case ResizableHandleType.Bottom:
        return css`
          left: calc(50% - 10px);
          bottom: -10px;
          cursor: row-resize;
        `
    }
  }}

  @media (prefers-reduced-motion: reduce) {
    transition: none;

    &::after {
      transition: none;
    }
  }
`

export const ResizableHandle: FC<ResizableHandleProps> = (props) => {
  return (
    <ResizableHandleContainer
      $handleType={props.handleType}
      $selected={!!props.selected}
      $visible={props.visible}
      aria-hidden='true'
      className='rme-resizable-handle'
      contentEditable={false}
      onPointerDown={(event) => props.onResizing?.(event, props.handleType)}
    />
  )
}
