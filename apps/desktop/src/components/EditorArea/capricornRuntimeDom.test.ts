import { act } from '@testing-library/react'
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

function mountSurface(documentKey: string) {
  const container = document.createElement('div')
  const content = document.createElement('div')
  content.setAttribute('data-cap-content', 'true')
  const documentNode = document.createElement('div')
  documentNode.setAttribute('data-cap-editable', 'true')
  documentNode.setAttribute('data-cap-key', documentKey)
  content.append(documentNode)
  container.append(content)
  const input = document.createElement('textarea')
  input.setAttribute('data-cap-input', 'true')
  input.setAttribute('data-cap-dockey', documentKey)
  document.body.append(container, input)
  return { container, documentNode, input }
}

describe('Capricorn runtime DOM bridge', () => {
  it('pairs the document node with its body-portal input without interpolating keys into selectors', () => {
    const other = mountSurface('other')
    const current = mountSurface('document"[key]#\\')
    expect(current.container.querySelector('textarea')).toBeNull()
    expect(getCapricornRuntimeInput(current.container)).toBe(current.input)
    expect(getCapricornRuntimeInput(other.container)).toBe(other.input)
    current.documentNode.removeAttribute('data-cap-key')
    expect(getCapricornRuntimeInput(current.container)).toBeNull()
  })

  it('ignores other split panes and invokes the listener before the runtime input handler', () => {
    const current = mountSurface('current')
    const other = mountSurface('other')
    const calls: string[] = []
    cleanups.push(subscribeCapricornBeforeInput(current.container, () => calls.push('host')))
    current.input.addEventListener('beforeinput', () => calls.push('runtime'))
    other.input.dispatchEvent(new InputEvent('beforeinput', { bubbles: true }))
    expect(calls).toEqual([])
    current.input.dispatchEvent(new InputEvent('beforeinput', { bubbles: true }))
    expect(calls).toEqual(['host', 'runtime'])
  })

  it('follows a replaced document key without a watcher and rejects the old input', () => {
    const current = mountSurface('before')
    const next = document.createElement('textarea')
    next.setAttribute('data-cap-input', 'true')
    next.setAttribute('data-cap-dockey', 'after')
    document.body.append(next)
    const listener = vi.fn()
    cleanups.push(subscribeCapricornBeforeInput(current.container, listener))
    current.documentNode.setAttribute('data-cap-key', 'after')
    expect(getCapricornRuntimeInput(current.container)).toBe(next)
    current.input.dispatchEvent(new InputEvent('beforeinput', { bubbles: true }))
    expect(listener).not.toHaveBeenCalled()
    next.dispatchEvent(new InputEvent('beforeinput', { bubbles: true }))
    expect(listener).toHaveBeenCalledOnce()
  })

  it('observes actual CodeMirror typing before its stopped bubble, excluding readonly and nested editors', () => {
    const current = mountSurface('current')
    const other = mountSurface('other')
    const calls: string[] = []
    cleanups.push(subscribeCapricornBeforeInput(current.container, () => calls.push('host')))
    const editable = document.createElement('div')
    editable.className = 'cm-content'
    editable.setAttribute('contenteditable', 'true')
    current.documentNode.append(editable)
    editable.addEventListener('beforeinput', (event) => {
      event.stopPropagation()
      calls.push('codemirror')
    })
    editable.dispatchEvent(new InputEvent('beforeinput', { bubbles: true }))
    expect(calls).toEqual(['host', 'codemirror'])
    calls.length = 0
    editable.setAttribute('contenteditable', 'false')
    editable.dispatchEvent(new InputEvent('beforeinput', { bubbles: true }))
    expect(calls).toEqual(['codemirror'])
    calls.length = 0
    editable.setAttribute('contenteditable', 'true')
    other.documentNode.append(editable)
    current.documentNode.append(other.container)
    editable.dispatchEvent(new InputEvent('beforeinput', { bubbles: true }))
    expect(calls).toEqual(['codemirror'])
  })

  it('ignores disabled inputs, disconnected surfaces, and removes its capture listener', () => {
    const current = mountSurface('current')
    const listener = vi.fn()
    const unsubscribe = subscribeCapricornBeforeInput(current.container, listener)
    cleanups.push(unsubscribe)
    current.input.readOnly = true
    current.input.dispatchEvent(new InputEvent('beforeinput', { bubbles: true }))
    current.input.readOnly = false
    current.container.remove()
    expect(getCapricornRuntimeInput(current.container)).toBeNull()
    current.input.dispatchEvent(new InputEvent('beforeinput', { bubbles: true }))
    document.body.append(current.container)
    unsubscribe()
    current.input.dispatchEvent(new InputEvent('beforeinput', { bubbles: true }))
    expect(listener).not.toHaveBeenCalled()
  })

  it('does not mistake a block key or a nested editor for the runtime document', () => {
    const current = mountSurface('current')
    current.documentNode.removeAttribute('data-cap-editable')
    expect(getCapricornRuntimeInput(current.container)).toBeNull()
    const nested = mountSurface('nested')
    current.documentNode.append(nested.container)
    expect(getCapricornRuntimeInput(current.container)).toBeNull()
  })
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
    const input = container.querySelector<HTMLElement>('.cm-content[contenteditable="true"]')
    expect(input).not.toBeNull()
    const listener = vi.fn()
    cleanups.push(subscribeCapricornBeforeInput(container, listener))
    await act(async () => input!.dispatchEvent(new InputEvent('beforeinput', { bubbles: true })))
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
