import { ItalicExtension } from '@rme-sdk/extension-italic'
import { useActive, useCommands } from '@rme-sdk/react-core'
import { FC, useCallback } from 'react'

import { t } from 'i18next'
import { CommandButton, CommandButtonProps } from './command-button'

export interface ToggleItalicButtonProps
  extends Omit<CommandButtonProps, 'commandName' | 'active' | 'enabled' | 'attrs' | 'onSelect'> {}

export const ToggleItalicButton: FC<ToggleItalicButtonProps> = (props) => {
  const { toggleEmphasis } = useCommands<ItalicExtension>()

  const handleSelect = useCallback(() => {
    if (toggleEmphasis.enabled()) {
      toggleEmphasis()
    }
  }, [toggleEmphasis])

  const active = useActive<ItalicExtension>().mdEm()
  const enabled = toggleEmphasis.enabled()

  return (
    <CommandButton
      {...props}
      label={t('toolbar.italic')}
      icon="ri-italic"
      commandName="toggleEmphasis"
      active={active}
      enabled={enabled}
      onSelect={handleSelect}
    />
  )
}
