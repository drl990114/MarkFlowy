import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useTranslation } from '@/i18n'
import { convertFileSrc } from '@tauri-apps/api/core'
import { Maximize2Icon, ZoomInIcon, ZoomOutIcon } from 'lucide-react'
import { type ReactNode, useCallback, useRef, useState } from 'react'
import useResizeObserver from 'use-resize-observer'

interface ImagePreviewProps {
  filePath?: string
}

interface ImageSize {
  width: number
  height: number
}

interface ImagePreviewToolButtonProps {
  children: ReactNode
  disabled?: boolean
  label: string
  onClick: () => void
  pressed?: boolean
}

const MIN_SCALE = 0.1
const MAX_SCALE = 4
const ZOOM_LEVELS = [MIN_SCALE, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, MAX_SCALE]
const SCALE_EPSILON = 0.001
const VIEWPORT_HORIZONTAL_PADDING = 48
const VIEWPORT_VERTICAL_PADDING = 48

function getFitScale(imageSize: ImageSize | null, viewportWidth: number, viewportHeight: number) {
  if (!imageSize || viewportWidth <= 0 || viewportHeight <= 0) return 1

  const availableWidth = Math.max(viewportWidth - VIEWPORT_HORIZONTAL_PADDING, 1)
  const availableHeight = Math.max(viewportHeight - VIEWPORT_VERTICAL_PADDING, 1)

  return Math.max(
    0.01,
    Math.min(1, availableWidth / imageSize.width, availableHeight / imageSize.height),
  )
}

function getNextScale(currentScale: number, fitScale: number, direction: 'in' | 'out') {
  const candidates = [...ZOOM_LEVELS, fitScale].sort((left, right) => left - right)

  if (direction === 'in') {
    return candidates.find((scale) => scale > currentScale + SCALE_EPSILON) ?? MAX_SCALE
  }

  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    if (candidates[index] < currentScale - SCALE_EPSILON) return candidates[index]
  }

  return Math.min(MIN_SCALE, fitScale)
}

function ImagePreviewToolButton({
  children,
  disabled = false,
  label,
  onClick,
  pressed,
}: ImagePreviewToolButtonProps) {
  const button = (
    <Button
      aria-disabled={disabled}
      aria-label={label}
      aria-pressed={pressed}
      className='size-7 rounded-sm aria-disabled:cursor-default aria-disabled:text-disabled-foreground aria-disabled:opacity-60 aria-disabled:hover:bg-transparent aria-disabled:hover:text-disabled-foreground'
      onClick={disabled ? undefined : onClick}
      size='icon-sm'
      variant={pressed ? 'secondary' : 'ghost'}
    >
      {children}
    </Button>
  )

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side='top'>{label}</TooltipContent>
    </Tooltip>
  )
}

function ImageViewer({ src, fileName }: { src: string; fileName: string }) {
  const { t } = useTranslation()
  const viewportRef = useRef<HTMLDivElement>(null)
  const [imageSize, setImageSize] = useState<ImageSize | null>(null)
  const [zoom, setZoom] = useState<number | 'fit'>('fit')
  const { ref: resizeObserverRef, width = 0, height = 0 } = useResizeObserver<HTMLDivElement>()
  const setViewportRef = useCallback(
    (element: HTMLDivElement | null) => {
      viewportRef.current = element
      resizeObserverRef(element)
    },
    [resizeObserverRef],
  )

  const fitScale = getFitScale(imageSize, width, height)
  const scale = zoom === 'fit' ? fitScale : zoom
  const scaledWidth = imageSize ? imageSize.width * scale : 0
  const scaledHeight = imageSize ? imageSize.height * scale : 0
  const zoomPercentage = `${Math.round(scale * 100)}%`

  const updateZoom = (nextZoom: number | 'fit') => {
    const viewport = viewportRef.current
    const horizontalCenter = viewport
      ? (viewport.scrollLeft + viewport.clientWidth / 2) / Math.max(viewport.scrollWidth, 1)
      : 0.5
    const verticalCenter = viewport
      ? (viewport.scrollTop + viewport.clientHeight / 2) / Math.max(viewport.scrollHeight, 1)
      : 0.5

    setZoom(nextZoom)

    requestAnimationFrame(() => {
      if (!viewport) return

      viewport.scrollLeft = Math.max(
        0,
        viewport.scrollWidth * horizontalCenter - viewport.clientWidth / 2,
      )
      viewport.scrollTop = Math.max(
        0,
        viewport.scrollHeight * verticalCenter - viewport.clientHeight / 2,
      )
    })
  }

  const zoomOutLabel = t('image_preview.zoom_out')
  const zoomInLabel = t('image_preview.zoom_in')
  const actualSizeLabel = t('image_preview.actual_size')
  const fitToWindowLabel = t('image_preview.fit_to_window')
  const minimumScale = Math.min(MIN_SCALE, fitScale)

  const updateZoomBy = (direction: 'in' | 'out') => {
    const nextScale = getNextScale(scale, fitScale, direction)
    updateZoom(Math.abs(nextScale - fitScale) < SCALE_EPSILON ? 'fit' : nextScale)
  }

  return (
    <div
      className='grid h-full min-h-0 min-w-0 grid-rows-[minmax(0,1fr)_36px] overflow-hidden bg-muted/20'
      data-slot='image-preview'
    >
      <div
        ref={setViewportRef}
        className='min-h-0 min-w-0 overflow-auto overscroll-contain'
        data-slot='image-preview-viewport'
      >
        <div
          className='box-border flex min-h-full min-w-full items-center justify-center p-6'
          data-slot='image-preview-stage'
          style={
            imageSize
              ? {
                  height: Math.max(height, scaledHeight + VIEWPORT_VERTICAL_PADDING),
                  width: Math.max(width, scaledWidth + VIEWPORT_HORIZONTAL_PADDING),
                }
              : undefined
          }
        >
          <img
            alt={fileName}
            className='block max-w-none shrink-0 rounded-sm border border-border/50 bg-background object-contain shadow-sm'
            decoding='async'
            draggable={false}
            onLoad={(event) => {
              const { naturalHeight, naturalWidth } = event.currentTarget
              if (naturalWidth > 0 && naturalHeight > 0) {
                setImageSize({ height: naturalHeight, width: naturalWidth })
              }
            }}
            src={src}
            style={{
              height: imageSize ? scaledHeight : undefined,
              visibility: imageSize && width > 0 && height > 0 ? 'visible' : 'hidden',
              width: imageSize ? scaledWidth : undefined,
            }}
          />
        </div>
      </div>

      <div
        className='flex min-w-0 items-center justify-center border-t border-border bg-background px-2 text-foreground'
        data-slot='image-preview-footer'
      >
        <div
          aria-label={t('image_preview.toolbar')}
          className='flex items-center gap-0.5'
          data-slot='image-preview-toolbar'
          role='toolbar'
        >
          <ImagePreviewToolButton
            disabled={scale <= minimumScale + SCALE_EPSILON}
            label={zoomOutLabel}
            onClick={() => updateZoomBy('out')}
          >
            <ZoomOutIcon aria-hidden='true' className='size-4' />
          </ImagePreviewToolButton>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label={actualSizeLabel}
                aria-pressed={zoom === 1}
                className='h-7 min-w-12 rounded-sm px-2 tabular-nums'
                onClick={() => updateZoom(1)}
                size='sm'
                variant={zoom === 1 ? 'secondary' : 'ghost'}
              >
                {zoomPercentage}
              </Button>
            </TooltipTrigger>
            <TooltipContent side='top'>{actualSizeLabel}</TooltipContent>
          </Tooltip>

          <ImagePreviewToolButton
            disabled={scale >= MAX_SCALE - SCALE_EPSILON}
            label={zoomInLabel}
            onClick={() => updateZoomBy('in')}
          >
            <ZoomInIcon aria-hidden='true' className='size-4' />
          </ImagePreviewToolButton>

          <div aria-hidden='true' className='mx-0.5 h-4 w-px bg-border' />

          <ImagePreviewToolButton
            label={fitToWindowLabel}
            onClick={() => updateZoom('fit')}
            pressed={zoom === 'fit'}
          >
            <Maximize2Icon aria-hidden='true' className='size-4' />
          </ImagePreviewToolButton>
        </div>
      </div>
    </div>
  )
}

export function ImagePreview({ filePath }: ImagePreviewProps) {
  if (!filePath) return null

  const src = convertFileSrc(filePath)
  const fileName = filePath.split(/[\\/]/).pop() || filePath

  return (
    <div className='absolute inset-0 overflow-hidden' data-slot='image-preview-frame'>
      <ImageViewer key={src} fileName={fileName} src={src} />
    </div>
  )
}
