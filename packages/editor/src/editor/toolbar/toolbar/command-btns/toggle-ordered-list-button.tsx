import { isListKindActive } from '@rme-sdk/sdk/extensions/list'
import { useCommands, useEditorState } from '@rme-sdk/sdk/react'
import { useCallback } from 'react'
import type { FC } from 'react'

import { t } from '@markflowy/i18n'
import type { LineOrderedListExtension } from '../../../extensions'
import { CommandButton } from './command-button'
import type { CommandButtonProps } from './command-button'

export type ToggleOrderedListButtonProps = Omit<
  CommandButtonProps,
  'commandName' | 'active' | 'enabled' | 'attrs' | 'onSelect' | 'pressed'
>

export const ToggleOrderedListButton: FC<ToggleOrderedListButtonProps> = (props) => {
  const { toggleOrderedList } = useCommands<LineOrderedListExtension>()
  const state = useEditorState()

  const handleSelect = useCallback(() => {
    if (toggleOrderedList.enabled()) {
      toggleOrderedList()
    }
  }, [toggleOrderedList])

  const active = isListKindActive(state, 'ordered')
  const enabled = toggleOrderedList.enabled()

  return (
    <CommandButton
      {...props}
      label={t('toolbar.orderedList')}
      icon='ri-list-ordered'
      commandName='toggleOrderedList'
      active={active}
      pressed={active}
      enabled={enabled}
      onSelect={handleSelect}
    />
  )
}
