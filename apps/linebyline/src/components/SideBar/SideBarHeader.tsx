import type { TooltipProps } from '@mui/material'
import { Tooltip } from '@mui/material'
import type { FC } from 'react'
import styled from 'styled-components'

const Container = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 2rem;
  padding: 0 8px;
  line-height: 2rem;
  border-bottom: 1px solid ${(props) => props.theme.borderColor};

  .sidebar-header {
    &__name {
      font-size: 0.75rem;
    }
  }
`

const SideBarHeader: FC<SideBarHeaderProps> = (props) => {
  const handleRightNavItemClick = (item: RightNavItem) => {
    if (props.onRightNavItemClick) {
      props.onRightNavItemClick(item)
    }
  }
  return (
    <Container>
      <small className='sidebar-header__name'>{props.name}</small>
      <div className='flex'>
        {props.rightNavItems?.map((item) => {
          return item.tooltip ? (
            <Tooltip {...item.tooltip}>
              <i
                key={item.key}
                className={`icon ${item.iconCls}`}
                onClick={() => handleRightNavItemClick(item)}
              />
            </Tooltip>
          ) : (
            <i
              key={item.key}
              className={`icon ${item.iconCls}`}
              onClick={() => handleRightNavItemClick(item)}
            />
          )
        })}
      </div>
    </Container>
  )
}

export default SideBarHeader

export interface RightNavItem {
  iconCls: string
  key: React.Key
  tooltip?: Omit<TooltipProps, 'children'>
  [key: string]: any
}

export interface SideBarHeaderProps {
  name: string
  onRightNavItemClick?: (item: RightNavItem) => void
  rightNavItems?: RightNavItem[]
}
