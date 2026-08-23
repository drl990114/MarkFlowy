import { describe, expect, it, vi } from 'vitest'

import type { StandardListCommands } from './standard-list-commands'
import { runStandardListCommand } from './standard-list-commands'

function createCommand(enabled = true) {
  return Object.assign(vi.fn(), {
    enabled: vi.fn(() => enabled),
  })
}

describe('Standard List command routing', () => {
  it.each([
    ['bullet', 'toggleBulletList'],
    ['ordered', 'toggleOrderedList'],
    ['task', 'toggleTaskList'],
  ] as const)('routes %s conversion through %s', (kind, commandName) => {
    const commands = {
      toggleBulletList: createCommand(),
      toggleOrderedList: createCommand(),
      toggleTaskList: createCommand(),
    } as unknown as StandardListCommands

    expect(runStandardListCommand(commands, kind)).toBe(true)
    expect(commands[commandName]).toHaveBeenCalledOnce()
  })

  it('does not run a disabled conversion command', () => {
    const disabledCommand = createCommand(false)
    const commands = {
      toggleBulletList: disabledCommand,
      toggleOrderedList: createCommand(),
      toggleTaskList: createCommand(),
    } as unknown as StandardListCommands

    expect(runStandardListCommand(commands, 'bullet')).toBe(false)
    expect(disabledCommand).not.toHaveBeenCalled()
  })
})
