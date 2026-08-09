import type { NodeViewComponentProps } from '@rme-sdk/sdk/react'
import { memo, useCallback, useEffect, useRef, useState, type FC } from 'react'
import styled, { css } from 'styled-components'
import { ResizableHandle, ResizableHandleType } from './ResizableHandle'

export enum ResizableRatioType {
  Fixed,
  Flexible,
}

export interface ResizableDimensions {
  height: number
  width: number
}

interface CalculateDimensionsOptions {
  aspectRatio: ResizableRatioType
  deltaX: number
  deltaY: number
  handleType: ResizableHandleType
  maxWidth?: number
  minSize?: number
  startHeight: number
  startWidth: number
}

const MIN_SIZE = 20

export function calculateResizableDimensions({
  aspectRatio,
  deltaX,
  deltaY,
  handleType,
  maxWidth,
  minSize = MIN_SIZE,
  startHeight,
  startWidth,
}: CalculateDimensionsOptions): ResizableDimensions {
  const isLeft =
    handleType === ResizableHandleType.Left ||
    handleType === ResizableHandleType.TopLeft ||
    handleType === ResizableHandleType.BottomLeft
  const isRight =
    handleType === ResizableHandleType.Right ||
    handleType === ResizableHandleType.TopRight ||
    handleType === ResizableHandleType.BottomRight
  const isTop =
    handleType === ResizableHandleType.Top ||
    handleType === ResizableHandleType.TopLeft ||
    handleType === ResizableHandleType.TopRight
  const isBottom =
    handleType === ResizableHandleType.Bottom ||
    handleType === ResizableHandleType.BottomLeft ||
    handleType === ResizableHandleType.BottomRight

  let width = startWidth + (isLeft ? -deltaX : isRight ? deltaX : 0)
  let height = startHeight + (isTop ? -deltaY : isBottom ? deltaY : 0)

  if (aspectRatio === ResizableRatioType.Fixed && startWidth > 0 && startHeight > 0) {
    const ratio = startHeight / startWidth

    if (handleType === ResizableHandleType.Top || handleType === ResizableHandleType.Bottom) {
      height = Math.max(minSize, height)
      width = height / ratio
    } else {
      width = Math.max(minSize, width)
      height = width * ratio
    }
  } else {
    width = Math.max(minSize, width)
    height = Math.max(minSize, height)
  }

  if (maxWidth && width > maxWidth) {
    if (aspectRatio === ResizableRatioType.Fixed && width > 0) {
      height *= maxWidth / width
    }
    width = maxWidth
  }

  return {
    height: Math.round(height),
    width: Math.round(width),
  }
}

const ResizableContainer = styled.div<{ $selected: boolean }>`
  display: inline-flex;
  position: relative;
  max-width: 100%;
  border-radius: ${(props) => props.theme.smallBorderRadius};
  outline: 2px solid transparent;
  outline-offset: 2px;
  user-select: none;
  vertical-align: bottom;
  -webkit-user-select: none;

  ${(props) =>
    props.$selected &&
    css`
      outline-color: ${props.theme.accentColor};
    `}

  &[data-resize-state='true'] {
    cursor: nwse-resize;
  }

  &[data-resize-state='true'] .rme-resizable-handle {
    opacity: 1;
    pointer-events: auto;
  }

  & > img,
  & > iframe {
    border-radius: inherit;
  }
`

type ResizeAttributes = Parameters<NodeViewComponentProps['updateAttributes']>[0]

interface ResizableProps extends BaseComponentProps, NodeViewComponentProps {
  selected: boolean
  aspectRatio?: ResizableRatioType
  defaultSize?: { width: number; height: number }
  controlInit?: (init: () => void) => void
  getResizeAttributes?: (dimensions: ResizableDimensions) => ResizeAttributes
}

interface ResizeSession {
  cleanup: () => void
}

function toCssSize(value: unknown): string | undefined {
  if (typeof value === 'number') return `${value}px`
  if (typeof value === 'string' && value)
    return /^\d+(?:\.\d+)?$/.test(value) ? `${value}px` : value
  return undefined
}

export const Resizable: FC<ResizableProps> = memo((props) => {
  const {
    node,
    aspectRatio = ResizableRatioType.Fixed,
    defaultSize,
    updateAttributes,
    selected,
    controlInit,
    getResizeAttributes,
    view,
  } = props

  const [inNode, setInNode] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const currentWidthRef = useRef(0)
  const currentHeightRef = useRef(0)
  const resizeSessionRef = useRef<ResizeSession | null>(null)

  const initializeDimensions = useCallback(() => {
    if (!containerRef.current) return
    const { width, height } = containerRef.current.getBoundingClientRect()
    currentWidthRef.current = width
    currentHeightRef.current = height
  }, [])

  const startResizing = useCallback(
    (event: React.PointerEvent<Element>, handleType: ResizableHandleType) => {
      event.preventDefault()
      event.stopPropagation()
      resizeSessionRef.current?.cleanup()

      const container = containerRef.current
      const target = event.currentTarget
      if (!container || !(target instanceof HTMLElement)) return

      const rect = container.getBoundingClientRect()
      const startWidth = currentWidthRef.current || rect.width
      const startHeight = currentHeightRef.current || rect.height
      if (!startWidth || !startHeight) return

      const pointerId = event.pointerId
      const startX = event.clientX
      const startY = event.clientY
      const editorWidth = view.dom.getBoundingClientRect().width
      let latestX = startX
      let latestY = startY
      let frameId: number | null = null
      let active = true

      const applyLatestDimensions = () => {
        frameId = null
        if (!active) return

        const dimensions = calculateResizableDimensions({
          aspectRatio,
          deltaX: latestX - startX,
          deltaY: latestY - startY,
          handleType,
          maxWidth: editorWidth || undefined,
          startHeight,
          startWidth,
        })

        currentWidthRef.current = dimensions.width
        currentHeightRef.current = dimensions.height
        container.style.width = `${dimensions.width}px`
        container.style.height = `${dimensions.height}px`
      }

      const flushPendingFrame = () => {
        if (frameId !== null) {
          cancelAnimationFrame(frameId)
          frameId = null
        }
        applyLatestDimensions()
      }

      const restoreStartingDimensions = () => {
        currentWidthRef.current = startWidth
        currentHeightRef.current = startHeight
        container.style.width = `${startWidth}px`
        container.style.height = `${startHeight}px`
      }

      const onPointerMove = (pointerEvent: PointerEvent) => {
        if (!active || pointerEvent.pointerId !== pointerId) return
        pointerEvent.preventDefault()
        latestX = pointerEvent.clientX
        latestY = pointerEvent.clientY

        if (frameId === null) {
          frameId = requestAnimationFrame(applyLatestDimensions)
        }
      }

      const cleanup = () => {
        if (!active) return
        active = false
        if (frameId !== null) cancelAnimationFrame(frameId)
        target.removeEventListener('pointermove', onPointerMove)
        target.removeEventListener('pointerup', onPointerUp)
        target.removeEventListener('pointercancel', onPointerCancel)
        target.removeEventListener('lostpointercapture', onLostPointerCapture)
        document.removeEventListener('pointermove', onPointerMove)
        document.removeEventListener('pointerup', onPointerUp)
        document.removeEventListener('pointercancel', onPointerCancel)
        try {
          if (target.hasPointerCapture?.(pointerId)) target.releasePointerCapture(pointerId)
        } catch {
          // The browser may have already released capture during cancellation.
        }
        container.dataset.resizeState = 'false'
        resizeSessionRef.current = null
      }

      const finishResize = (pointerEvent: PointerEvent, commit: boolean) => {
        if (!active || pointerEvent.pointerId !== pointerId) return
        pointerEvent.preventDefault()
        pointerEvent.stopPropagation()
        latestX = pointerEvent.clientX
        latestY = pointerEvent.clientY
        if (commit) {
          flushPendingFrame()
        } else {
          restoreStartingDimensions()
        }

        const dimensions = {
          height: currentHeightRef.current,
          width: currentWidthRef.current,
        }
        const extraAttributes = getResizeAttributes?.(dimensions) ?? {}
        cleanup()

        if (commit) {
          updateAttributes({
            height: dimensions.height,
            width: dimensions.width,
            ...extraAttributes,
          })
        }
      }

      function onPointerUp(pointerEvent: PointerEvent) {
        finishResize(pointerEvent, true)
      }

      function onPointerCancel(pointerEvent: PointerEvent) {
        finishResize(pointerEvent, false)
      }

      function onLostPointerCapture(pointerEvent: PointerEvent) {
        if (active && pointerEvent.pointerId === pointerId) {
          restoreStartingDimensions()
          cleanup()
        }
      }

      container.dataset.resizeState = 'true'
      target.addEventListener('pointermove', onPointerMove)
      target.addEventListener('pointerup', onPointerUp)
      target.addEventListener('pointercancel', onPointerCancel)
      target.addEventListener('lostpointercapture', onLostPointerCapture)
      const attachDocumentFallback = () => {
        target.removeEventListener('pointermove', onPointerMove)
        target.removeEventListener('pointerup', onPointerUp)
        target.removeEventListener('pointercancel', onPointerCancel)
        document.addEventListener('pointermove', onPointerMove)
        document.addEventListener('pointerup', onPointerUp)
        document.addEventListener('pointercancel', onPointerCancel)
      }
      if (target.setPointerCapture) {
        try {
          target.setPointerCapture(pointerId)
        } catch {
          attachDocumentFallback()
        }
      } else {
        attachDocumentFallback()
      }
      resizeSessionRef.current = { cleanup }
    },
    [aspectRatio, getResizeAttributes, updateAttributes, view.dom],
  )

  useEffect(() => {
    if (controlInit) {
      controlInit(initializeDimensions)
    } else {
      initializeDimensions()
    }

    return () => resizeSessionRef.current?.cleanup()
  }, [controlInit, initializeDimensions])

  const handleVisible = selected || inNode
  const width = toCssSize(node.attrs.width ?? defaultSize?.width)
  const height = toCssSize(node.attrs.height ?? defaultSize?.height)

  return (
    <ResizableContainer
      $selected={selected}
      data-rme-resizable='true'
      data-resize-state='false'
      ref={containerRef}
      style={{ height, width }}
      onPointerEnter={() => setInNode(true)}
      onPointerLeave={() => setInNode(false)}
    >
      <ResizableHandle
        visible={handleVisible}
        selected={selected}
        onResizing={startResizing}
        handleType={ResizableHandleType.TopLeft}
      />
      <ResizableHandle
        visible={handleVisible}
        selected={selected}
        onResizing={startResizing}
        handleType={ResizableHandleType.TopRight}
      />
      <ResizableHandle
        visible={handleVisible}
        selected={selected}
        onResizing={startResizing}
        handleType={ResizableHandleType.BottomLeft}
      />
      <ResizableHandle
        visible={handleVisible}
        selected={selected}
        onResizing={startResizing}
        handleType={ResizableHandleType.BottomRight}
      />
      {props.children}
    </ResizableContainer>
  )
})
