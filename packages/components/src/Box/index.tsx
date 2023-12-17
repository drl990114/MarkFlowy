import React, { forwardRef } from 'react'

export interface BoxProps extends BaseComponentProps {
  ref?: React.Ref<any>
}

export const Box = forwardRef<{}, BoxProps>((props, ref) => {
  return <div ref={ref} {...props} />
})
