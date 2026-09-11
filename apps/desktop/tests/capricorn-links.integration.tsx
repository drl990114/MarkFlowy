import { act, fireEvent } from '@testing-library/react'
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

test('host adapter preserves paths, opens with a modifier and hot-switches editing mode', async () => {
  const container = document.createElement('div')
  document.body.append(container)
  const markdown = '  [doc](./my notes/中文.md)  tail  '
  const open = vi.fn()
  await act(async () => {
    adapter = createCapricornRuntimeAdapter({
      container,
      createRuntime: createCapricornRuntime as CapricornRuntimeFactory,
      onChange: vi.fn(),
      options: { markdown, handleLinkClick: open, autoFocus: false, virtualize: { enable: false } },
    })
  })
  expect(adapter!.getMarkdown()).toBe(markdown)
  const link = container.querySelector('a')!
  await act(async () => fireEvent.click(link, { ctrlKey: true }))
  expect(open).toHaveBeenCalledExactlyOnceWith('./my notes/中文.md')
  await act(async () => adapter!.updateSettings({ linkEditMode: 'markdown' }))
  await act(async () => fireEvent.click(link))
  expect(container.querySelector('[data-cap-inline-source] .cm-content')).not.toBeNull()
  expect(adapter!.getMarkdown()).toBe(markdown)
  await act(async () => adapter!.updateSettings({ linkEditMode: 'popover' }))
  expect(container.querySelector('[data-cap-inline-source]')).toBeNull()
  expect(adapter!.getMarkdown()).toBe(markdown)
})
