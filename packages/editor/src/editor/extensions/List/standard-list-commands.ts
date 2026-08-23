import type { CommandsFromExtensions } from '@rme-sdk/sdk/core'
import type {
  StandardListExtension,
  StandardListKind,
} from '@rme-sdk/sdk/extensions/list'

type AllStandardListCommands = CommandsFromExtensions<StandardListExtension>

export type StandardListCommands = Pick<
  AllStandardListCommands,
  'toggleBulletList' | 'toggleOrderedList' | 'toggleTaskList'
>

export function getStandardListCommand(
  commands: StandardListCommands,
  kind: StandardListKind,
) {
  if (kind === 'ordered') return commands.toggleOrderedList
  if (kind === 'task') return commands.toggleTaskList
  return commands.toggleBulletList
}

export function runStandardListCommand(
  commands: StandardListCommands,
  kind: StandardListKind,
): boolean {
  const command = getStandardListCommand(commands, kind)
  if (!command.enabled()) return false

  command()
  return true
}
