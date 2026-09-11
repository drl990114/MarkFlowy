import { Remirror } from '@rme-sdk/sdk/react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import { createWysiwygDelegate } from './delegate'
import { KeyboardSettingsExtension } from '../../extensions/Shortcuts/keyboard-settings-extension'
import { createSourceCodeDelegate } from '../SourceEditor/delegate'
import { LineCodeMirrorExtension } from '../../extensions/CodeMirror/codemirror-extension'
import type { MfCodemirrorView } from '../../codemirror/codemirror'

describe('live editor keybindings', () => {
  it('uses configured code-block shortcuts and the outer document history after rebinding', async () => {
    let source: MfCodemirrorView | undefined
    const shortcuts = { toggleStrong: 'Ctrl-Shift-1', undo: 'Ctrl-Alt-z', redo: 'Ctrl-Alt-r' }
    const delegate = createWysiwygDelegate({
      disableAllBuildInShortcuts: true,
      overrideShortcutMap: shortcuts,
    })
    const extension = delegate.manager.getExtension(LineCodeMirrorExtension)
    extension.setOptions({
      hideDecoration: true,
      onCodemirrorViewLoad: (view) => {
        source = view
      },
    })
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    try {
      await act(async () =>
        root.render(
          <Remirror
            autoRender
            initialContent={delegate.stringToDoc('```text\nBody\n```')}
            manager={delegate.manager}
          />,
        ),
      )
      const cm = source!.cm
      const press = async (key: string, options: KeyboardEventInit) =>
        act(async () => {
          cm.contentDOM.dispatchEvent(
            new KeyboardEvent('keydown', {
              key,
              ctrlKey: true,
              bubbles: true,
              cancelable: true,
              ...options,
            }),
          )
        })
      cm.dispatch({ selection: { anchor: 0, head: 4 } })
      await press('1', { code: 'Digit1', shiftKey: true })
      expect(cm.state.doc.toString()).toBe('**Body**')
      const doc = cm.state.doc
      const selection = cm.state.selection
      extension.setOptions({
        commandKeymapOptions: {
          disableAllBuildInShortcuts: true,
          overrideShortcutMap: { ...shortcuts, undo: 'Ctrl-Alt-u' },
        },
      })
      expect(source!.cm).toBe(cm)
      expect(cm.state.doc).toBe(doc)
      expect(cm.state.selection).toBe(selection)
      await press('z', { altKey: true })
      expect(cm.state.doc.toString()).toBe('**Body**')
      await press('u', { altKey: true })
      expect(cm.state.doc.toString()).toBe('Body')
      await press('r', { altKey: true })
      expect(cm.state.doc.toString()).toBe('**Body**')
      expect(delegate.docToString(delegate.manager.view.state.doc)).toContain('**Body**')
    } finally {
      await act(async () => root.unmount())
      delegate.manager.destroy()
      host.remove()
    }
  })
  it('rebinds and disables WYSIWYG commands without replacing the document or undo history', async () => {
    const delegate = createWysiwygDelegate({
      disableAllBuildInShortcuts: true,
      overrideShortcutMap: { toggleH2: 'Ctrl-2', undo: 'Ctrl-z' },
    })
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    const { manager } = delegate
    try {
      await act(async () =>
        root.render(
          <Remirror autoRender initialContent={delegate.stringToDoc('Body')} manager={manager} />,
        ),
      )
      const view = manager.view
      const press = async (key: string) =>
        act(async () => {
          view.dom.dispatchEvent(
            new KeyboardEvent('keydown', { key, ctrlKey: true, bubbles: true, cancelable: true }),
          )
        })
      await press('2')
      expect(delegate.docToString(view.state.doc)).toContain('## Body')
      const doc = view.state.doc
      const selection = view.state.selection
      manager
        .getExtension(KeyboardSettingsExtension)
        .setOptions({ shortcuts: { toggleH2: ['Ctrl-3', 'Ctrl-4'], undo: 'Ctrl-z' } })
      expect(manager.view).toBe(view)
      expect(view.state.doc).toBe(doc)
      expect(view.state.selection).toBe(selection)
      await press('z')
      expect(delegate.docToString(view.state.doc)).not.toContain('##')
      await press('2')
      expect(delegate.docToString(view.state.doc)).not.toContain('##')
      await press('3')
      expect(delegate.docToString(view.state.doc)).toContain('##')
      await press('z')
      await press('4')
      expect(delegate.docToString(view.state.doc)).toContain('##')
      manager.getExtension(KeyboardSettingsExtension).setOptions({ shortcuts: { undo: 'Ctrl-z' } })
      await press('z')
      await press('3')
      expect(delegate.docToString(view.state.doc)).not.toContain('##')
    } finally {
      await act(async () => root.unmount())
      manager.destroy()
      container.remove()
    }
  })
  it('reconfigures a mounted Source Code view and retains history and selection', async () => {
    let source: MfCodemirrorView | undefined
    const delegate = createSourceCodeDelegate({
      onCodemirrorViewLoad: (view) => {
        source = view
      },
      disableAllBuildInShortcuts: true,
      overrideShortcutMap: { toggleStrong: 'Ctrl-1', undo: 'Ctrl-z' },
    })
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    try {
      await act(async () =>
        root.render(
          <Remirror
            autoRender
            initialContent={delegate.stringToDoc('Body')}
            manager={delegate.manager}
          />,
        ),
      )
      const cm = source!.cm
      cm.dispatch({ selection: { anchor: 0, head: 4 } })
      const clipboardBridge = vi.fn()
      const previousExecCommand = document.execCommand
      document.execCommand = clipboardBridge
      try {
        const copy = new KeyboardEvent('keydown', {
          key: 'c',
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        })
        cm.contentDOM.dispatchEvent(copy)
        expect(copy.defaultPrevented).toBe(false)
        expect(clipboardBridge).not.toHaveBeenCalled()
      } finally {
        document.execCommand = previousExecCommand
      }
      const press = async (key: string, code = '') =>
        act(async () => {
          cm.contentDOM.dispatchEvent(
            new KeyboardEvent('keydown', {
              key,
              code,
              ctrlKey: true,
              bubbles: true,
              cancelable: true,
            }),
          )
        })
      await press('1')
      expect(cm.state.doc.toString()).toBe('**Body**')
      const doc = cm.state.doc
      const selection = cm.state.selection
      delegate.manager.getExtension(LineCodeMirrorExtension).setOptions({
        commandKeymapOptions: {
          disableAllBuildInShortcuts: true,
          overrideShortcutMap: { toggleStrong: ['Ctrl-[Numpad2]', 'Ctrl-4'], undo: 'Ctrl-z' },
        },
      })
      expect(source!.cm).toBe(cm)
      expect(cm.state.doc).toBe(doc)
      expect(cm.state.selection).toBe(selection)
      await press('z')
      expect(cm.state.doc.toString()).toBe('Body')
      await press('1')
      expect(cm.state.doc.toString()).toBe('Body')
      cm.dispatch({ selection: { anchor: 0, head: 4 } })
      await press('2', 'Numpad2')
      expect(cm.state.doc.toString()).toBe('**Body**')
      await press('z')
      cm.dispatch({ selection: { anchor: 0, head: 4 } })
      await press('4', 'Digit4')
      expect(cm.state.doc.toString()).toBe('**Body**')
    } finally {
      await act(async () => root.unmount())
      delegate.manager.destroy()
      container.remove()
    }
  })
})
