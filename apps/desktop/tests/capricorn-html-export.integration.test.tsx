import { isCapricornRuntimeAvailable } from '@/constants/capricornRuntime'
import { exportHtmlDocument } from '@/components/EditorArea/exportHtmlDocument'
import { act } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { createCapricornRuntime } from 'virtual:markflowy-capricorn-runtime'
import {
  createCapricornRuntimeAdapter,
  type CapricornRuntimeAdapter,
  type CapricornRuntimeFactory,
} from '@/components/EditorArea/capricornRuntimeAdapter'

let adapter: CapricornRuntimeAdapter | undefined
afterEach(async () => {
  await act(async () => adapter?.destroy())
  adapter = undefined
  document.body.replaceChildren()
})

test.skipIf(!isCapricornRuntimeAvailable)(
  'portable HTML anchors match the published Capricorn heading API',
  async () => {
    const headings = [
      '表格 Table',
      '中文标题 🧪',
      'Hi, world! ✨',
      'a',
      'a',
      'a-1',
      '重复',
      '重复',
      '重复-1',
    ]
    const container = document.createElement('div')
    document.body.append(container)
    await act(async () => {
      adapter = createCapricornRuntimeAdapter({
        container,
        createRuntime: createCapricornRuntime as CapricornRuntimeFactory,
        onChange: vi.fn(),
        options: {
          markdown: headings.map((text) => `## ${text}`).join('\n\n'),
          autoFocus: false,
          virtualize: { enable: false },
        },
      })
    })
    const root = document.createElement('div')
    for (const text of headings) {
      const heading = document.createElement('h2')
      heading.textContent = text
      root.append(heading)
    }
    const html = await exportHtmlDocument(root.innerHTML, root, 'Anchors')
    const exported = new DOMParser().parseFromString(html, 'text/html')
    const actual = [...exported.querySelectorAll('h2')].map((heading) => heading.id)
    expect(actual).toEqual(adapter!.headings.getAll().map((heading) => heading.anchor))
    expect(actual[0]).toBe('表格-table')
    expect(new Set(actual).size).toBe(headings.length)
  },
)
