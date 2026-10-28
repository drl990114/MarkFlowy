import { TooltipProvider } from '@/components/ui/tooltip'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ZenModeControls } from './ZenModeControls'
import { ZenModeHint } from './ZenModeHint'
import { ZEN_MODE_HINT_DURATION_MS } from './zenMode'

const execute = vi.hoisted(() => vi.fn())

vi.mock('@/commands', () => ({
  commandRegistry: { execute },
  keybindingRegistry: {
    formatKeyMap: () => '⌘⇧F',
    formatKeybinding: () => '⌘⇧F',
  },
}))
vi.mock('@/hooks', () => ({
  useGlobalKeyboard: () => ({
    keyboardInfos: [{ command: 'app_toggleZenMode', keys: ['CommandOrCtrl', 'Shift', 'f'] }],
  }),
}))
vi.mock('@/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, values?: { shortcut?: string }) =>
      key === 'zenMode.exitHint'
        ? `Press ${values?.shortcut} or Escape twice to exit`
        : 'Toggle Zen Mode',
  }),
}))
vi.mock('@/stores', () => ({
  useEditorStore: (selector: (state: { activeId?: string }) => unknown) =>
    selector({ activeId: 'document-1' }),
}))
vi.mock('@/stores/useLayoutStore', () => ({
  default: (selector: (state: { zenModeActive: boolean }) => unknown) =>
    selector({ zenModeActive: true }),
}))

beforeEach(() => {
  vi.useFakeTimers()
  execute.mockClear()
  vi.spyOn(Element.prototype, 'animate').mockImplementation(
    () => ({ cancel: vi.fn(), pause: vi.fn(), play: vi.fn() }) as unknown as Animation,
  )
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('ZenModeControls', () => {
  it('retains a focusable exit action after the hint disappears and invokes the existing command', () => {
    const { container } = render(
      <TooltipProvider>
        <ZenModeHint active />
        <ZenModeControls active />
      </TooltipProvider>,
    )

    expect(container.querySelector('[data-mf-zen-mode-hint]')).not.toBeNull()
    act(() => vi.advanceTimersByTime(ZEN_MODE_HINT_DURATION_MS))
    expect(container.querySelector('[data-mf-zen-mode-hint]')).toBeNull()

    const button = screen.getByRole('button', { name: 'Toggle Zen Mode (⌘⇧F)' })
    expect(button.getAttribute('aria-pressed')).toBe('true')
    expect(button.getAttribute('type')).toBe('button')
    expect(button.tabIndex).toBe(0)
    act(() => button.focus())
    expect(document.activeElement).toBe(button)
    expect(screen.getByRole('tooltip').textContent).toBe('Toggle Zen Mode (⌘⇧F)')

    fireEvent.click(button)
    expect(execute).toHaveBeenCalledWith('app_toggleZenMode')
  })

  it('removes the floating action outside Zen Mode', () => {
    const { rerender } = render(
      <TooltipProvider>
        <ZenModeControls active />
      </TooltipProvider>,
    )
    expect(screen.queryByRole('button')).not.toBeNull()

    rerender(
      <TooltipProvider>
        <ZenModeControls active={false} />
      </TooltipProvider>,
    )
    expect(screen.queryByRole('button')).toBeNull()
  })
})
