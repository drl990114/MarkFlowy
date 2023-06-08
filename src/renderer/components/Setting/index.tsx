import { EVENT } from '@/constants'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import { emit } from '@tauri-apps/api/event'
import * as React from 'react'

export default function Setting() {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null)
  const open = Boolean(anchorEl)
  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }
  const handleClose = () => {
    setAnchorEl(null)
  }

  return (
    <div>
      <div id="demo-positioned-button" aria-controls={open ? 'demo-positioned-menu' : undefined} aria-haspopup="true" aria-expanded={open ? 'true' : undefined} onClick={handleClick}>
        <i className="ri-settings-line text-24px"></i>
      </div>
      <Menu
        id="demo-positioned-menu"
        aria-labelledby="demo-positioned-button"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
      >
        <MenuItem
          onClick={() => {
            emit(EVENT.open_window_setting)
            handleClose()
          }}
        >
          Setting
        </MenuItem>
        <MenuItem
          onClick={() => {
            emit(EVENT.dialog_setting_about)
            handleClose()
          }}
        >
          About
        </MenuItem>
      </Menu>
    </div>
  )
}
