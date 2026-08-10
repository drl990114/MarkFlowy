import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ZenModeHint } from './ZenModeHint'
import { ZEN_MODE_HINT_DURATION_MS } from './zenMode'

vi.mock('@/commands', () => ({
  keybindingRegistry: { formatKeybinding: () => '⌘⇧F' },
}))

vi.mock('@/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, values?: { shortcut?: string }) =>
      key === 'zenMode.exitHint' ? `Press ${values?.shortcut} or Escape twice to exit` : 'Ctrl+Shift+F',
  }),
}))

const reactActEnvironment = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }

beforeAll(() => {
  reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true
})

afterAll(() => {
  delete reactActEnvironment.IS_REACT_ACT_ENVIRONMENT
})

describe('ZenModeHint', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    vi.useFakeTimers()
    container = document.createElement('div')
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    vi.useRealTimers()
  })

  it('announces the exit controls and disappears after the hint interval', () => {
    act(() => root.render(<ZenModeHint active />))

    const hint = container.querySelector('[data-mf-zen-mode-hint]')
    expect(hint?.getAttribute('role')).toBe('status')
    expect(hint?.textContent).toContain('⌘⇧F')

    act(() => vi.advanceTimersByTime(ZEN_MODE_HINT_DURATION_MS))
    expect(container.querySelector('[data-mf-zen-mode-hint]')).toBeNull()
  })

  it('stays hidden outside Zen Mode', () => {
    act(() => root.render(<ZenModeHint active={false} />))
    expect(container.querySelector('[data-mf-zen-mode-hint]')).toBeNull()
  })
})
