import type { BaseComponentProps } from '@types'
import classNames from 'classnames'
import { Fragment, memo, useCallback } from 'react'
import type { FC } from 'react'

const Menu: FC<MenuProps> = (props) => {
  const { menuGroup, onMenuItemClick, className } = props

  const renderMenuGroupItems = useCallback((menu: MenuGroup) => {
    return menu.map((i) => {
      const handleCLick = () => {
        if (typeof onMenuItemClick === 'function')
          onMenuItemClick(i)
      }
      return <li className="label-hover" key={i.key} onClick={handleCLick}>{i.title}</li>
    })
  }, [onMenuItemClick])

  const renderMenuGroup = useCallback(() => {
    return menuGroup.map((group, index) => {
      return <Fragment key={index}>
      {renderMenuGroupItems(group)}
      {index !== menuGroup.length - 1 && <div className="split" />}
      </Fragment>
    })
  }, [menuGroup, renderMenuGroupItems])

  const cls = classNames('w-200px px-2 py-1 bg-bgColor border-1', className)

  return <ul className={cls}>{renderMenuGroup()}</ul>
}

interface MenuProps extends BaseComponentProps {
  menuGroup: MenuGroup[]
  onMenuItemClick?: (item: MenuGroupItem) => void
}

type MenuGroup = MenuGroupItem[]
interface MenuGroupItem {
  title: string
  key: React.Key
}

export default memo(Menu)
