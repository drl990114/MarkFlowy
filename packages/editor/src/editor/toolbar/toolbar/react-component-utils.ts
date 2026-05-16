import {
  CommandDecoratorMessageProps,
  CommandDecoratorShortcut,
  CommandDecoratorValue,
  isArray,
  isEqual,
  isFunction,
  isString,
  ProsemirrorAttributes,
} from '@rme-sdk/core'
import { t } from 'i18next'

export interface RmeCommandDecoratorMessageProps extends CommandDecoratorMessageProps {
  t: typeof t
}
/**
 * Get the value from the option passed into the command.
 */

export function getCommandOptionValue<Type>(
  value: CommandDecoratorValue<Type> | undefined,
  commandProps: RmeCommandDecoratorMessageProps,
): Type | undefined {
  return isFunction(value) ? value(commandProps) : value
}

/**
 * Checks whether the first element in an array is a string and assumes the
 * whole array is a string array.
 */
function isStringArray(array: unknown[]): array is string[] {
  return isString(array[0])
}
/**
 * Get the string value from the available UI Shortcut.
 */

export function getUiShortcutString(
  uiShortcut: CommandDecoratorShortcut,
  attrs: ProsemirrorAttributes,
): string {
  if (isString(uiShortcut)) {
    return uiShortcut
  }

  if (!isArray(uiShortcut)) {
    return uiShortcut.shortcut
  }

  if (isStringArray(uiShortcut)) {
    return uiShortcut[0] ?? ''
  }

  return (
    (uiShortcut.find((shortcut) => isEqual(shortcut.attrs, attrs)) ?? uiShortcut[0])?.shortcut ?? ''
  )
}
