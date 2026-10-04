import { Children, Fragment, isValidElement, type ComponentProps, type ReactNode } from 'react'
import { cn } from '../lib/cn'
import { useComponentThemeStyle } from '../Theme/components-theme'

export type SpaceSize = 'small' | 'middle' | 'large' | number
export type SpaceAlign = 'start' | 'end' | 'center' | 'baseline'
export type SpaceDirection = 'horizontal' | 'vertical'
export interface SpaceProps extends ComponentProps<'div'> {
  align?: SpaceAlign
  direction?: SpaceDirection
  size?: SpaceSize | [SpaceSize, SpaceSize]
  split?: ReactNode
  wrap?: boolean
}

const pixels = (size: SpaceSize) =>
  typeof size === 'number' ? size : { small: 8, middle: 16, large: 24 }[size]

export default function Space({
  children,
  size = 'small',
  direction = 'horizontal',
  align,
  split,
  wrap = false,
  style,
  className,
  ...props
}: SpaceProps) {
  const nodes = Children.toArray(children)
  const [horizontal, vertical] = Array.isArray(size) ? size : [size, size]
  const themeStyle = useComponentThemeStyle({
    columnGap: pixels(horizontal),
    rowGap: pixels(vertical),
    alignItems: align ?? (direction === 'horizontal' ? 'center' : undefined),
    ...style,
  })
  if (!nodes.length) return null
  if (nodes.length === 1 && !split) return <>{nodes[0]}</>
  return (
    <div
      {...props}
      data-mf-component=''
      data-slot='space'
      className={cn(
        'mfc:flex',
        direction === 'vertical' && 'mfc:flex-col',
        wrap && direction === 'horizontal' && 'mfc:flex-wrap',
        className,
      )}
      style={themeStyle}
    >
      {nodes.map((child, index) => (
        <Fragment key={isValidElement(child) ? (child.key ?? index) : index}>
          {index > 0 && split ? <span>{split}</span> : null}
          {child}
        </Fragment>
      ))}
    </div>
  )
}
