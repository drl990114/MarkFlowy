import { act, useEffect, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { commandRegistry, keybindingRegistry } from '@/commands'
import { getDefaultKeybindings } from '@/commands/keybindingCatalog'
import { EVENT } from '@/constants'
import { Dialog } from '@/components/ui/dialog'
import { CommandPaletteDialog } from './CommandPaletteDialog'
import { useCommandHistoryStore } from './useCommandHistoryStore'
import { releaseEditorCommandTarget } from './editorCommands'
import { toast } from 'zens'

const controls = vi.hoisted(() => ({
  blocked: false,
  run: vi.fn<(id: string) => boolean | Promise<boolean>>(),
  next: () => {},
}))
vi.mock('@/helper/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn() } }))
vi.mock('zens', () => ({ toast: { error: vi.fn() } }))
vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('./usePaletteUpdates', () => ({ usePaletteUpdates: () => {} }))
vi.mock('./editorCommands', () => ({
  captureEditorCommandTarget: () => null,
  releaseEditorCommandTarget: vi.fn(),
}))
vi.mock('./paletteCommands', () => ({
  COMMAND_CATEGORIES: ['file', 'editor', 'view', 'app'],
  paletteCommands: [
    ['app_save', 'Save', 'file'],
    ['app_openSetting', 'Settings', 'app'],
    ['app_quickOpen', 'Files', 'file'],
    ['editor_insertLink', 'Link', 'editor'],
    ['editor_insertImage', 'Image', 'editor'],
    ['disabled', 'Unavailable', 'view'],
  ].map(([id, labelKey, category]) => ({
    id,
    labelKey,
    category,
    keywords: [labelKey],
    getUnavailableReason: () => (id === 'disabled' || controls.blocked ? 'no_document' : undefined),
    execute: () => controls.run(id),
  })),
}))

function Harness() {
  const [nextOpen, setNextOpen] = useState(false)
  useEffect(() => {
    controls.next = () => setNextOpen(true)
  }, [])
  return (
    <>
      <CommandPaletteDialog />
      <Dialog.Root open={nextOpen} onOpenChange={setNextOpen}>
        <Dialog.Content aria-describedby={undefined}>
          <Dialog.Title>Destination</Dialog.Title>
          <input data-destination='' aria-label='Destination input' />
        </Dialog.Content>
      </Dialog.Root>
    </>
  )
}

const reactEnvironment = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
beforeAll(() => {
  reactEnvironment.IS_REACT_ACT_ENVIRONMENT = true
})
afterAll(() => {
  delete reactEnvironment.IS_REACT_ACT_ENVIRONMENT
})

describe('command palette interaction', () => {
  let root: Root
  let container: HTMLDivElement
  let origin: HTMLButtonElement
  beforeEach(() => {
    vi.clearAllMocks()
    controls.blocked = false
    controls.run.mockReturnValue(true)
    useCommandHistoryStore.setState({ recent: [] })
    keybindingRegistry.setKeybindings(getDefaultKeybindings('linux'))
    origin = document.createElement('button')
    container = document.createElement('div')
    document.body.append(origin, container)
    origin.focus()
    root = createRoot(container)
    act(() => root.render(<Harness />))
  })
  afterEach(async () => {
    await act(async () => root.unmount())
    await settle()
    container.remove()
    origin.remove()
  })
  async function settle() {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
  }
  async function open() {
    await act(async () => {
      await commandRegistry.execute(EVENT.app_commandPalette)
    })
  }
  function input() {
    return document.querySelector<HTMLInputElement>('[cmdk-input]')!
  }
  async function type(value: string) {
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(
        input(),
        value,
      )
      input().dispatchEvent(new Event('input', { bubbles: true }))
    })
  }
  async function key(keyName: string, extra: KeyboardEventInit = {}) {
    await act(async () => {
      input().dispatchEvent(
        new KeyboardEvent('keydown', { key: keyName, ...extra, bubbles: true, cancelable: true }),
      )
    })
  }
  async function click(id: string) {
    await act(async () =>
      document.querySelector<HTMLElement>(`[cmdk-item][data-value="${id}"]`)!.click(),
    )
  }

  it('focuses, navigates, searches and executes only once before recording history', async () => {
    await open()
    expect(document.activeElement).toBe(input())
    await key('ArrowDown')
    expect(
      document.querySelector('[cmdk-item][data-selected="true"]')?.getAttribute('data-value'),
    ).toBe('app_quickOpen')
    await type('Save')
    const searchInput = input()
    await act(async () => {
      searchInput.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
      )
      searchInput.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
      )
    })
    await settle()
    expect(controls.run).toHaveBeenCalledExactlyOnceWith('app_save')
    expect(useCommandHistoryStore.getState().recent).toEqual(['app_save'])
    expect(document.querySelector('[data-mf-command-palette]')).toBeNull()
    expect(releaseEditorCommandTarget).toHaveBeenCalledOnce()
  })

  it('ignores composing/repeated confirmation and Escape, then restores the trigger on cancellation', async () => {
    await open()
    await key('Enter', { isComposing: true })
    await key('Enter', { keyCode: 229 })
    await key('Enter', { repeat: true })
    await key('Escape', { isComposing: true })
    expect(input()).not.toBeNull()
    expect(controls.run).not.toHaveBeenCalled()
    await key('Escape')
    await settle()
    expect(document.activeElement).toBe(origin)
    expect(useCommandHistoryStore.getState().recent).toEqual([])
  })

  it('reselects the query on repeated opening and shows an empty result', async () => {
    await open()
    await type('zzzzzz')
    expect(document.querySelector('[cmdk-empty]')?.textContent).toBe('command_palette.empty')
    await open()
    expect(input().selectionStart).toBe(0)
    expect(input().selectionEnd).toBe(6)
    await key('Enter')
    expect(controls.run).not.toHaveBeenCalled()
  })

  it('dismisses from the overlay without executing or recording a command', async () => {
    await open()
    await settle()
    await act(async () => {
      const overlay = document.querySelector('[data-slot="dialog-overlay"]')!
      overlay.dispatchEvent(
        new PointerEvent('pointerdown', {
          bubbles: true,
          cancelable: true,
          pointerType: 'mouse',
          button: 0,
        }),
      )
      overlay.dispatchEvent(
        new PointerEvent('pointerup', {
          bubbles: true,
          cancelable: true,
          pointerType: 'mouse',
          button: 0,
        }),
      )
      overlay.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }))
    })
    await settle()
    expect(document.querySelector('[data-mf-command-palette]')).toBeNull()
    expect(document.activeElement).toBe(origin)
    expect(controls.run).not.toHaveBeenCalled()
  })

  it('retains disabled commands with a reason and rechecks eligibility before execution', async () => {
    await open()
    await type('Unavailable')
    const row = document.querySelector('[cmdk-item]')!
    expect(row.getAttribute('aria-disabled')).toBe('true')
    expect(row.textContent).toContain('command_palette.reasons.no_document')
    await click('disabled')
    await key('Enter')
    expect(controls.run).not.toHaveBeenCalled()
    await type('Save')
    controls.blocked = true
    await click('app_save')
    expect(input()).not.toBeNull()
    expect(controls.run).not.toHaveBeenCalled()
  })

  it('puts recent commands first without duplicates and updates customized shortcuts live', async () => {
    useCommandHistoryStore.setState({ recent: ['editor_insertImage', 'app_save', 'unknown'] })
    await open()
    expect(
      [...document.querySelectorAll('[cmdk-item]')]
        .slice(0, 2)
        .map((item) => item.getAttribute('data-value')),
    ).toEqual(['editor_insertImage', 'app_save'])
    expect(document.querySelectorAll('[cmdk-item]')).toHaveLength(6)
    await act(async () =>
      keybindingRegistry.setKeybindings(
        getDefaultKeybindings('linux').map((binding) =>
          binding.command === 'app_save' ? { ...binding, keys: ['Alt', 's'] } : binding,
        ),
      ),
    )
    expect(
      [...document.querySelectorAll('[data-value="app_save"] kbd')].map((cap) => cap.textContent),
    ).toEqual(['Alt', 'S'])
    await act(async () =>
      keybindingRegistry.setKeybindings(
        getDefaultKeybindings('linux').map((binding) =>
          binding.command === 'app_save' ? { ...binding, keys: [] } : binding,
        ),
      ),
    )
    expect(document.querySelector('[data-value="app_save"] kbd')).toBeNull()
  })

  it.each(['app_openSetting', 'app_quickOpen', 'editor_insertLink', 'editor_insertImage'])(
    'releases the old dialog before %s opens its destination',
    async (id) => {
      controls.run.mockImplementation(() => {
        expect(document.querySelector('[data-mf-command-palette]')).toBeNull()
        controls.next()
        return true
      })
      await open()
      await click(id)
      await settle()
      await settle()
      expect(controls.run).toHaveBeenCalledExactlyOnceWith(id)
      expect(document.activeElement).toBe(document.querySelector('[data-destination]'))
      expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1)
    },
  )

  it('reports a failed execution without writing history or leaving the dialog open', async () => {
    controls.run.mockRejectedValueOnce(new Error('failed'))
    await open()
    await click('app_save')
    await settle()
    expect(toast.error).toHaveBeenCalledWith('command_palette.failed')
    expect(useCommandHistoryStore.getState().recent).toEqual([])
    expect(document.querySelector('[data-mf-command-palette]')).toBeNull()
  })
})
