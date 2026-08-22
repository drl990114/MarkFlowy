import { isString } from '@rme-sdk/sdk/core'
import type { CoreIcon } from '@rme-sdk/sdk/core'
import { useCallback } from 'react'
import type { FC, JSX, MouseEvent, ReactNode } from 'react'

import styled from 'styled-components'
import { Ariakit, Tooltip } from 'zens'
import { useCommandOptionValues } from '../use-command-option-values'
import type { UseCommandOptionValuesParams } from '../use-command-option-values'
import { CommandButtonIcon } from './command-button-icon'

export interface CommandButtonProps extends Omit<UseCommandOptionValuesParams, 'active' | 'attrs'> {
  active?: UseCommandOptionValuesParams['active']
  'aria-label'?: string
  label?: NonNullable<ReactNode>
  commandName: string
  displayShortcut?: boolean
  onSelect: () => void
  onChange?: (e: MouseEvent<HTMLElement>) => void
  icon?: CoreIcon | JSX.Element | string
  attrs?: UseCommandOptionValuesParams['attrs']
  pressed?: boolean
}

export const CommandButton: FC<CommandButtonProps> = ({
  commandName,
  active = false,
  enabled,
  attrs,
  onSelect,
  onChange,
  icon,
  displayShortcut = true,
  'aria-label': ariaLabel,
  label,
  pressed,
  ...rest
}) => {
  const handleChange = useCallback(
    (e: MouseEvent<HTMLElement>) => {
      onSelect()
      onChange?.(e)
    },
    [onSelect, onChange],
  )

  const commandOptions = useCommandOptionValues({ commandName, active, enabled, attrs })

  let fallbackIcon = null

  if (commandOptions.icon) {
    fallbackIcon = isString(commandOptions.icon) ? commandOptions.icon : commandOptions.icon.name
  }

  const labelText = ariaLabel ?? commandOptions.label ?? ''
  const tooltipText = label ?? labelText
  const shortcutText =
    displayShortcut && commandOptions.shortcut ? ` (${commandOptions.shortcut})` : ''

  return (
    <Tooltip title={`${tooltipText}${shortcutText}`}>
      <Container
        aria-label={labelText}
        aria-pressed={pressed}
        disabled={!enabled}
        {...rest}
        value={commandName}
        onClick={handleChange}
      >
        <CommandButtonIcon icon={icon ?? fallbackIcon} />
      </Container>
    </Tooltip>
  )
}

const Container = styled(Ariakit.ToolbarItem)`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 0;
  padding: 6px;
  border: none;
  font-size: 1em;
  color: ${(props) => (props.disabled ? props.theme.labelFontColor : props.theme.primaryFontColor)};
  background-color: transparent;

  &:hover {
    background-color: ${(props) => props.theme.hoverColor};
  }

  &[aria-pressed='true'] {
    color: ${(props) => props.theme.accentColor};
    background-color: ${(props) => props.theme.hoverColor};
  }
`
