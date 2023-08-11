import bus from '@/helper/eventBus'
import useFileTreeContextMenu from '@/hooks/useContextMenu'
import { MenuList, MenuItem, ListItemText, Paper } from '@mui/material'
import { memo } from 'react'
import styled, { css } from 'styled-components'

const ContextMenu = styled(Paper)<ContextMenuProps>`
  position: fixed;
  width: 140px;

  ${({ top, left }) => css`
    top: ${top}px;
    left: ${left}px;
  `}
`

export const FileNodeContextMenu = memo((props: ContextMenuProps) => {
  const { open, setOpen } = useFileTreeContextMenu()
  const { ...positionProps } = props

  if (!open) return null

  const ContextMenuItems = [
    {
      key: 'add_file',
      label: 'Add File',
      handler: () => {
        bus.emit('SIDEBAR:show-new-input')
      },
    },
  ]

  return (
    <ContextMenu {...positionProps}>
      <MenuList sx={{ padding: 0 }}>
        {ContextMenuItems.map((menuItem) => {
          const { key, label, handler } = menuItem
          return (
            <MenuItem
              sx={{ padding: 0.7 }}
              key={key}
              onClick={(e) => {
                e.stopPropagation()
                setOpen(false)
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
    </ContextMenu>
  )
})

interface ContextMenuProps {
  top: number
  left: number
}
