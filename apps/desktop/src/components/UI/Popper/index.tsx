import type { PopperProps } from '@mui/material'
import {
  Box,
  ClickAwayListener,
  Fade,
  Popper,
} from '@mui/material'
import { nanoid } from 'nanoid'
import React, { memo, useEffect, useMemo, useState } from 'react'
import useThemeStore from '@/stores/useThemeStore'

interface RePopperProps extends Partial<PopperProps> {
  content: any
  open: boolean
  onClickAway?: () => void
  children?: React.ReactNode
}
const Tooltip: React.FC<RePopperProps> = (props) => {
  const { children, content, onClickAway, ...otherProps } = props
  const { curTheme } = useThemeStore()
  const [open, setOpen] = useState(props.open || false)
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)

  useEffect(() => {
    setOpen(!!props.open)
  }, [props.open])

  const clickAwayHandler = () => {
    if (onClickAway)
      onClickAway()
  }

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const id = useMemo(() => nanoid(), [])
  return (
    <>
      <div onClick={handleClick}>{children}</div>
      <ClickAwayListener onClickAway={clickAwayHandler}>
        <Popper
          {...otherProps}
          style={{ zIndex: 10 }}
          id={id}
          open={open}
          anchorEl={anchorEl}
          transition
        >
          {({ TransitionProps }) => (
            <Fade {...TransitionProps}>
              <Box
                sx={{
                  border: 1,
                  bgcolor: curTheme.styledContants.bgColor,
                  borderColor: curTheme.styledContants.borderColor,
                }}
              >
                {content}
              </Box>
            </Fade>
          )}
        </Popper>
      </ClickAwayListener>
    </>
  )
}

export default memo(Tooltip)
