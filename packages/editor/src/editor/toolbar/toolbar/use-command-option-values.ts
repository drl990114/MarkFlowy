import type { CommandDecoratorMessageProps, CommandUiIcon } from '@rme-sdk/core'
import type { CoreIcon } from '@rme-sdk/icons'
import { useHelpers } from '@rme-sdk/react-core'
import { useMemo } from 'react'

import { t } from 'i18next'
import { getCommandOptionValue, RmeCommandDecoratorMessageProps } from './react-component-utils'

export interface UseCommandOptionValuesParams extends Omit<CommandDecoratorMessageProps, 't'> {
  commandName: string
}

export interface UseCommandOptionValuesResult {
  description?: string
  label?: string
  icon?: CoreIcon | CommandUiIcon
  shortcut?: string
}

export const useCommandOptionValues = ({
  commandName,
  active,
  enabled,
  attrs,
}: UseCommandOptionValuesParams): UseCommandOptionValuesResult => {
  const { getCommandOptions } = useHelpers()
  const options = getCommandOptions(commandName)

  const { description, label, icon, shortcut } = options || {}
  const commandProps: RmeCommandDecoratorMessageProps = useMemo(
    () => ({ active, attrs, enabled, t }),
    [active, attrs, enabled],
  )

  return useMemo(
    () => ({
      description: getCommandOptionValue(description, commandProps),
      label: getCommandOptionValue(label, commandProps),
      icon: getCommandOptionValue(icon, commandProps),
      // TODO
      shortcut: '',
    }),
    [commandProps, description, label, icon],
  )
}
