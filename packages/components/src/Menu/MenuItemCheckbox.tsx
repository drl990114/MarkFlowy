import type { MenuItemCheckboxProps as AkMenuItemCheckboxProps } from '@ariakit/react'
import {
  MenuItemCheck as AkMenuItemCheck,
  MenuItemCheckbox as AkMenuItemCheckbox,
} from '@ariakit/react'
import { forwardRef } from 'react'
import clsx from 'clsx'
import styled from 'styled-components'

type MenuItemOptions = Pick<AkMenuItemCheckboxProps, 'checked' | 'name' | 'value' | 'render'>

interface MenuItemCheckboxProps extends BaseComponentProps, MenuItemOptions {
  children: React.ReactNode
}

const MenuItemCheck = styled(AkMenuItemCheck)``

export const MenuItemCheckbox = forwardRef<HTMLDivElement, MenuItemCheckboxProps>(
  function MenuItemCheckbox(props, ref) {
    return (
      <AkMenuItemCheckbox ref={ref} {...props} className={clsx('menu-item', props.className)}>
        <MenuItemCheck /> {props.children}
      </AkMenuItemCheckbox>
    )
  },
)
