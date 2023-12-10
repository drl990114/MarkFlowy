import { MenuWrapper } from './MenuWrapper'
import type { MenuProps as AkMenuProps } from '@ariakit/react'
import { MenuButton, MenuItem, MenuProvider } from '@ariakit/react'
import { MenuItemCheckbox } from './MenuItemCheckbox'

export type MenuItemData = {
  label: string
  keybinding?: string
  value: string
  handler?: () => void
} & {
  label: string
  children?: MenuItemData[]
}

interface MenuProps extends AkMenuProps {
  mode?: 'checkbox'
  checkValue?: Record<string, string[]>
  items: MenuItemData[]
}

const Menu = (props: MenuProps) => {
  const { open, items, mode, style, ...rest } = props

  const ItemRender = mode === 'checkbox' ? MenuItemCheckbox : MenuItem

  const renderItems = (menuItems: MenuItemData[]) => {
    return menuItems.map((item) => {
      const key = item.value

      if (item.children && item.children?.length > 0) {
        return (
          <MenuProvider key={key}>
            <ItemRender
              name='watching'
              value={item.value}
              className='menu-item'
              render={<MenuButton />}
            >
              {item.label}
            </ItemRender>
            <MenuWrapper>{renderItems(item.children)}</MenuWrapper>
          </MenuProvider>
        )
      } else {
        return (
          <ItemRender
            key={key}
            className='menu-item'
            name='watching'
            value={item.value}
            onClick={() => {
              if (item.handler) {
                item.handler()
              }
            }}
          >
            {item.label}
          </ItemRender>
        )
      }
    })
  }

  return (
    <MenuProvider>
      <MenuWrapper style={style} open={open} {...rest}>
        {renderItems(items)}
      </MenuWrapper>
    </MenuProvider>
  )
}

export default Menu
