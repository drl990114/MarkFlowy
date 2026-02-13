import { MfIconButton } from '@/components/ui-v2/Button'
import { FC, useCallback } from 'react'
import type { EditorContext } from 'rme'

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
