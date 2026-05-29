import React from 'react'

export interface BoxProps extends React.HTMLAttributes<HTMLDivElement> {
  ref?: React.Ref<HTMLDivElement>
}

export const Box = (props: BoxProps) => {
  return <div {...props} />
}
