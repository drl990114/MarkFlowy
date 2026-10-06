import { act, fireEvent, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createCapricornRuntime } from 'virtual:markflowy-capricorn-runtime'
import { isCapricornRuntimeAvailable } from '@/constants/capricornRuntime'
import {
  createCapricornRuntimeAdapter,
  type CapricornRuntimeAdapter,
  type CapricornRuntimeFactory,
  type CapricornRuntimeOptions,
} from '@/components/EditorArea/capricornRuntimeAdapter'
import { getCapricornRuntimeInput } from '@/components/EditorArea/capricornRuntimeDom'

let adapter: CapricornRuntimeAdapter | undefined

afterEach(async () => {
  await act(async () => adapter?.destroy())
  adapter = undefined
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

async function mount(markdown: string, options: Partial<CapricornRuntimeOptions> = {}) {
  const container = document.createElement('div')
  document.body.append(container)
  // Happy DOM has no layout; the runtime's scroll viewport must stay nonzero.
  vi.spyOn(container, 'getBoundingClientRect').mockReturnValue(new DOMRect(40, 40, 800, 600))
  const onChange = vi.fn()
  const onError = vi.fn()
  await act(async () => {
    adapter = createCapricornRuntimeAdapter({
      container,
      createRuntime: createCapricornRuntime as CapricornRuntimeFactory,
      onChange,
      options: { markdown, autoFocus: false, virtualize: { enable: false }, onError, ...options },
    })
  })
  onChange.mockClear()
  return { container, runtime: adapter!, onChange, onError }
}

async function tableMenu(container: HTMLElement, rowIndex: number, columnIndex: number) {
  const root = container.querySelector<HTMLElement>('[data-cap-editable]')!
  vi.spyOn(root, 'getBoundingClientRect').mockReturnValue(new DOMRect(80, 60, 640, 500))
  const rows = Array.from(root.querySelectorAll<HTMLElement>('[role="row"][data-markdown-table]'))
  rows.forEach((row, index) => {
    vi.spyOn(row, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(100, 140 + index * 36, 540, 36),
    )
    row
      .querySelectorAll<HTMLElement>('[role="cell"], [role="columnheader"]')
      .forEach((cell, col) => {
        vi.spyOn(cell, 'getBoundingClientRect').mockReturnValue(
          new DOMRect(100 + col * 180, 140 + index * 36, 180, 36),
        )
      })
  })
  const cell = rows[rowIndex].querySelectorAll<HTMLElement>('[role="cell"], [role="columnheader"]')[
    columnIndex
  ]
  const bounds = cell.getBoundingClientRect()
  await act(async () => {
    fireEvent.contextMenu(cell, { clientX: bounds.x + 10, clientY: bounds.y + 10 })
  })
  await waitFor(() =>
    expect(container.querySelector('[data-cap-markdown-table-menu]')).not.toBeNull(),
  )
  return container.querySelector<HTMLElement>('[data-cap-markdown-table-menu]')!
}

const tableSource = [
  '| 名称 | 备注 | 状态 |',
  '| :--- | :---: | ---: |',
  '| 第一项 | **重点** | [详情](https://example.com) |',
  '| 第二项 |  | 完成 |',
].join('\n')

describe.skipIf(!isCapricornRuntimeAvailable)('Capricorn host content actions', () => {
  it.each([
    {
      name: 'table row',
      row: 1,
      column: 1,
      action: 'Move row down',
      expected: [
        '| 名称 | 备注 | 状态 |',
        '| :--- | :---: | ---: |',
        '| 第二项 |  | 完成 |',
        '| 第一项 | **重点** | [详情](https://example.com) |',
      ].join('\n'),
    },
    {
      name: 'table column',
      row: 0,
      column: 1,
      action: 'Move column left',
      expected: [
        '| 备注 | 名称 | 状态 |',
        '| :---: | :--- | ---: |',
        '| **重点** | 第一项 | [详情](https://example.com) |',
        '|  | 第二项 | 完成 |',
      ].join('\n'),
    },
  ])(
    'moves a $name through its menu and saves it through the host adapter',
    async ({ row, column, action, expected }) => {
      const { container, runtime, onChange, onError } = await mount(tableSource)
      const menu = await tableMenu(container, row, column)
      const button = menu.querySelector<HTMLButtonElement>(`[aria-label="${action}"]`)!
      expect(button).not.toBeNull()
      expect(button.disabled).toBe(false)
      await act(async () => fireEvent.click(button))

      await waitFor(() => expect(runtime.getMarkdown()).toBe(expected))
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ documentChanged: true }))
      expect(container.querySelector('[data-cap-markdown-table-menu]')).toBeNull()
      expect(document.activeElement).toBe(getCapricornRuntimeInput(container))
      await act(async () => runtime.commands.undo())
      expect(runtime.getMarkdown()).toBe(tableSource)
      await act(async () => runtime.commands.redo())
      expect(runtime.getMarkdown()).toBe(expected)
      expect(onError).not.toHaveBeenCalled()
    },
  )

  it('restores automatic image size through the menu, retaining the local source across save, history and reload', async () => {
    const source =
      '<img src="./local-image.png" alt="中文示意图" title="Local image" style="width: 320px; height: 180px">'
    const expected = '<img src="./local-image.png" alt="中文示意图" title="Local image">'
    const dataUrl =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a8L8AAAAASUVORK5CYII='
    const { container, runtime, onChange, onError } = await mount(source, {
      handleViewImgSrcUrl: () => dataUrl,
    })
    const picture = () => container.querySelector<HTMLElement>('.capricorn-markdown-image')!
    const image = () => picture().querySelector('img')!
    const openActions = async () => {
      await act(async () => picture().focus())
      await waitFor(() =>
        expect(document.querySelector('[data-cap-overlay="image-actions"]')).not.toBeNull(),
      )
      return document.querySelector<HTMLButtonElement>(
        '[data-cap-overlay="image-actions"] [aria-label="Restore automatic size"]',
      )!
    }
    expect(image().getAttribute('width')).toBe('320')
    expect(image().getAttribute('height')).toBe('180')
    const reset = await openActions()
    expect(reset).not.toBeNull()
    expect(reset.disabled).toBe(false)
    await act(async () => fireEvent.click(reset))

    await waitFor(() => expect(runtime.getMarkdown()).toBe(expected))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ documentChanged: true }))
    expect(image().hasAttribute('width')).toBe(false)
    expect(image().hasAttribute('height')).toBe(false)
    expect(image().getAttribute('src')).toBe(dataUrl)
    expect(image().getAttribute('alt')).toBe('中文示意图')
    expect(image().getAttribute('title')).toBe('Local image')
    expect(document.activeElement).toBe(getCapricornRuntimeInput(container))
    await act(async () => runtime.commands.undo())
    expect(runtime.getMarkdown()).toBe(source)
    expect(image().getAttribute('width')).toBe('320')
    await act(async () => runtime.commands.redo())
    expect(runtime.getMarkdown()).toBe(expected)

    const disabledReset = await openActions()
    expect(disabledReset.disabled).toBe(true)
    await act(async () => fireEvent.click(disabledReset))
    await act(async () => runtime.commands.undo())
    expect(runtime.getMarkdown()).toBe(source)
    await act(async () => runtime.commands.redo())
    await act(async () => runtime.setMarkdown('Reloading image'))
    await act(async () => runtime.setMarkdown(expected))
    expect(image().hasAttribute('width')).toBe(false)
    expect(image().hasAttribute('height')).toBe(false)
    expect((await openActions()).disabled).toBe(true)
    expect(runtime.getMarkdown()).toBe(expected)
    expect(onError).not.toHaveBeenCalled()
  })
})
