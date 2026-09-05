import { act, fireEvent } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { createCapricornRuntime } from 'virtual:markflowy-capricorn-runtime'
import { isCapricornRuntimeAvailable } from '@/constants/capricornRuntime'
import {
  CAPRICORN_DESKTOP_VIRTUALIZE_OPTIONS,
  type CapricornRuntimeFactory,
  type CapricornRuntimeSession,
} from './capricornRuntimeAdapter'
import { getCapricornRuntimeInput } from './capricornRuntimeDom'

const source = String.raw`Emoji 短代码：:rocket: :tada: :white\_check\_mark:，:rocket:`
const glyphs = ['🚀', '🎉', '✅', '🚀']
const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
const setNativeValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!
let session: CapricornRuntimeSession | undefined

afterEach(async () => {
  await act(async () => session?.destroy())
  session = undefined
  document.body.replaceChildren()
})

async function mount(markdown: string, mode: 'edit' | 'preview' = 'edit') {
  const container = document.createElement('div')
  document.body.append(container)
  await act(async () => {
    session = (createCapricornRuntime as CapricornRuntimeFactory)(container, {
      markdown,
      mode,
      autoFocus: mode === 'edit',
      virtualize: CAPRICORN_DESKTOP_VIRTUALIZE_OPTIONS,
    })
    await frame()
    await frame()
  })
  if (mode === 'edit') {
    await act(async () => {
      session!.focus()
      await frame()
    })
  }
  return { container, input: getCapricornRuntimeInput(container)! }
}

async function type(input: HTMLTextAreaElement, text: string) {
  expect(document.activeElement).toBe(input)
  for (const character of text) {
    await act(async () => {
      setNativeValue.call(input, input.value + character)
      input.dispatchEvent(
        new InputEvent('input', { inputType: 'insertText', data: character, bubbles: true }),
      )
    })
  }
}

function renderedEmoji(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll('.capricorn-emoji-preview'),
    (node) => node.textContent,
  )
}

describe.skipIf(!isCapricornRuntimeAvailable)('published Capricorn emoji in Desktop', () => {
  it.each(['edit', 'preview'] as const)(
    'renders escaped shortcodes in %s mode while preserving their Markdown',
    async (mode) => {
      const { container } = await mount(source, mode)
      expect(renderedEmoji(container)).toEqual(glyphs)
      expect(session!.getMarkdown()).toBe(source)
      const html = new DOMParser().parseFromString(await session!.export('html'), 'text/html')
      expect(html.body.textContent).toContain('Emoji 短代码：🚀 🎉 ✅，🚀')
      expect(await session!.export('markdown')).toBe(source)
    },
  )

  it('converts typed shortcodes, reveals their source on click, and keeps edit undo separate', async () => {
    const { container, input } = await mount('')
    await type(input, source)
    expect(renderedEmoji(container)).toEqual(glyphs)
    expect(session!.getMarkdown()).toBe(source)

    await act(async () => {
      fireEvent.mouseDown(container.querySelector('.capricorn-emoji-preview')!)
    })
    const first = container.querySelector('[data-markdown-inline="emoji"]')!
    expect(first.hasAttribute('data-emoji-source-visible')).toBe(true)
    expect(first.querySelector('.capricorn-emoji-source')?.textContent).toBe(':rocket:')
    await type(input, 'x')
    const edited = source.replace(':rocket:', ':rocketx:')
    expect(session!.getMarkdown()).toBe(edited)
    expect(first.querySelector('.capricorn-emoji-preview')).toBeNull()

    await act(async () => session!.commands.undo())
    expect(session!.getMarkdown()).toBe(source)
    await act(async () => session!.commands.redo())
    expect(session!.getMarkdown()).toBe(edited)
    expect(document.activeElement).toBe(input)
  })

  it.each([
    String.raw`\:rocket:`,
    ':not_a_real_emoji:',
    '`:rocket:`',
    'https://example.com/:rocket:',
  ])('keeps typed literal syntax unchanged: %s', async (literal) => {
    const { container, input } = await mount('')
    await type(input, literal)
    expect(renderedEmoji(container)).toEqual([])
    expect(session!.getMarkdown()).toBe(literal)
    expect(document.activeElement).toBe(input)
  })
})
