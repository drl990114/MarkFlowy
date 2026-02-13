import { MfIconButton } from '@/components/ui-v2/Button'
import { useEditorStore } from '@/stores'
import { redo, undo } from '@codemirror/commands'
import { FC, useCallback } from 'react'
import { sourceCodeCodemirrorViewMap } from '../../TextEditor'
import * as mdCommands from './markdownCommands'

type CommandFunction = (view: any, attrs?: any) => boolean

const commandMap: Record<string, CommandFunction> = {
  undo: undo,
  redo: redo,
  toggleHeading: (view, attrs) => {
    if (attrs?.level === 1) return mdCommands.applyH1(view)
    if (attrs?.level === 2) return mdCommands.applyH2(view)
    if (attrs?.level === 3) return mdCommands.applyH3(view)
    return false
  },
  toggleStrong: mdCommands.applyBold,
  toggleEmphasis: mdCommands.applyItalic,
  toggleCodeText: mdCommands.applyCode,
  toggleBlockquote: mdCommands.applyBlockquote,
  toggleBulletList: mdCommands.applyBulletList,
  toggleOrderedList: mdCommands.applyOrderedList,
  toggleTaskList: mdCommands.applyTaskList,
  toggleDelete: mdCommands.applyStrikethrough,
  insertLink: mdCommands.insertLink,
  insertImage: mdCommands.insertImage,
}

export interface CodeCommandButtonProps {
  commandName: string
  icon: string
  label: string
  attrs?: Record<string, any>
  disabled?: boolean
}

export const CodeCommandButton: FC<CodeCommandButtonProps> = ({
  commandName,
  icon,
  label,
  attrs,
  disabled,
}) => {
  const { activeId } = useEditorStore()

  const handleClick = useCallback(() => {
    if (!activeId) return
    const view = sourceCodeCodemirrorViewMap.get(activeId)?.cm
    if (!view) return

    const command = commandMap[commandName]
    if (command) {
      command(view, attrs)
      view.focus()
    }
  }, [activeId, commandName, attrs])

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
