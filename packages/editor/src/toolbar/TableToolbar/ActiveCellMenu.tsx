import { useContext, useRef, useState } from 'react'
import {
  ListItemText,
  ClickAwayListener,
  Grow,
  Paper,
  Popper,
  MenuItem,
  MenuList,
} from '@mui/material'
import { useCommands, type UseMultiPositionerReturn } from '@remirror/react'
import styled from 'styled-components'
import { OffsetContext } from '@/components/WysiwygEditor'

const Container = styled.div`
  position: absolute;

  .MuiList-padding {
    padding: 0;
  }
`

const ActiveCellMenu = (props: ActiveCellMenuProps) => {
  const { positioner } = props
  const commands = useCommands()
  const [open, setOpen] = useState(false)
  const anchorRef = useRef<HTMLDivElement>(null)
  const offset = useContext(OffsetContext)
  const options = [
    {
      label: 'insert column after',
      handler: commands.addTableColumnAfter,
    },
    {
      label: 'insert column before',
      handler: commands.addTableColumnBefore,
    },
    {
      label: 'insert row after',
      handler: commands.addTableRowAfter,
    },
    {
      label: 'insert row before',
      handler: commands.addTableRowBefore,
    },
    {
      label: 'delete column',
      handler: commands.deleteTableColumn,
    },
    {
      label: 'delete row',
      handler: commands.deleteTableRow,
    },
  ]

  const handleClose = (event: Event) => {
    if (anchorRef.current && anchorRef.current.contains(event.target as HTMLElement)) {
      return
    }

    setOpen(false)
  }

  const { ref, key, x, y } = positioner

  return (
    <Container
      key={key}
      ref={ref}
      style={{
        left: x + offset.left,
        top: y + offset.top,
        width: 20,
        height: 20,
      }}
      onMouseDown={(e) => {
        e.preventDefault()
        setOpen(true)
      }}
    >
      <div ref={anchorRef}>
        <i className='ri-equalizer-line'></i>
      </div>
      <Popper
        sx={{
          zIndex: 1,
        }}
        open={open}
        anchorEl={anchorRef.current}
        role={undefined}
        transition
        disablePortal
      >
        {({ TransitionProps, placement }) => (
          <Grow
            {...TransitionProps}
            style={{
              transformOrigin: placement === 'bottom' ? 'center top' : 'center bottom',
            }}
          >
            <Paper>
              <ClickAwayListener onClickAway={handleClose}>
                <MenuList dense autoFocusItem>
                  {options.map((option) => (
                    <MenuItem
                      key={option.label}
                      onClick={() => {
                        option.handler()
                        setOpen(false)
                      }}
                    >
                      <ListItemText>{option.label}</ListItemText>
                    </MenuItem>
                  ))}
                </MenuList>
              </ClickAwayListener>
            </Paper>
          </Grow>
        )}
      </Popper>
    </Container>
  )
}

export default ActiveCellMenu

interface ActiveCellMenuProps {
  positioner: UseMultiPositionerReturn
}
