import { act, fireEvent, render, screen, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { commandRegistry, keybindingRegistry } from '@/commands'
import { getDefaultKeybindings } from '@/commands/keybindingCatalog'
import { EVENT } from '@/constants'
import { TooltipProvider } from './ui/tooltip'
import { CommandPaletteButton } from './CommandPaletteButton'

vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: () => 'Command Palette' }) }))
vi.mock('@/helper/logger', () => ({ logger: { warn: vi.fn() } }))
afterEach(cleanup)

describe('command palette entry point', () => {
  it.each(['titlebar', 'statusbar'] as const)(
    'opens from %s and follows customized or disabled shortcuts',
    (location) => {
      const open = vi.fn()
      const registration = commandRegistry.registerCommand({
        id: EVENT.app_commandPalette,
        handler: open,
      })
      const rules = getDefaultKeybindings('linux')
      keybindingRegistry.setKeybindings(rules)
      render(
        <TooltipProvider>
          <CommandPaletteButton location={location} />
        </TooltipProvider>,
      )
      const button = screen.getByRole('button')
      expect(button.getAttribute('aria-haspopup')).toBe('dialog')
      expect(button.getAttribute('aria-label')).toContain('P')
      expect(button.getAttribute('data-tauri-drag-region')).toBeNull()
      if (location === 'statusbar')
        expect(button.hasAttribute('data-mf-status-bar-button')).toBe(true)
      fireEvent.click(button)
      expect(open).toHaveBeenCalledOnce()
      act(() =>
        keybindingRegistry.setKeybindings(
          rules.map((rule) =>
            rule.command === EVENT.app_commandPalette ? { ...rule, keys: ['Alt', 'o'] } : rule,
          ),
        ),
      )
      expect(button.getAttribute('aria-label')).toContain('O')
      act(() =>
        keybindingRegistry.setKeybindings(
          rules.map((rule) =>
            rule.command === EVENT.app_commandPalette ? { ...rule, keys: [] } : rule,
          ),
        ),
      )
      expect(button.getAttribute('aria-label')).toBe('Command Palette')
      registration.dispose()
    },
  )
})
