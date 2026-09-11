import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { getDefaultKeybindings } from '@/commands/keybindingCatalog'
import { formatKeyMap } from '@/commands/keybindingKeys'
import { KeyboardTable } from './KeyboardTable'

const mocks = vi.hoisted(() => ({ bindings: vi.fn(), save: vi.fn(), validate: vi.fn() }))
const actEnvironment = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
beforeAll(() => {
  actEnvironment.IS_REACT_ACT_ENVIRONMENT = true
})
afterAll(() => {
  delete actEnvironment.IS_REACT_ACT_ENVIRONMENT
})
vi.mock('@/hooks', () => ({
  useGlobalKeyboard: () => ({
    keyboardInfos: mocks.bindings(),
    reload: vi.fn(),
    updateKeyBinding: mocks.save,
    validateKeyBinding: mocks.validate,
  }),
}))
vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
beforeEach(() => {
  vi.clearAllMocks()
  mocks.bindings.mockReturnValue(getDefaultKeybindings('linux'))
})
afterEach(cleanup)

describe('keyboard settings policy', () => {
  it('shows native copy without an edit action while ordinary commands remain editable', () => {
    render(<KeyboardTable />)
    const copy = screen.getByRole('row', { name: /command.id_descriptions.editor_copy/ })
    expect(within(copy).queryByRole('button')).toBeNull()
    expect(within(copy).getByText('settings.keyboard.system_binding')).toBeTruthy()
    const save = screen.getByRole('row', { name: /command.id_descriptions.app_save/ })
    expect(within(save).getByRole('button', { name: /settings.keyboard.edit/ })).toBeTruthy()
  })

  it('combines command and shortcut search with the modified filter', () => {
    const bindings = getDefaultKeybindings('linux')
    const save = bindings.find((binding) => binding.command === 'app_save')!
    save.keys = ['Alt', 's']
    mocks.bindings.mockReturnValue(bindings)
    render(<KeyboardTable />)
    const search = screen.getByRole('searchbox')
    fireEvent.change(search, { target: { value: '  APP_SAVE  ' } })
    expect(screen.getAllByRole('row')).toHaveLength(2)
    expect(screen.getByRole('row', { name: /command.id_descriptions.app_save/ })).toBeTruthy()

    fireEvent.change(search, { target: { value: formatKeyMap(save.keys) } })
    expect(screen.getByRole('row', { name: /command.id_descriptions.app_save/ })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'settings.keyboard.modified_only' }))
    expect(screen.getAllByRole('row')).toHaveLength(2)
    fireEvent.change(search, { target: { value: 'app_quickOpen' } })
    expect(screen.getByRole('status').textContent).toBe('settings.keyboard.no_results')
    fireEvent.click(screen.getByRole('button', { name: 'settings.keyboard.modified_only' }))
    expect(screen.getByRole('row', { name: /command.id_descriptions.app_quickOpen/ })).toBeTruthy()
  })

  it.each(['click', 'double-click', 'keyboard'])(
    'opens with %s and returns focus after Escape',
    async (action) => {
      const user = userEvent.setup()
      render(<KeyboardTable />)
      const row = screen.getByRole('row', { name: /command.id_descriptions.app_save/ })
      const edit = within(row).getByRole('button')
      if (action === 'click') await user.click(edit)
      else if (action === 'double-click')
        await user.dblClick(within(row).getByText('command.id_descriptions.app_save'))
      else {
        act(() => edit.focus())
        await user.keyboard('{Enter}')
      }
      expect(document.activeElement).toBe(screen.getByRole('textbox'))
      await user.keyboard('{Escape}')
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      await waitFor(() => expect(document.activeElement).toBe(edit))
      expect(mocks.save).not.toHaveBeenCalled()
    },
  )

  it('does not open the system copy binding on double-click', () => {
    render(<KeyboardTable />)
    fireEvent.doubleClick(screen.getByRole('row', { name: /command.id_descriptions.editor_copy/ }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(mocks.save).not.toHaveBeenCalled()
  })

  it('returns to search if restoring defaults removes the edited row from the results', async () => {
    const user = userEvent.setup()
    const defaults = getDefaultKeybindings('linux')
    mocks.bindings.mockReturnValue(
      defaults.map((binding) =>
        binding.command === 'app_save' ? { ...binding, keys: ['Alt', 's'] } : binding,
      ),
    )
    const { rerender } = render(<KeyboardTable />)
    mocks.save.mockImplementationOnce(async () => {
      mocks.bindings.mockReturnValue(defaults)
      rerender(<KeyboardTable />)
      return true
    })
    await user.click(screen.getByRole('button', { name: 'settings.keyboard.modified_only' }))
    await user.click(
      within(screen.getByRole('row', { name: /command.id_descriptions.app_save/ })).getByRole(
        'button',
      ),
    )
    await user.click(screen.getByRole('button', { name: 'settings.keyboard.reset_default' }))
    await user.keyboard('{Enter}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.getByRole('status').textContent).toBe('settings.keyboard.no_results')
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('searchbox')))
  })
})
