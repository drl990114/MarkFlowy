import React, { FC, useCallback } from 'react'
import type { EditorContext } from 'rme'
import { MfIconButton } from '../Button/icon-button'

export interface CommandButtonProps {
  editorCtx: EditorContext
  commandName: string
  icon: string
  label: string
  attrs?: Record<string, any>
  disabled?: boolean
}

export const CommandButton: FC<CommandButtonProps> = ({
  editorCtx,
  commandName,
  icon,
  label,
  attrs,
  disabled
}) => {
  const handleClick = useCallback(() => {
    const commands = editorCtx.commands as any
    if (commands[commandName]) {
      commands[commandName](attrs)
      editorCtx.view.focus()
    }
  }, [editorCtx, commandName, attrs])

  return (
    <MfIconButton
      icon={icon}
      onClick={handleClick}
      tooltipProps={{ title: label }}
      disabled={disabled}
      size="small"
      rounded="smooth"
    />
  )
}
