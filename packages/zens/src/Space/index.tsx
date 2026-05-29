import React, { CSSProperties } from 'react'

export type SpaceSize = 'small' | 'middle' | 'large' | number
export type SpaceAlign = 'start' | 'end' | 'center' | 'baseline'
export type SpaceDirection = 'horizontal' | 'vertical'

interface SpaceProps extends BaseComponentProps {
  /**
   * 对齐方式
   */
  align?: SpaceAlign
  /**
   * 间距方向
   */
  direction?: SpaceDirection
  /**
   * 间距大小
   */
  size?: SpaceSize | [SpaceSize, SpaceSize]
  /**
   * 设置分隔符
   */
  split?: React.ReactNode
  /**
   * 是否自动换行，仅在 horizontal 时有效
   */
  wrap?: boolean
}

const getMargin = (size: SpaceSize) => {
  if (typeof size === 'number') {
    return size
  }
  switch (size) {
    case 'small':
      return 8
    case 'middle':
      return 16
    case 'large':
      return 24
    default:
      return 8
  }
}

const Space: React.FC<SpaceProps> = ({
  children,
  size = 'small',
  direction = 'horizontal',
  align,
  split,
  wrap = false,
  style,
  ...rest
}) => {
  const childNodes = React.Children.toArray(children).filter(child => child !== null && child !== undefined)
  if (childNodes.length === 0) return null
  if (childNodes.length === 1 && !split) return <>{childNodes[0]}</>

  const mergedAlign = align || (direction === 'horizontal' ? 'center' : undefined)

  const marginSize = Array.isArray(size) ? size : [size, size]
  const horizontalSize = getMargin(marginSize[0])
  const verticalSize = getMargin(marginSize[1] ?? marginSize[0])

  const containerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: direction === 'vertical' ? 'column' : 'row',
    flexWrap: wrap && direction === 'horizontal' ? 'wrap' : 'nowrap',
    alignItems: mergedAlign,
    ...style
  }

  const itemStyle = (index: number): CSSProperties => {
    const style: CSSProperties = {}
    if (direction === 'vertical') {
      if (index < childNodes.length - 1) {
        style.marginBottom = `${verticalSize}px`
      }
    } else {
      if (index < childNodes.length - 1) {
        style.marginRight = `${horizontalSize}px`
      }
      if (wrap) {
        style.marginBottom = `${verticalSize}px`
      }
    }
    return style
  }

  return (
    <div style={containerStyle} {...rest}>
      {childNodes.map((child, index) => {
        const key = (child as any).key || `space-item-${index}`
        const nodes = []

        if (index > 0 && split) {
          nodes.push(
            <span key={`split-${index}`} style={direction === 'vertical' ? { marginBottom: `${verticalSize}px` } : { marginRight: `${horizontalSize}px` }}>
              {split}
            </span>
          )
        }

        nodes.push(
          <div key={key} style={itemStyle(index)}>
            {child}
          </div>
        )

        return nodes
      })}
    </div>
  )
}

export default Space
