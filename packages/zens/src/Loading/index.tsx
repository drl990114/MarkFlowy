import type { CSSProperties } from 'react'
import { Spinner, type SpinnerProps } from '../components/spinner'
import { cn } from '../lib/cn'

export interface LoadingProps extends SpinnerProps {
  color?: string
  loading?: boolean
  speedMultiplier?: number
  cssOverride?: CSSProperties
}

export function Loading({
  color,
  loading = true,
  speedMultiplier = 1,
  cssOverride,
  style,
  className,
  ...props
}: LoadingProps) {
  if (!loading) return null
  return (
    <Spinner
      aria-label='Loading'
      role='status'
      {...props}
      className={cn('mfc:text-primary', className)}
      style={{
        color,
        animationDuration: `${1 / Math.max(speedMultiplier, 0.01)}s`,
        ...cssOverride,
        ...style,
      }}
    />
  )
}
