import { useRemirrorContext } from '@rme-sdk/react'
import type { CSSProperties, FC } from 'react'
import React, { memo } from 'react'

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
      padding: '0 40px'
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
