import type { CSSProperties } from 'react'
import { useComponentThemeStyle } from '../Theme/components-theme'
import { cn } from '../lib/cn'

export interface ImageEmptyProps {
  emptyTip?: string
  style?: CSSProperties
  className?: string
  width?: number | string
  height?: number | string
}

export function ImageEmpty({
  emptyTip,
  style,
  className,
  width = 100,
  height = 100,
}: ImageEmptyProps) {
  const themeStyle = useComponentThemeStyle({ width, height, ...style })
  return (
    <div
      data-mf-component=''
      data-slot='image-empty'
      style={themeStyle}
      className={cn(
        'mfc:flex mfc:items-center mfc:justify-center mfc:text-muted-foreground mfc:border mfc:border-border mfc:bg-muted mfc:rounded-sm mfc:text-sm',
        className,
      )}
    >
      {emptyTip || 'Empty source'}
    </div>
  )
}
