import { useEffect, useState, type ReactNode } from 'react'
import {
  Button as ComponentButton,
  type ButtonProps as ComponentButtonProps,
} from '../components/button'
import { Spinner } from '../components/spinner'
import { cn } from '../lib/cn'

export type ButtonSize = 'small' | 'medium' | 'large'
export type ButtonType = 'default' | 'primary' | 'dashed' | 'text' | 'link'
export type ButtonShape = 'default' | 'rect'

export interface ButtonProps extends Omit<ComponentButtonProps, 'size'> {
  btnType?: ButtonType
  size?: ButtonSize
  shape?: ButtonShape
  danger?: boolean
  ghost?: boolean
  block?: boolean
  loading?: boolean | { delay?: number; icon?: ReactNode }
}

const sizes = { small: 'sm', medium: 'default', large: 'lg' } as const

/** Legacy names adapt to the shared Button; appearance and focus live in the primitive. */
export default function Button({
  btnType = 'default',
  size = 'medium',
  shape = 'default',
  danger = false,
  ghost = false,
  block = false,
  loading,
  children,
  className,
  disabled,
  variant,
  ...props
}: ButtonProps) {
  const [isLoading, setIsLoading] = useState(loading === true)
  const delay = typeof loading === 'object' ? (loading.delay ?? 0) : 0
  const requestedLoading = Boolean(loading)

  useEffect(() => {
    if (!requestedLoading || delay <= 0) {
      setIsLoading(requestedLoading)
      return
    }
    setIsLoading(false)
    const timer = setTimeout(() => setIsLoading(true), delay)
    return () => clearTimeout(timer)
  }, [requestedLoading, delay])

  const resolvedVariant =
    variant ??
    (danger
      ? 'destructive'
      : ghost
        ? 'outline'
        : btnType === 'primary'
          ? 'default'
          : btnType === 'text'
            ? 'ghost'
            : btnType === 'link'
              ? 'link'
              : 'outline')

  return (
    <ComponentButton
      {...props}
      className={cn(
        shape === 'rect' && 'mfc:rounded-none',
        block && 'mfc:w-full',
        btnType === 'dashed' && 'mfc:border-dashed',
        ghost && 'mfc:bg-transparent',
        ghost && danger && 'mfc:border mfc:border-destructive mfc:text-destructive',
        ghost && btnType === 'primary' && !danger && 'mfc:border-primary mfc:text-primary',
        className,
      )}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      data-loading={isLoading}
      size={sizes[size]}
      variant={resolvedVariant}
    >
      {isLoading &&
        (typeof loading === 'object' && loading.icon ? (
          loading.icon
        ) : (
          <Spinner aria-hidden='true' size={size === 'small' ? 12 : size === 'large' ? 16 : 14} />
        ))}
      {children}
    </ComponentButton>
  )
}
