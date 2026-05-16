import { HistoryExtension } from '@rme-sdk/extension-history'
import { useCommands, useHelpers } from '@rme-sdk/react-core'
import { t } from 'i18next'
import { FC, useCallback } from 'react'
import { CommandButton, CommandButtonProps } from './command-button'

export interface UndoButtonProps
  extends Omit<CommandButtonProps, 'commandName' | 'active' | 'enabled' | 'attrs' | 'onSelect'> {}

export const UndoButton: FC<UndoButtonProps> = (props) => {
  const { undo } = useCommands<HistoryExtension>()
  const { undoDepth } = useHelpers<HistoryExtension>(true)

  const handleSelect = useCallback(() => {
    if (undo.enabled()) {
      undo()
    }
  }, [undo])

  const enabled = undoDepth() > 0

  return (
    <CommandButton
      {...props}
      label={t("toolbar.undo")}
      icon="ri-arrow-go-back-fill"
      commandName="undo"
      active={false}
      enabled={enabled}
      onSelect={handleSelect}
    />
  )
}
