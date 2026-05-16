import { useActive, useCommands } from '@rme-sdk/react-core'
import { FC, useCallback } from 'react'

import { t } from 'i18next'
import { LineListExtension } from '../../../extensions'
import { CommandButton, CommandButtonProps } from './command-button'

export interface ToggleOrderedListButtonProps
  extends Omit<CommandButtonProps, 'commandName' | 'active' | 'enabled' | 'attrs' | 'onSelect'> {}

export const ToggleOrderedListButton: FC<ToggleOrderedListButtonProps> = (props) => {
  const { toggleList } = useCommands<LineListExtension>()

  const handleSelect = useCallback(() => {
    if (toggleList) {
      toggleList({
        kind: 'ordered',
      })
    }
  }, [toggleList])

  const active = useActive<LineListExtension>().list()
  const enabled = true

  return (
    <CommandButton
      {...props}
      label={t('toolbar.orderedList')}
      icon="ri-list-ordered"
      commandName="toggleList"
      active={active}
      enabled={enabled}
      onSelect={handleSelect}
    />
  )
}
