import { CodeExtension } from '@rme-sdk/extension-code'
import { useActive, useCommands } from '@rme-sdk/react-core'
import { FC, useCallback } from 'react'

import { t } from 'i18next'
import { CommandButton, CommandButtonProps } from './command-button'

export interface ToggleCodeButtonProps
  extends Omit<CommandButtonProps, 'commandName' | 'active' | 'enabled' | 'attrs' | 'onSelect'> {}

export const ToggleCodeButton: FC<ToggleCodeButtonProps> = (props) => {
  const { toggleCodeText } = useCommands<CodeExtension>()

  const handleSelect = useCallback(() => {
    if (toggleCodeText.enabled()) {
      toggleCodeText()
    }
  }, [toggleCodeText])

  const active = useActive<CodeExtension>().mdCodeText()
  const enabled = toggleCodeText.enabled()

  return (
    <CommandButton
      {...props}
      label={t('toolbar.codeText')}
      icon="ri-code-line"
      commandName="toggleCodeText"
      active={active}
      enabled={enabled}
      onSelect={handleSelect}
    />
  )
}
