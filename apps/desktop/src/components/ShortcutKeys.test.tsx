import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ShortcutKeys } from './ShortcutKeys'
import type { KeybindingPlatform } from '@/commands/keybindingKeys'

afterEach(cleanup)

describe('ShortcutKeys', () => {
  it.each<{
    platform: KeybindingPlatform
    keys: string[]
    caps: string[]
    label: string
  }>([
    {
      platform: 'mac',
      keys: ['Shift', 'CommandOrCtrl', 'p'],
      caps: ['⌘', '⇧', 'P'],
      label: '⌘⇧P',
    },
    {
      platform: 'windows',
      keys: ['CommandOrCtrl', 'Shift', 'p'],
      caps: ['Ctrl', 'Shift', 'P'],
      label: 'Ctrl+Shift+P',
    },
    {
      platform: 'linux',
      keys: ['Ctrl', 'Shift', '+'],
      caps: ['Ctrl', 'Shift', '+'],
      label: 'Ctrl+Shift++',
    },
    {
      platform: 'mac',
      keys: ['Ctrl', 'Alt', '[NumpadSubtract]'],
      caps: ['⌃', '⌥', '[NumpadSubtract]'],
      label: '⌃⌥[NumpadSubtract]',
    },
  ])('renders a readable $platform shortcut for $label with one accessible label', ({
    platform,
    keys,
    caps,
    label,
  }) => {
    const { container } = render(<ShortcutKeys keys={keys} platform={platform} />)
    const keycaps = [...container.querySelectorAll('kbd')]

    expect(keycaps.map((key) => key.textContent)).toEqual(caps)
    expect(keycaps.every((key) => key.getAttribute('aria-hidden') === 'true')).toBe(true)
    expect(
      [...container.querySelectorAll('[aria-hidden="true"]')]
        .map((element) => element.textContent)
        .join(''),
    ).toBe(label)
    expect(container.querySelector('.sr-only')?.textContent).toBe(label)
  })

  it('leaves unbound shortcuts empty', () => {
    const { container } = render(<ShortcutKeys keys={[]} />)
    expect(container.childElementCount).toBe(0)
  })
})
