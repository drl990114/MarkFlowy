import React, { FC, useCallback } from 'react'
import { MfIconButton } from '../Button/icon-button'
import { redo, undo } from '@codemirror/commands'
import type { EditorView } from '@codemirror/view'
import {
  applyBold,
  applyItalic,
  applyCode,
  applyH1,
  applyH2,
  applyH3,
  applyStrikethrough,
  applyBlockquote,
  applyBulletList,
  applyOrderedList,
  applyTaskList,
  insertLink,
  insertImage,
  ClipboardReadFunction,
} from './markdownCommands'

type CommandFunction = (view: EditorView, attrs?: any, clipboardRead?: ClipboardReadFunction) => boolean

export interface CodeCommandButtonProps {
  commandName: string
  icon: string
  label: string
  attrs?: Record<string, any>
  disabled?: boolean
  getEditorView: () => EditorView | undefined
  clipboardRead?: ClipboardReadFunction
}

export const createCommandMap = (clipboardRead?: ClipboardReadFunction): Record<string, CommandFunction> => ({
  undo: (view) => {
    undo(view)
    return true
  },
  redo: (view) => {
    redo(view)
    return true
  },
  toggleHeading: (view, attrs) => {
    if (attrs?.level === 1) return applyH1(view)
    if (attrs?.level === 2) return applyH2(view)
    if (attrs?.level === 3) return applyH3(view)
    return false
  },
  toggleStrong: applyBold,
  toggleEmphasis: applyItalic,
  toggleCodeText: applyCode,
  toggleBlockquote: applyBlockquote,
  toggleBulletList: applyBulletList,
  toggleOrderedList: applyOrderedList,
  toggleTaskList: applyTaskList,
  toggleDelete: applyStrikethrough,
  insertLink: (view) => insertLink(view, clipboardRead),
  insertImage: (view) => insertImage(view, clipboardRead),
})

export const CodeCommandButton: FC<CodeCommandButtonProps> = ({
  commandName,
  icon,
  label,
  attrs,
  disabled,
  getEditorView,
  clipboardRead,
}) => {
  const handleClick = useCallback(() => {
    const view = getEditorView()
    if (!view) return

    const commandMap = createCommandMap(clipboardRead)
    const command = commandMap[commandName]
    if (command) {
      command(view, attrs)
      view.focus()
    }
  }, [getEditorView, commandName, attrs, clipboardRead])

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
