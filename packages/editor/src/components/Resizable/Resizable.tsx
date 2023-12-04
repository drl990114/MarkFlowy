import styled from 'styled-components'
import { useRef, type FC, useEffect, useCallback, memo } from 'react'
import { throttle } from '@remirror/core-helpers'
import type { NodeViewComponentProps } from '@remirror/react'
import { ResizableHandle, ResizableHandleType } from './ResizableHandle'

export enum ResizableRatioType {
  Fixed,
  Flexible,
}

const ResizableContainer = styled.div`
  display: inline-block;
  position: relative;
  max-width: 100%;
  line-height: 0;
  user-select: none;
  border-radius: 2px;
  transition: all 0.15s ease-out;
`

interface ResizableProps extends BaseComponentProps, NodeViewComponentProps {
  aspectRatio?: ResizableRatioType
  onResize?: (e: React.MouseEvent<Element, MouseEvent>, handleType: ResizableHandleType) => void
}

const MIN_WIDTH = 20

export const Resizable: FC<ResizableProps> = memo((props) => {
  const { node, aspectRatio = ResizableRatioType.Fixed, getPosition, updateAttributes, selected } = props

  const destoryList = useRef<(() => void)[]>([])
  const containerRef = useRef<HTMLDivElement>(null)
  const startWidthRef = useRef(0)
  const startHeightRef = useRef(0)
  const widthRef = useRef(0)
  const heightRef = useRef(0)

  const startResizing = useCallback(
    (e: React.MouseEvent<Element, MouseEvent>, handleType: ResizableHandleType) => {
      e.preventDefault()

      const startX = e.pageX
      const startY = e.pageY
      const startWidth = startWidthRef.current || 0
      const startHeight = startHeightRef.current || 0

      const onMouseMove = throttle(100, false, (event: any) => {
        const currentX = event.pageX
        const currentY = event.pageY
        const diffX = currentX - startX
        const diffY = currentY - startY
        let newWidth: number | null = null
        let newHeight: number | null = null

        if (aspectRatio === ResizableRatioType.Fixed && startWidth && startHeight) {
          switch (handleType) {
            case ResizableHandleType.Right:
            case ResizableHandleType.TopRight:
            case ResizableHandleType.BottomRight:
              newWidth = startWidth + diffX
              newHeight = (startHeight / startWidth) * newWidth!
              break
            case ResizableHandleType.Left:
            case ResizableHandleType.TopLeft:
            case ResizableHandleType.BottomLeft:
              newWidth = startWidth - diffX
              newHeight = (startHeight / startWidth) * newWidth
              break
            case ResizableHandleType.Bottom:
              newHeight = startHeight + diffY
              newWidth = (startWidth / startHeight) * newHeight!
              break
          }
        } else if (aspectRatio === ResizableRatioType.Flexible) {
          switch (handleType) {
            case ResizableHandleType.Right:
              newWidth = startWidth + diffX
              break
            case ResizableHandleType.Left:
              newWidth = startWidth - diffX
              break
            case ResizableHandleType.Bottom:
              newHeight = startHeight + diffY
              break
            case ResizableHandleType.BottomRight:
            case ResizableHandleType.TopRight:
              newWidth = startWidth + diffX
              newHeight = startHeight + diffY
              break
            case ResizableHandleType.BottomLeft:
            case ResizableHandleType.TopLeft:
              newWidth = startWidth - diffX
              newHeight = startHeight + diffY
              break
          }
        }

        if (typeof newWidth === 'number' && newWidth < MIN_WIDTH) {
          if (aspectRatio === ResizableRatioType.Fixed && startWidth && startHeight) {
            newWidth = MIN_WIDTH
            newHeight = (startHeight / startWidth) * newWidth
          } else if (aspectRatio === ResizableRatioType.Flexible) {
            newWidth = MIN_WIDTH
          }
        }

        if (newWidth && containerRef.current) {
          widthRef.current = Math.round(newWidth)
          containerRef.current.style.width = `${widthRef.current}px`
        }

        if (newHeight) {
          heightRef.current = Math.round(newHeight)
        }

        if ((newWidth || newHeight) && containerRef.current) {
          containerRef.current.style.aspectRatio = `${widthRef.current} / ${heightRef.current}`
        }
      })

      const onMouseUp = (event: any) => {
        event.preventDefault()

        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
        const pos = getPosition()
        if (pos) {
          startHeightRef.current = heightRef.current
          startWidthRef.current = widthRef.current

          updateAttributes({
            ...node.attrs,
            width: widthRef.current,
            height: heightRef.current,
          })
        }
      }

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)

      destoryList.current.push(() => document.removeEventListener('mousemove', onMouseMove))
      destoryList.current.push(() => document.removeEventListener('mouseup', onMouseUp))
    },
    [aspectRatio, getPosition, node.attrs, updateAttributes],
  )

  const handleResizing = useCallback(
    (e: React.MouseEvent, handleType: ResizableHandleType) => {
      startResizing(e, handleType)
    },
    [startResizing],
  )

  useEffect(() => {
    if (containerRef.current) {
      const { width, height } = containerRef.current.getBoundingClientRect()
      startWidthRef.current = width
      startHeightRef.current = height
    }

    return () => {
      destoryList.current.forEach((destory) => destory())
      destoryList.current = []
    }
  }, [])

  return (
    <ResizableContainer ref={containerRef}>
      <ResizableHandle
        visible={selected}
        onResizing={handleResizing}
        handleType={ResizableHandleType.BottomLeft}
      />
      <ResizableHandle
        visible={selected}
        onResizing={handleResizing}
        handleType={ResizableHandleType.BottomRight}
      />
      <ResizableHandle
        visible={selected}
        onResizing={handleResizing}
        handleType={ResizableHandleType.TopLeft}
      />
      <ResizableHandle
        visible={selected}
        onResizing={handleResizing}
        handleType={ResizableHandleType.TopRight}
      />
      {props.children}
    </ResizableContainer>
  )
})
