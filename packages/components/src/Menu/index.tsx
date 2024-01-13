import { MenuWrapper } from './MenuWrapper'
import type { MenuProps as AkMenuProps } from '@ariakit/react'
import { MenuButton, MenuItem, MenuProvider, MenuButtonArrow } from '@ariakit/react'

export type MenuItemData = {
  label: string
  keybinding?: string
  value: string
  checked?: boolean
  handler?: () => void
  children?: MenuItemData[]
}

interface MenuProps extends AkMenuProps {
  items: MenuItemData[]
}

const Menu = (props: MenuProps) => {
  const { open, items, style, ...rest } = props

  const renderItems = (menuItems: MenuItemData[]) => {
    return menuItems.map((item) => {
      const key = item.value

      if (item.children && item.children?.length > 0) {
        return (
          <MenuProvider key={key}>
            <MenuItem className='menu-item' render={<MenuButton />}>
              <div className='menu-item__checkicon' />
              <span className='menu-label'>{item.label}</span>
              <MenuButtonArrow />
            </MenuItem>
            <MenuWrapper>{renderItems(item.children)}</MenuWrapper>
          </MenuProvider>
        )
      } else {
        return (
          <MenuItem
            key={key}
            className='menu-item'
            onClick={() => {
              if (item.handler) {
                item.handler()
              }
            }}
          >
            <div className='menu-item__checkicon'>
              {item.checked ? <i className='ri-check-line'></i> : null}
            </div>
            <span className='menu-label'>{item.label}</span>
          </MenuItem>
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
