import { MenuList, MenuItem, ListItemText, Paper } from '@mui/material'
import { memo } from 'react'
import styled, { css } from 'styled-components'

const ContextMenuContainer = styled(Paper)<Pick<ContextMenuProps, 'top' | 'left'>>`
  position: fixed;
  width: 140px;

  ${({ top, left }) => css`
    top: ${top}px;
    left: ${left}px;
  `}
`

export const ContextMenu = memo((props: ContextMenuProps) => {
  const { menuData, ...positionProps } = props

  return (
    <ContextMenuContainer {...positionProps}>
      <MenuList sx={{ padding: 0 }}>
        {menuData.map((menuItem) => {
          const { key, label, handler } = menuItem
          return (
            <MenuItem
              sx={{ padding: 0.7 }}
              key={key}
              onClick={(e) => {
                e.stopPropagation()
                handler()
              }}
            >
              <ListItemText>
                <span style={{ fontSize: 12 }}>{label}</span>
              </ListItemText>
            </MenuItem>
          )
        })}
      </MenuList>
    </ContextMenuContainer>
  )
})

interface ContextMenuProps {
  top: number
  left: number
  menuData: {
    key: string
    label: string
    handler: () => void
  }[]
}
