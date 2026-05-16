import { HistoryExtension } from '@rme-sdk/extension-history'
import { useCommands, useHelpers } from '@rme-sdk/react-core'
import { t } from 'i18next'
import { FC, useCallback } from 'react'
import { CommandButton, CommandButtonProps } from './command-button'

export interface RedoButtonProps
  extends Omit<CommandButtonProps, 'commandName' | 'active' | 'enabled' | 'attrs' | 'onSelect'> {}

export const RedoButton: FC<RedoButtonProps> = (props) => {
  const { redo } = useCommands<HistoryExtension>()
  const { redoDepth } = useHelpers<HistoryExtension>(true)

  const handleSelect = useCallback(() => {
    if (redo.enabled()) {
      redo()
    }
  }, [redo])

  const enabled = redoDepth() > 0

  return (
    <CommandButton
      {...props}
      label={t('toolbar.redo')}
      icon="ri-arrow-go-forward-fill"
      commandName="redo"
      active={false}
      enabled={enabled}
      onSelect={handleSelect}
    />
  )
}
