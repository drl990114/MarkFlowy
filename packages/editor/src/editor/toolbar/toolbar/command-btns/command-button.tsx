import { CoreIcon, isString } from '@rme-sdk/core'
import { FC, JSX, MouseEvent, ReactNode, useCallback } from 'react'

import styled from 'styled-components'
import { Ariakit, Tooltip } from 'zens'
import { useCommandOptionValues, UseCommandOptionValuesParams } from '../use-command-option-values'
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
  color: ${props => props.disabled ? props.theme.labelFontColor : props.theme.primaryFontColor};
  background-color: transparent;

  &:hover {
    background-color: ${props => props.theme.hoverColor};
  }
`
