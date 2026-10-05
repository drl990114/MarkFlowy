import type { ComponentProps } from 'react'
import { useComponentThemeStyle } from '../Theme/components-theme'
import { cn } from '../lib/cn'

export type SpinnerProps = ComponentProps<'span'> & { size?: number | string }

export function Spinner({ className, size = 16, style, ...props }: SpinnerProps) {
  const themeStyle = useComponentThemeStyle({ width: size, height: size, ...style })
  return (
    <span
      {...props}
      data-mf-component=''
      data-slot='spinner'
      className={cn(
        'mfc:inline-block mfc:shrink-0 mfc:animate-spin mfc:rounded-full mfc:border-2 mfc:border-current mfc:border-r-transparent mfc:motion-reduce:animate-none',
        className,
      )}
      style={themeStyle}
    />
  )
}
