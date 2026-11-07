// @vitest-environment jsdom
import { createCapricornRuntime } from 'virtual:markflowy-capricorn-runtime'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { act } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import postcss from 'postcss'
import type {
  CapricornRuntimeFactory,
  CapricornRuntimeSession,
} from '@/components/EditorArea/capricornRuntimeAdapter'
import { paragraphIndentationStyle } from '@/components/EditorArea/paragraphIndentation'

const css = readFileSync(resolve(process.cwd(), 'src/components/EditorArea/paragraphIndentation.css'), 'utf8')

const markdown = [
  '# Heading',
  'Body **paragraph** with `inline code`.',
  '> Quoted paragraph.',
  '- List paragraph.\n\n  Continued list paragraph.',
  '- [ ] Task paragraph.',
  '| Header |\n| --- |\n| Cell |',
  '```text\nCode paragraph\n```',
  'Last paragraph.',
].join('\n\n')

let session: CapricornRuntimeSession | undefined
const rangeGeometry = ['getClientRects', 'getBoundingClientRect'].map(
  (name) => [name, Object.getOwnPropertyDescriptor(Range.prototype, name)] as const,
)
beforeAll(() => {
  Object.defineProperties(Range.prototype, {
    getClientRects: { configurable: true, value: () => [] },
    getBoundingClientRect: { configurable: true, value: () => new DOMRect() },
  })
})
afterAll(() => {
  for (const [name, descriptor] of rangeGeometry) {
    if (descriptor) Object.defineProperty(Range.prototype, name, descriptor)
    else Reflect.deleteProperty(Range.prototype, name)
  }
})
afterEach(async () => {
  await act(async () => session?.destroy())
  session = undefined
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

describe('paragraph indentation against the published Capricorn DOM', () => {
  it.each(['edit', 'preview'] as const)(
    'targets only top-level paragraphs and leaves %s Markdown unchanged',
    async (mode) => {
      const root = document.createElement('div')
      root.className = 'mf-editor-content'
      document.body.append(root)
      await act(async () => {
        session = (createCapricornRuntime as CapricornRuntimeFactory)(root, {
          markdown,
          mode,
          autoFocus: false,
          virtualize: { enable: false },
          style: paragraphIndentationStyle(false),
        })
      })
      const rules = postcss.parse(css).nodes.filter((node) => node.type === 'rule')
      const selector = rules.map((rule) => rule.selector).join(',')
      const paragraphs = [...document.querySelectorAll(selector)]
      expect(paragraphs).toHaveLength(2)
      expect(paragraphs[0].textContent).toContain('Body ')
      expect(paragraphs[1].textContent).toBe('Last paragraph.')
      const editor = session!
      const before = editor.getMarkdown()
      for (const enabled of [true, false]) {
        await act(async () => editor.updateSettings({ style: paragraphIndentationStyle(enabled) }))
        const content = root.querySelector<HTMLElement>('[data-cap-content]')!
        expect(content.style.getPropertyValue('--mf-paragraph-first-line-indent')).toBe(enabled ? '2em' : '0')
        expect(editor.getMarkdown()).toBe(before)
      }
    },
  )
})
