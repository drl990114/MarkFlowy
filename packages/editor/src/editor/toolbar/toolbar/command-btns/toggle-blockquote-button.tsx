import { useActive, useCommands } from '@rme-sdk/react-core'
import { FC, useCallback } from 'react'

import { t } from 'i18next'
import { LineBlockquoteExtension } from '../../../extensions/BlockQuote'
import { CommandButton, CommandButtonProps } from './command-button'

export interface ToggleBlockquoteButtonProps
  extends Omit<CommandButtonProps, 'commandName' | 'active' | 'enabled' | 'attrs' | 'onSelect'> {
}

export const ToggleBlockquoteButton: FC<ToggleBlockquoteButtonProps> = ({ ...rest }) => {
  const { toggleBlockquote } = useCommands<LineBlockquoteExtension>()

  const handleSelect = useCallback(() => {
    if (toggleBlockquote.enabled()) {
      toggleBlockquote()
    }
  }, [toggleBlockquote])

  const active = useActive<LineBlockquoteExtension>().blockquote()
  const enabled = toggleBlockquote.enabled()

  return (
    <CommandButton
      {...rest}
      label={t('toolbar.blockquote')}
      icon="ri-double-quotes-r"
      commandName="toggleBlockquote"
      active={active}
      enabled={enabled}
      onSelect={handleSelect}
    />
  )
}
