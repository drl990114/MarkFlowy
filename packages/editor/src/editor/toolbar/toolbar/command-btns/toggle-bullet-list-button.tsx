import { isListKindActive } from '@rme-sdk/sdk/extensions/list'
import type { StandardListExtension } from '@rme-sdk/sdk/extensions/list'
import { useCommands, useEditorState } from '@rme-sdk/sdk/react'
import { useCallback } from 'react'
import type { FC } from 'react'

import { t } from '@markflowy/i18n'
import { getStandardListCommand } from '../../../extensions'
import { CommandButton } from './command-button'
import type { CommandButtonProps } from './command-button'

export type ToggleBulletListButtonProps = Omit<
  CommandButtonProps,
  'commandName' | 'active' | 'enabled' | 'attrs' | 'onSelect' | 'pressed'
>

export const ToggleBulletListButton: FC<ToggleBulletListButtonProps> = (props) => {
  const commands = useCommands<StandardListExtension>()
  const toggleBulletList = getStandardListCommand(commands, 'bullet')
  const state = useEditorState()

  const handleSelect = useCallback(() => {
    if (toggleBulletList.enabled()) {
      toggleBulletList()
    }
  }, [toggleBulletList])

  const active = isListKindActive(state, 'bullet')
  const enabled = toggleBulletList.enabled()

  return (
    <CommandButton
      {...props}
      label={t('toolbar.bulletList')}
      icon='ri-list-unordered'
      commandName='toggleBulletList'
      active={active}
      pressed={active}
      enabled={enabled}
      onSelect={handleSelect}
    />
  )
}
