import { Remirror } from '@rme-sdk/sdk/react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import { indentUnit } from '@codemirror/language'
import { createWysiwygDelegate } from './delegate'
import { createSourceCodeDelegate } from '../SourceEditor/delegate'
import { LineCodeMirrorExtension } from '../../extensions/CodeMirror/codemirror-extension'
import type { MfCodemirrorView } from '../../codemirror/codemirror'

describe('delegate CodeMirror settings', () => {
  it.each(['source', 'embedded'])(
    'initializes and updates %s options through its owner extension',
    async (profile) => {
      const settings = { indentSize: 8, lineNumbers: 'off', lineWrapping: false } as const
      const delegate =
        profile === 'source'
          ? createSourceCodeDelegate({
              codemirrorOptions: settings,
              onCodemirrorViewLoad: () => {},
            })
          : createWysiwygDelegate({ codemirrorOptions: settings })
      const codeViews: MfCodemirrorView[] = []
      const extension = delegate.manager.getExtension(LineCodeMirrorExtension)
      extension.setOptions({
        hideDecoration: true,
        onCodemirrorViewLoad: (view) => codeViews.push(view),
        codemirrorOptions: { ...settings, indentSize: 4 },
      })
      const host = document.createElement('div')
      document.body.append(host)
      const root = createRoot(host)
      try {
        await act(async () =>
          root.render(
            <Remirror
              autoRender
              initialContent={delegate.stringToDoc(
                profile === 'source' ? 'hello' : '```text\nhello\n```',
              )}
              manager={delegate.manager}
            />,
          ),
        )
        const cm = codeViews[0].cm
        expect(cm.state.tabSize).toBe(4)
        expect(cm.state.facet(indentUnit)).toBe('    ')
        expect(cm.dom.querySelector('.cm-lineNumbers')).toBeNull()
        await act(async () => {
          extension.setOptions({ codemirrorOptions: { lineNumbers: 'all', indentStyle: 'tabs' } })
          await new Promise((resolve) => setTimeout(resolve, 5))
        })
        expect(codeViews[0].cm).toBe(cm)
        expect(cm.state.tabSize).toBe(4)
        expect(cm.state.facet(indentUnit)).toBe('\t')
        expect(cm.dom.querySelector('.cm-lineNumbers')).not.toBeNull()
        if (profile === 'embedded') {
          await act(async () => {
            delegate.manager.view.dispatch(
              delegate.manager.view.state.tr.insert(
                delegate.manager.view.state.doc.content.size,
                delegate.manager.schema.nodes.codeMirror.create(
                  {},
                  delegate.manager.schema.text('next'),
                ),
              ),
            )
          })
          expect(codeViews[1].cm.state.facet(indentUnit)).toBe('\t')
        }
      } finally {
        await act(async () => root.unmount())
        delegate.manager.destroy()
        host.remove()
      }
    },
  )
})
