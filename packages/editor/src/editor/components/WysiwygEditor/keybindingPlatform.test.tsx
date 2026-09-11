import { Remirror } from '@rme-sdk/sdk/react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import { createSourceCodeDelegate } from '../SourceEditor/delegate'
import type { MfCodemirrorView } from '../../codemirror/codemirror'

describe('Source Code layout and AltGraph input', () => {
  it.each([
    ['US Shift+1', 'Ctrl-Shift-!', '!', 'Digit1', 49, true, false, false, '**Body**'],
    [
      'US key does not match a French semantic binding',
      'Ctrl-Shift-1',
      '!',
      'Digit1',
      49,
      true,
      false,
      false,
      'Body',
    ],
    ['French Shift+1', 'Ctrl-Shift-1', '1', 'Digit1', 49, true, false, false, '**Body**'],
    ['German Shift+7', 'Ctrl-Shift-/', '/', 'Digit7', 55, true, false, false, '**Body**'],
    ['AltGraph Numpad', 'Ctrl-Alt-[Numpad1]', '1', 'Numpad1', 97, false, true, true, 'Body'],
  ])(
    '%s respects the recorded shortcut and composition modifiers',
    async (_label, shortcut, key, code, keyCode, shiftKey, altKey, altGraph, expected) => {
      let source: MfCodemirrorView | undefined
      const delegate = createSourceCodeDelegate({
        onCodemirrorViewLoad: (view) => {
          source = view
        },
        disableAllBuildInShortcuts: true,
        overrideShortcutMap: { toggleStrong: shortcut as string },
      })
      const host = document.createElement('div')
      document.body.append(host)
      const root = createRoot(host)
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
        const event = new KeyboardEvent('keydown', {
          key: key as string,
          code: code as string,
          keyCode: keyCode as number,
          ctrlKey: true,
          shiftKey: shiftKey as boolean,
          altKey: altKey as boolean,
          bubbles: true,
          cancelable: true,
        })
        Object.defineProperty(event, 'getModifierState', {
          value: (modifier: string) => modifier === 'AltGraph' && altGraph,
        })
        await act(async () => cm.contentDOM.dispatchEvent(event))
        expect(cm.state.doc.toString()).toBe(expected)
        if (altGraph) expect(event.defaultPrevented).toBe(false)
      } finally {
        await act(async () => root.unmount())
        delegate.manager.destroy()
        host.remove()
      }
    },
  )
})
