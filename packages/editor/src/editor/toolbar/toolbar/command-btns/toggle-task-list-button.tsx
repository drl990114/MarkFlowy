import { isListKindActive } from '@rme-sdk/sdk/extensions/list'
import type { StandardListExtension } from '@rme-sdk/sdk/extensions/list'
import { useCommands, useEditorState } from '@rme-sdk/sdk/react'
import { useCallback } from 'react'
import type { FC } from 'react'

import { t } from '@markflowy/i18n'
import { getStandardListCommand } from '../../../extensions'
import { CommandButton } from './command-button'
import type { CommandButtonProps } from './command-button'

export type ToggleTaskListButtonProps = Omit<
  CommandButtonProps,
  'commandName' | 'active' | 'enabled' | 'attrs' | 'onSelect' | 'pressed'
>

export const ToggleTaskListButton: FC<ToggleTaskListButtonProps> = (props) => {
  const commands = useCommands<StandardListExtension>()
  const toggleTaskList = getStandardListCommand(commands, 'task')
  const state = useEditorState()

  const handleSelect = useCallback(() => {
    if (toggleTaskList.enabled()) {
      toggleTaskList()
    }
  }, [toggleTaskList])

  const active = isListKindActive(state, 'task')
  const enabled = toggleTaskList.enabled()

  return (
    <CommandButton
      {...props}
      label={t('toolbar.taskList')}
      icon='ri-list-check-3'
      commandName='toggleTaskList'
      active={active}
      pressed={active}
      enabled={enabled}
      onSelect={handleSelect}
    />
  )
}
