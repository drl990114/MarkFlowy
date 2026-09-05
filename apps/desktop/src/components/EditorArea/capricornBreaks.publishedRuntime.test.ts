import { act } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { createCapricornRuntime } from 'virtual:markflowy-capricorn-runtime'
import { isCapricornRuntimeAvailable } from '@/constants/capricornRuntime'
import {
  CAPRICORN_DESKTOP_VIRTUALIZE_OPTIONS,
  type CapricornRuntimeFactory,
  type CapricornRuntimeSession,
} from './capricornRuntimeAdapter'
import { getCapricornRuntimeInput } from './capricornRuntimeDom'

const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
const setNativeValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!
let session: CapricornRuntimeSession | undefined

afterEach(async () => {
  await act(async () => session?.destroy())
  session = undefined
  document.body.replaceChildren()
})

async function mount(markdown: string) {
  const container = document.createElement('div')
  document.body.append(container)
  await act(async () => {
    session = (createCapricornRuntime as CapricornRuntimeFactory)(container, {
      markdown,
      autoFocus: true,
      virtualize: CAPRICORN_DESKTOP_VIRTUALIZE_OPTIONS,
    })
    await frame()
    await frame()
  })
  await act(async () => {
    session!.focus()
    await frame()
  })
  const input = getCapricornRuntimeInput(container)!
  expect(input).not.toBeNull()
  expect(document.activeElement).toBe(input)
  return { container, input }
}

async function type(input: HTMLTextAreaElement, text: string) {
  for (const character of text) {
    await act(async () => {
      setNativeValue.call(input, input.value + character)
      input.dispatchEvent(
        new InputEvent('input', { inputType: 'insertText', data: character, bubbles: true }),
      )
    })
  }
}

async function enter(input: HTMLTextAreaElement, mode: string, shiftKey = false) {
  await act(async () => {
    if (mode === 'keyboard') {
      const keydown = new KeyboardEvent('keydown', {
        key: 'Enter',
        keyCode: 13,
        shiftKey,
        bubbles: true,
        cancelable: true,
      })
      input.dispatchEvent(keydown)
      expect(keydown.defaultPrevented).toBe(true)
    }
    const beforeInput = new InputEvent('beforeinput', {
      inputType: shiftKey ? 'insertLineBreak' : 'insertParagraph',
      bubbles: true,
      cancelable: true,
    })
    input.dispatchEvent(beforeInput)
    expect(beforeInput.defaultPrevented).toBe(true)
    input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }))
    await frame()
  })
  expect(document.activeElement).toBe(input)
}

describe.skipIf(!isCapricornRuntimeAvailable)('published Capricorn breaks in Desktop', () => {
  it.each(['keyboard', 'beforeinput'])(
    'preserves single and double newlines via %s',
    async (mode) => {
      const { input } = await mount('')
      await type(input, 'alpha')
      await enter(input, mode, true)
      await type(input, 'beta')
      await enter(input, mode)
      await type(input, 'gamma')
      expect(session!.getMarkdown()).toBe('alpha\nbeta\n\ngamma')
    },
  )

  it.each(['---', '—-', '___ ', '*** '])(
    'converts %s and keeps subsequent text editable',
    async (prefix) => {
      const { container, input } = await mount('')
      await type(input, prefix)
      expect(container.querySelectorAll('hr')).toHaveLength(1)
      await type(input, 'after')
      expect(session!.getMarkdown()).toBe('---\n\nafter')
      expect(document.activeElement).toBe(input)
    },
  )

  it.each([
    ['keyboard', false],
    ['keyboard', true],
    ['beforeinput', false],
    ['beforeinput', true],
  ] as const)('keeps table typing and undo working via %s (shift=%s)', async (mode, shiftKey) => {
    const { container, input } = await mount('| A | B |\n| --- | --- |\n| body | neighbor |')
    // Navigate through the same table key handler as the host, without private controller access.
    for (let index = 0; index < 2; index++) {
      await act(async () => {
        const tab = new KeyboardEvent('keydown', {
          key: 'Tab',
          bubbles: true,
          cancelable: true,
        })
        input.dispatchEvent(tab)
        expect(tab.defaultPrevented).toBe(true)
        input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Tab', bubbles: true }))
      })
    }
    await type(input, 'x')
    await enter(input, mode, shiftKey)
    await type(input, 'y')
    await enter(input, mode, shiftKey)
    await type(input, 'z')
    const expected = '| A | B |\n| --- | --- |\n| x<br>y<br>zbody | neighbor |'
    expect(session!.getMarkdown()).toBe(expected)
    const breaks = container.querySelectorAll('br[data-markdown-break="hard-break"]')
    expect(breaks).toHaveLength(2)
    for (const br of breaks) {
      expect(br.parentElement?.getAttribute('data-markdown-block')).toBe('table-cell')
      expect(br.hasAttribute('data-cap-key')).toBe(true)
    }
    await act(async () => session!.commands.undo())
    await act(async () => session!.commands.redo())
    expect(session!.getMarkdown()).toBe(expected)
    await type(input, '!')
    expect(session!.getMarkdown()).toBe(expected.replace('zbody', 'z!body'))
    expect(document.activeElement).toBe(input)
  })
})
