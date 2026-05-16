import { useActive, useCommands } from '@rme-sdk/react-core'
import { FC, useCallback } from 'react'

import { CodeMirrorExtensionAttributes } from '@/editor/extensions/CodeMirror/codemirror-types'
import { t } from 'i18next'
import { CommandButton, CommandButtonProps } from './command-button'

export interface ToggleCodeBlockButtonProps
  extends Omit<CommandButtonProps, 'commandName' | 'active' | 'enabled' | 'attrs' | 'onSelect'> {
  attrs?: Partial<CodeMirrorExtensionAttributes>
}

export const InsertSeparatorButton: FC<ToggleCodeBlockButtonProps> = ({ attrs = {}, ...rest }) => {
  const commands = useCommands()
  const insertHorizontalRule = commands.insertHorizontalRule

  const handleSelect = useCallback(() => {
    if (insertHorizontalRule?.enabled()) {
      insertHorizontalRule()
    }
  }, [insertHorizontalRule])

  const active = useActive().horizontalRule()
  const enabled = insertHorizontalRule?.enabled() ?? false

  return (
    <CommandButton
      {...rest}
      label={t("toolbar.separator")}
      icon="ri-separator"
      commandName="insertHorizontalRule"
      active={active}
      enabled={enabled}
      attrs={attrs}
      onSelect={handleSelect}
    />
  )
}
