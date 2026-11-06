import { act, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createCapricornRuntime } from 'virtual:markflowy-capricorn-runtime'
import { isCapricornRuntimeAvailable } from '@/constants/capricornRuntime'
import type { CapricornRuntimeFactory, CapricornRuntimeSession } from './capricornRuntimeAdapter'
import { getCapricornRuntimeInput, subscribeCapricornBeforeInput } from './capricornRuntimeDom'

const cleanups: (() => void)[] = []
afterEach(() => {
  cleanups
    .splice(0)
    .reverse()
    .forEach((cleanup) => cleanup())
  document.body.replaceChildren()
})

describe.skipIf(!isCapricornRuntimeAvailable)('installed Capricorn DOM bridge', () => {
  it('captures beforeinput from the actual installed CodeMirror source editor', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    let session!: CapricornRuntimeSession
    await act(async () => {
      session = (createCapricornRuntime as CapricornRuntimeFactory)(container, {
        markdown: '```text\nhello\n```',
      })
    })
    cleanups.push(() => act(() => session.destroy()))
    const input = await waitFor(() => {
      const content = container.querySelector<HTMLElement>('.cm-content[contenteditable="true"]')
      expect(content).not.toBeNull()
      return content!
    })
    const listener = vi.fn()
    cleanups.push(subscribeCapricornBeforeInput(container, listener))
    await act(async () => input.dispatchEvent(new InputEvent('beforeinput', { bubbles: true })))
    expect(listener).toHaveBeenCalledOnce()
  })

  it.each(['', '# Actual document'])(
    'matches the real portal for %j and after setMarkdown',
    async (markdown) => {
      const container = document.createElement('div')
      document.body.append(container)
      let session!: CapricornRuntimeSession
      await act(async () => {
        session = (createCapricornRuntime as CapricornRuntimeFactory)(container, { markdown })
      })
      cleanups.push(() => act(() => session.destroy()))
      const input = getCapricornRuntimeInput(container)
      expect(input).not.toBeNull()
      expect(container.contains(input)).toBe(false)
      const documentNode = container.querySelector('[data-cap-editable][data-cap-key]')
      expect(input!.getAttribute('data-cap-dockey')).toBe(
        documentNode!.getAttribute('data-cap-key'),
      )
      const listener = vi.fn()
      cleanups.push(subscribeCapricornBeforeInput(container, listener))
      await act(async () => session.setMarkdown('# Replacement'))
      const replacementInput = getCapricornRuntimeInput(container)
      expect(replacementInput).not.toBeNull()
      // An empty synthetic beforeinput leaves the document unchanged while
      // exercising the same native capture route as typing into the body portal.
      await act(async () =>
        replacementInput!.dispatchEvent(new InputEvent('beforeinput', { bubbles: true })),
      )
      expect(listener).toHaveBeenCalledOnce()
    },
  )
})
