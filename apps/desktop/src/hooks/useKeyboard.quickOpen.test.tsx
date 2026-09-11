import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { invoke } from '@tauri-apps/api/core'
import { commandRegistry } from '@/commands'
import { EVENT } from '@/constants'
import { getDefaultKeybindings } from '@/commands/keybindingCatalog'
import useGlobalKeyboard from './useKeyboard'

vi.mock('hox', () => ({ createGlobalStore: (hook: () => unknown) => [hook] }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('@/helper/logger', () => ({ logger: { debug: vi.fn(), warn: vi.fn() } }))
vi.mock('@/components/EditorArea/capricornEditorRegistry', () => ({
  getCapricornEditor: () => undefined,
}))
vi.mock('@/components/EditorArea/editorSearchStore', () => ({ openDocumentSearch: vi.fn() }))
vi.mock('zens', () => ({ toast: { error: vi.fn() } }))

function KeyboardHost() {
  useGlobalKeyboard()
  return null
}

const reactEnvironment = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
beforeAll(() => {
  reactEnvironment.IS_REACT_ACT_ENVIRONMENT = true
})
afterAll(() => {
  delete reactEnvironment.IS_REACT_ACT_ENVIRONMENT
})

describe('Quick Open global keybinding', () => {
  let root: Root
  let target: HTMLInputElement
  const open = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    commandRegistry.registerCommand({ id: EVENT.app_quickOpen, handler: open })
    target = document.createElement('input')
    document.body.append(target)
    root = createRoot(document.createElement('div'))
  })

  afterEach(() => {
    act(() => root.unmount())
    commandRegistry.unregisterCommand(EVENT.app_quickOpen)
    const dialog = target.closest('[role="dialog"]')
    target.remove()
    dialog?.remove()
  })

  async function mount(keyMap: string[]) {
    vi.mocked(invoke).mockResolvedValue({
      revision: 1,
      rules: getDefaultKeybindings('linux')
        .filter((rule) => rule.command === EVENT.app_quickOpen)
        .map((rule) => ({ ...rule, keys: keyMap })),
    })
    await act(async () => root.render(<KeyboardHost />))
  }

  function press(options: KeyboardEventInit) {
    const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...options })
    target.dispatchEvent(event)
    return event
  }

  it.each([
    { modifier: 'Ctrl', event: { ctrlKey: true } },
    { modifier: 'Meta', event: { metaKey: true } },
  ])(
    'opens once before a nested editor consumes $modifier+P and prevents printing',
    async ({ modifier, event }) => {
      await mount([modifier, 'p'])
      const nested = vi.fn((nestedEvent: KeyboardEvent) => nestedEvent.stopPropagation())
      target.addEventListener('keydown', nested)
      expect(press({ key: 'p', ...event }).defaultPrevented).toBe(true)
      expect(open).toHaveBeenCalledOnce()
      expect(nested).not.toHaveBeenCalled()
    },
  )

  it('honors a customized or disabled shortcut', async () => {
    await mount(['Alt', 'o'])
    expect(press({ key: 'p', ctrlKey: true }).defaultPrevented).toBe(false)
    expect(press({ key: 'o', altKey: true }).defaultPrevented).toBe(true)
    expect(open).toHaveBeenCalledOnce()

    act(() => root.unmount())
    root = createRoot(document.createElement('div'))
    await mount([])
    expect(press({ key: 'p', ctrlKey: true }).defaultPrevented).toBe(false)
    expect(press({ key: 'o', altKey: true }).defaultPrevented).toBe(false)
    expect(open).toHaveBeenCalledOnce()
  })

  it('ignores IME and other dialogs but captures the key within Quick Open', async () => {
    await mount(['Ctrl', 'p'])
    press({ key: 'p', ctrlKey: true, isComposing: true })
    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    document.body.append(dialog)
    dialog.append(target)
    press({ key: 'p', ctrlKey: true })
    expect(open).not.toHaveBeenCalled()
    dialog.setAttribute('data-mf-quick-open', '')
    expect(press({ key: 'p', ctrlKey: true }).defaultPrevented).toBe(true)
    expect(open).toHaveBeenCalledOnce()
  })
})
