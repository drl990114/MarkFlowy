import type { ICONSNAME } from '@constants'
import { ICONSMAP } from '@constants'
import classNames from 'classnames'
import type { FC } from 'react'

const Icon: FC<IconProps> = (props) => {
  const IconComponent = ICONSMAP[props.name]

  if (!IconComponent)
    throw new Error(`could not find icon ${props.name}`)

  const cls = classNames('', props.iconProps?.className)
  return <IconComponent className={cls} {...props.iconProps}></IconComponent>
}

interface IconProps {
  name: ICONSNAME
  iconProps?: any
}
export default Icon
