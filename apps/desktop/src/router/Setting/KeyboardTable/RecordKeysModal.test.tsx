import { act, createRef } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { RecordKeysModal, type RecordKeysModalRef } from './RecordKeysModal'
import { getDefaultKeybindings } from '@/commands/keybindingCatalog'

const mocks = vi.hoisted(() => ({ save: vi.fn(), validate: vi.fn() }))
const actEnvironment = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
beforeAll(() => {
  actEnvironment.IS_REACT_ACT_ENVIRONMENT = true
})
afterAll(() => {
  delete actEnvironment.IS_REACT_ACT_ENVIRONMENT
})

vi.mock('@/hooks', () => ({
  useGlobalKeyboard: () => ({ updateKeyBinding: mocks.save, validateKeyBinding: mocks.validate }),
}))
vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
beforeEach(() => {
  vi.clearAllMocks()
  mocks.validate.mockReturnValue(undefined)
  mocks.save.mockResolvedValue(true)
})
afterEach(cleanup)
async function open() {
  const ref = createRef<RecordKeysModalRef>()
  render(<RecordKeysModal ref={ref} />)
  await act(async () =>
    ref.current!.open({
      id: 'app_save.default',
      command: 'app_save',
      configurable: true,
      target: 'app',
      when: 'always',
      keys: ['Ctrl', 's'],
      defaultKeys: ['Ctrl', 's'],
    }),
  )
}
describe('shortcut editing', () => {
  it('does not open an editor for a native copy binding', async () => {
    const ref = createRef<RecordKeysModalRef>()
    render(<RecordKeysModal ref={ref} />)
    await act(async () =>
      ref.current!.open(
        getDefaultKeybindings('linux').find((rule) => rule.command === 'editor_copy')!,
      ),
    )
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(mocks.save).not.toHaveBeenCalled()
  })
  it('shows the current shortcut and cannot clear it by saving an untouched draft', async () => {
    await open()
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toContain('S')
    expect(
      (screen.getByRole('button', { name: 'settings.keyboard.save' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true)
    expect(mocks.save).not.toHaveBeenCalled()
  })
  it('keeps the draft visible after save failure and supports retry', async () => {
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'settings.keyboard.remove_binding' }))
    mocks.save.mockRejectedValueOnce(new Error('disk error'))
    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: 'settings.keyboard.save' })),
    )
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByRole('status').textContent).toContain('disk error')
    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: 'settings.keyboard.save' })),
    )
    expect(mocks.save).toHaveBeenLastCalledWith('app_save.default', [])
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('records Enter as save and ignores modifier-only presses', async () => {
    await open()
    const input = screen.getByRole('textbox') as HTMLInputElement
    fireEvent.keyDown(input, { key: 'Control', ctrlKey: true })
    expect(input.value).toContain('S')
    fireEvent.keyDown(input, { key: '1', code: 'Digit1', altKey: true })
    await act(async () => fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' }))
    expect(mocks.save).toHaveBeenCalledWith('app_save.default', ['Alt', '1'])
  })
  it('shows conflicts inline and prevents saving them', async () => {
    await open()
    mocks.validate.mockReturnValue('Already used by Save')
    fireEvent.keyDown(screen.getByRole('textbox'), { key: '2', code: 'Digit2', altKey: true })
    expect(screen.getByRole('status').textContent).toBe('Already used by Save')
    expect(
      (screen.getByRole('button', { name: 'settings.keyboard.save' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true)
  })

  it('restores the default draft and returns focus to recording without saving', async () => {
    const user = userEvent.setup()
    await open()
    const input = screen.getByRole('textbox') as HTMLInputElement
    const reset = screen.getByRole('button', {
      name: 'settings.keyboard.reset_default',
    }) as HTMLButtonElement
    expect(reset.disabled).toBe(true)
    fireEvent.keyDown(input, { key: '1', code: 'Digit1', altKey: true })
    expect(reset.disabled).toBe(false)
    await user.click(reset)
    expect(document.activeElement).toBe(input)
    expect(input.value).toContain('S')
    expect(reset.disabled).toBe(true)
    expect(
      (screen.getByRole('button', { name: 'settings.keyboard.save' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true)
    expect(mocks.save).not.toHaveBeenCalled()
  })

  it('supports Tab navigation and Enter to save an explicitly removed binding', async () => {
    const user = userEvent.setup()
    await open()
    const input = screen.getByRole('textbox') as HTMLInputElement
    await user.tab()
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'settings.keyboard.remove_binding' }),
    )
    expect(input.value).toContain('S')
    await user.keyboard('{Enter}')
    expect(document.activeElement).toBe(input)
    expect(input.value).toBe('')
    await user.keyboard('{Enter}')
    expect(mocks.save).toHaveBeenCalledWith('app_save.default', [])
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
