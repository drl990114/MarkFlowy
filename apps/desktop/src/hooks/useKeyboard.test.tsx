import { getDefaultKeybindings } from '@/commands/keybindingCatalog'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { commandRegistry } from '@/commands'
import useGlobalKeyboard, { type KeyboardInfo, useEditorKeybindingStore } from './useKeyboard'

const actEnvironment = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
beforeAll(() => {
  actEnvironment.IS_REACT_ACT_ENVIRONMENT = true
})
afterAll(() => {
  delete actEnvironment.IS_REACT_ACT_ENVIRONMENT
})

vi.mock('hox', () => ({ createGlobalStore: (hook: () => unknown) => [hook] }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => vi.fn()) }))
vi.mock('@/helper/logger', () => ({ logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() } }))
vi.mock('@/components/EditorArea/capricornEditorRegistry', () => ({
  getCapricornEditor: () => undefined,
}))
vi.mock('@/components/EditorArea/editorSearchStore', () => ({ openDocumentSearch: vi.fn() }))
vi.mock('@/i18n', () => ({ t: (key: string) => key }))

describe('application shortcut scope and persistence', () => {
  let root: Root
  let input: HTMLInputElement
  let state: ReturnType<typeof useGlobalKeyboard>
  let stored: KeyboardInfo[]
  let revision: number
  const save = vi.fn()
  const toggle = vi.fn()
  function Host() {
    state = useGlobalKeyboard()
    return null
  }
  beforeEach(async () => {
    vi.clearAllMocks()
    revision = 0
    const initialKeys: Record<string, string[]> = {
      app_save: ['Ctrl', 's'],
      app_toggleEditorType: ['Ctrl', 'm'],
      editor_toggleStrong: ['Ctrl', 'b'],
    }
    stored = getDefaultKeybindings('linux')
      .filter((rule) => initialKeys[rule.command])
      .map((rule) => ({ ...rule, keys: initialKeys[rule.command] }))
    vi.mocked(invoke).mockImplementation(async (command, args) => {
      if (command === 'get_keyboard_infos') return { rules: stored, revision: ++revision }
      if (command === 'update_keybinding') {
        const update = args as { ruleId: string; keys: string[] }
        stored = stored.map((item) =>
          item.id === update.ruleId ? { ...item, keys: update.keys } : item,
        )
        return { rules: stored, revision: ++revision }
      }
    })
    commandRegistry.registerCommand({ id: 'app_save', handler: save })
    commandRegistry.registerCommand({ id: 'app_toggleEditorType', handler: toggle })
    input = document.createElement('input')
    document.body.append(input)
    root = createRoot(document.createElement('div'))
    await act(async () => root.render(<Host />))
  })
  afterEach(() => {
    act(() => root.unmount())
    commandRegistry.unregisterCommand('app_save')
    commandRegistry.unregisterCommand('app_toggleEditorType')
    document.body.replaceChildren()
  })
  function press(key: string, extra: KeyboardEventInit = {}) {
    const event = new KeyboardEvent('keydown', {
      key,
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
      ...extra,
    })
    input.dispatchEvent(event)
    return event
  }
  it('consumes a handled app command once and ignores repeat, IME and consumed events', () => {
    expect(press('s').defaultPrevented).toBe(true)
    press('s', { repeat: true })
    press('s', { isComposing: true })
    input.addEventListener('keydown', (event) => event.preventDefault(), { once: true })
    press('s')
    expect(save).toHaveBeenCalledOnce()
  })
  it('does not run editor commands from unrelated inputs or dialogs', () => {
    press('m')
    expect(toggle).not.toHaveBeenCalled()
    input.className = 'ProseMirror'
    press('m')
    expect(toggle).toHaveBeenCalledOnce()
    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    document.body.append(dialog)
    dialog.append(input)
    press('m')
    press('s')
    expect(toggle).toHaveBeenCalledOnce()
    expect(save).not.toHaveBeenCalled()
  })
  it('dispatches multiple rules for the same app command and edits only the selected rule', async () => {
    stored.push({ ...stored[0], id: 'save.alternative', keys: ['Ctrl', 'a'] })
    await act(async () => state.reload())
    expect(press('s').defaultPrevented).toBe(true)
    expect(press('a').defaultPrevented).toBe(true)
    expect(save).toHaveBeenCalledTimes(2)
    await act(async () => state.updateKeyBinding('save.alternative', ['Ctrl', 'd']))
    expect(press('a').defaultPrevented).toBe(false)
    expect(press('s').defaultPrevented).toBe(true)
    expect(press('d').defaultPrevented).toBe(true)
    expect(save).toHaveBeenCalledTimes(4)
  })
  it('rejects copy edits before IPC and leaves native copy keydown unconsumed', async () => {
    stored.push(getDefaultKeybindings('linux').find((rule) => rule.command === 'editor_copy')!)
    await act(async () => state.reload())
    vi.mocked(invoke).mockClear()
    await expect(state.updateKeyBinding('editor_copy.default', ['Alt', 'c'])).rejects.toThrow(
      'reserved_binding',
    )
    await expect(state.updateKeyBinding('editor_copy.default', [])).rejects.toThrow(
      'reserved_binding',
    )
    input.className = 'ProseMirror'
    expect(press('c').defaultPrevented).toBe(false)
    expect(useEditorKeybindingStore.getState().editorKeybingMap.copy).toBeUndefined()
    expect(invoke).not.toHaveBeenCalled()
  })
  it('persists a valid update and publishes cleared editor keys without a reload of the document', async () => {
    await act(async () => {
      expect(await state.updateKeyBinding('editor_toggleStrong.default', [])).toBe(true)
    })
    expect(useEditorKeybindingStore.getState().editorKeybingMap.toggleStrong).toEqual([])
    expect(
      state.keyboardInfos.find((item) => item.command === 'editor_toggleStrong')?.keys,
    ).toEqual([])
  })
  it('lets a host command reclaim a disabled editor default without triggering both', async () => {
    await act(async () => {
      await state.updateKeyBinding('editor_toggleStrong.default', [])
      await state.updateKeyBinding('app_save.default', ['Ctrl', 'b'])
    })
    input.className = 'ProseMirror'
    const editorFallback = vi.fn((event: KeyboardEvent) => event.preventDefault())
    input.addEventListener('keydown', editorFallback)
    expect(press('b').defaultPrevented).toBe(true)
    expect(save).toHaveBeenCalledOnce()
    expect(editorFallback).not.toHaveBeenCalled()
  })
  it('rejects a conflict before IPC and accepts retaining the current binding', async () => {
    vi.mocked(invoke).mockClear()
    await expect(
      state.updateKeyBinding('editor_toggleStrong.default', ['Ctrl', 's']),
    ).rejects.toThrow('conflict_with')
    expect(await state.updateKeyBinding('app_save.default', ['Ctrl', 'S'])).toBe(true)
    expect(invoke).not.toHaveBeenCalled()
  })
  it('persists a restored portable default even when the physical modifier is equivalent', async () => {
    await act(async () => {
      await state.updateKeyBinding('app_save.default', ['CommandOrCtrl', 's'])
    })
    expect(invoke).toHaveBeenCalledWith('update_keybinding', {
      ruleId: 'app_save.default',
      keys: ['CommandOrCtrl', 's'],
    })
    expect(stored[0].keys).toEqual(['CommandOrCtrl', 's'])
  })
  it('refreshes dispatch and editor settings after another window saves', async () => {
    stored = stored.map((binding) => ({
      ...binding,
      keys: ['Ctrl', 'Alt', binding.keys.at(-1)!],
    }))
    await act(async () => {
      const onChange = vi.mocked(listen).mock.calls[0][1]
      onChange({ event: 'keyboard-bindings-changed', id: 1, payload: null })
    })
    expect(press('s').defaultPrevented).toBe(false)
    expect(press('s', { altKey: true }).defaultPrevented).toBe(true)
    expect(save).toHaveBeenCalledOnce()
    expect(useEditorKeybindingStore.getState().editorKeybingMap.toggleStrong).toEqual([
      'Ctrl-Alt-b',
    ])
  })
  it('retains the last saved settings when a write fails', async () => {
    vi.mocked(invoke).mockRejectedValueOnce(new Error('Permission denied'))
    await act(async () => {
      await expect(state.updateKeyBinding('editor_toggleStrong.default', [])).rejects.toThrow(
        'save_failed',
      )
    })
    expect(useEditorKeybindingStore.getState().editorKeybingMap.toggleStrong).toEqual(['Ctrl-b'])
    expect(
      state.keyboardInfos.find((binding) => binding.command === 'editor_toggleStrong')?.keys,
    ).toEqual(['Ctrl', 'b'])
  })
  it('does not overwrite a newer window snapshot with a delayed save response', async () => {
    let finishWrite!: (value: unknown) => void
    vi.mocked(invoke).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishWrite = resolve
        }),
    )
    const update = state.updateKeyBinding('app_save.default', ['Ctrl', 'a'])
    const oldSnapshot = {
      rules: stored.map((rule) =>
        rule.command === 'app_save' ? { ...rule, keys: ['Ctrl', 'a'] } : rule,
      ),
      revision: ++revision,
    }
    stored = stored.map((rule) =>
      rule.command === 'app_save' ? { ...rule, keys: ['Ctrl', 'd'] } : rule,
    )
    await act(async () => state.reload())
    await act(async () => {
      finishWrite(oldSnapshot)
      await update
    })
    expect(press('a').defaultPrevented).toBe(false)
    expect(press('d').defaultPrevented).toBe(true)
    expect(state.keyboardInfos.find((rule) => rule.command === 'app_save')?.keys).toEqual([
      'Ctrl',
      'd',
    ])
  })
  it('keeps invalid bindings editable without intercepting normal typing', async () => {
    stored[0] = { ...stored[0], keys: ['s'] }
    await act(async () => state.reload())
    expect(press('s', { ctrlKey: false }).defaultPrevented).toBe(false)
    expect(save).not.toHaveBeenCalled()
    expect(state.keyboardInfos[0].keys).toEqual(['s'])
  })
  it('ignores an older read failure after a newer snapshot has loaded', async () => {
    let rejectRead!: (error: Error) => void
    vi.mocked(invoke).mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectRead = reject
        }),
    )
    const oldRead = state.reload()
    await act(async () => state.reload())
    await act(async () => {
      rejectRead(new Error('Stale read'))
      await oldRead
    })
    expect(state.loadError).toBeUndefined()
    expect(state.keyboardInfos).toHaveLength(3)
  })
  it('ignores an older read failure after a save has applied a newer snapshot', async () => {
    let failRead!: (error: Error) => void
    vi.mocked(invoke).mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          failRead = reject
        }),
    )
    const read = state.reload()
    await act(async () => state.updateKeyBinding('app_save.default', ['Ctrl', 'a']))
    await act(async () => {
      failRead(new Error('Stale read'))
      await read
    })
    expect(state.loadError).toBeUndefined()
    expect(press('a').defaultPrevented).toBe(true)
  })
})
