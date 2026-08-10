import { useRemirrorContext } from '@rme-sdk/sdk/react'
import type { CSSProperties, FC } from 'react'
import React, { memo } from 'react'
import { BLOCK_HANDLER_GUTTER_SIZE } from '../../const/block-handler-layout'

const EDITOR_INLINE_PADDING = 'var(--rme-editor-inline-padding, clamp(16px, 5vw, 40px))'

export interface ITextProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode
  className?: string
  style?: CSSProperties
}

const Text: FC<ITextProps> = memo(({ children, ...props }) => {
  const { getRootProps } = useRemirrorContext()

  const { key, ...rootProps } = getRootProps()

  const style = Object.assign(
    {
      position: 'relative',
      paddingBlock: 0,
      paddingLeft: `max(${BLOCK_HANDLER_GUTTER_SIZE}px, ${EDITOR_INLINE_PADDING})`,
      paddingRight: EDITOR_INLINE_PADDING,
    },
    props.style,
  )

  return (
    <div {...rootProps} spellCheck={false} {...props} style={style}>
      {children}
    </div>
  )
})

export default Text
