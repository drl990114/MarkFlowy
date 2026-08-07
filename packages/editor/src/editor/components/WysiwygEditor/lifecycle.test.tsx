import { Remirror } from '@rme-sdk/sdk/react'
import { StrictMode } from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'

import { createWysiwygDelegate } from './delegate'

describe('WYSIWYG delegate lifecycle', () => {
  it('remounts the same borrowed manager through the pinned RME package', async () => {
    const delegate = createWysiwygDelegate()
    const initialContent = delegate.stringToDoc('')
    const { manager } = delegate
    const firstContainer = document.createElement('div')
    const secondContainer = document.createElement('div')
    const firstRoot = createRoot(firstContainer)
    const secondRoot = createRoot(secondContainer)
    let firstMounted = false
    let secondMounted = false

    try {
      await act(async () => {
        firstRoot.render(
          <StrictMode>
            <Remirror autoRender initialContent={initialContent} manager={manager} />
          </StrictMode>,
        )
      })
      firstMounted = true

      expect(manager.destroyed).toBe(false)
      expect(manager.frameworkAttached).toBe(true)
      expect(firstContainer.contains(manager.view.dom)).toBe(true)

      await act(async () => {
        manager.view.dispatch(manager.view.state.tr.insertText('a'))
      })
      expect(manager.view.state.doc.textContent).toBe('a')

      await act(async () => {
        firstRoot.unmount()
      })
      firstMounted = false

      expect(manager.frameworkAttached).toBe(false)
      expect(manager.destroyed).toBe(false)

      await act(async () => {
        secondRoot.render(
          <StrictMode>
            <Remirror autoRender initialContent={initialContent} manager={manager} />
          </StrictMode>,
        )
      })
      secondMounted = true

      expect(manager.destroyed).toBe(false)
      expect(manager.frameworkAttached).toBe(true)
      expect(secondContainer.contains(manager.view.dom)).toBe(true)

      await act(async () => {
        manager.view.dispatch(manager.view.state.tr.insertText('b'))
      })
      expect(manager.view.state.doc.textContent).toBe('ab')

      await act(async () => {
        secondRoot.unmount()
      })
      secondMounted = false

      expect(manager.frameworkAttached).toBe(false)
      expect(manager.destroyed).toBe(false)
    } finally {
      if (secondMounted) {
        await act(async () => {
          secondRoot.unmount()
        })
      }

      if (firstMounted) {
        await act(async () => {
          firstRoot.unmount()
        })
      }

      manager.destroy()
      expect(manager.destroyed).toBe(true)
    }
  })
})
