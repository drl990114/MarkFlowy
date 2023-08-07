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
`

const SideBarHeader: FC<SideBarHeaderProps> = (props) => {
  const handleRightNavItemClick = (item: RightNavItem) => {
    if (props.onRightNavItemClick) {
      props.onRightNavItemClick(item)
    }
  }
  return (
    <Container>
      <small>{props.name}</small>
      <div className='flex'>
        {props.rightNavItems?.map((item) => {
          return (
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
  [key: string]: any
}

export interface SideBarHeaderProps {
  name: string
  onRightNavItemClick?: (item: RightNavItem) => void
  rightNavItems?: RightNavItem[]
}
