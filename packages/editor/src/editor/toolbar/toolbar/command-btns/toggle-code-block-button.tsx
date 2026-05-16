import { useActive, useCommands } from '@rme-sdk/react-core'
import { FC, useCallback } from 'react'

import { t } from 'i18next'
import { LineCodeMirrorExtension } from '../../../extensions/CodeMirror'
import { CodeMirrorExtensionAttributes } from '../../../extensions/CodeMirror/codemirror-types'
import { CommandButton, CommandButtonProps } from './command-button'

export interface ToggleCodeBlockButtonProps
  extends Omit<CommandButtonProps, 'commandName' | 'active' | 'enabled' | 'attrs' | 'onSelect'> {
  attrs?: Partial<CodeMirrorExtensionAttributes>
}

export const ToggleCodeBlockButton: FC<ToggleCodeBlockButtonProps> = ({ attrs = {}, ...rest }) => {
  const { createCodeMirror } = useCommands<LineCodeMirrorExtension>()

  const handleSelect = useCallback(() => {
    if (createCodeMirror.enabled(attrs)) {
      createCodeMirror(attrs)
    }
  }, [createCodeMirror, attrs])

  const active = useActive<LineCodeMirrorExtension>().codeMirror()
  const enabled = createCodeMirror.enabled(attrs)

  return (
    <CommandButton
      {...rest}
      label={t('toolbar.codeBlock')}
      icon="ri-code-box-line"
      commandName="createCodeMirror"
      active={active}
      enabled={enabled}
      attrs={attrs}
      onSelect={handleSelect}
    />
  )
}
