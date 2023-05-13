import customColors from '@colors'
import { Box, ClickAwayListener, Fade, Popper, PopperProps } from '@mui/material'
import { createUid } from '@utils'
import React, { memo, useEffect, useMemo, useState } from 'react'

interface RePopperProps extends Partial<PopperProps> {
  content: React.ReactNode
  open: boolean
  onClickAway?: () => void
  children?: React.ReactNode
}
const Tooltip: React.FC<RePopperProps> = (props) => {
  const { children, content,onClickAway,  ...otherProps } = props

  const [open, setOpen] = useState(props.open || false)
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)

  useEffect(() => {
    setOpen(!!props.open)
  }, [props.open])

  const clickAwayHandler = () => {
    if (onClickAway) {
      onClickAway()
    }
  }

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const id = useMemo(() => createUid(), [])
  return (
    <>
      <div onClick={handleClick}>{children}</div>
      <ClickAwayListener onClickAway={clickAwayHandler}>
        <Popper {...otherProps} style={{ zIndex: 10 }} id={id} open={open} anchorEl={anchorEl} transition>
          {({ TransitionProps }) => (
            <Fade {...TransitionProps}>
              <Box sx={{ border: 1, bgcolor: customColors.bgColor, borderColor: customColors.borderColor }}>{content}</Box>
            </Fade>
          )}
        </Popper>
      </ClickAwayListener>
    </>
  )
}

export default memo(Tooltip)
