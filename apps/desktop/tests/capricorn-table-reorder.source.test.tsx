import { act, fireEvent, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createCapricornRuntime } from 'virtual:markflowy-capricorn-runtime'
import i18n, { i18nInit } from '@/i18n'
import {
  createCapricornRuntimeAdapter,
  type CapricornLocalizationAdapter,
  type CapricornRuntimeAdapter,
  type CapricornRuntimeFactory,
} from '@/components/EditorArea/capricornRuntimeAdapter'
import { getCapricornRuntimeInput } from '@/components/EditorArea/capricornRuntimeDom'

// Promote this source contract to the shared integration suite when MarkFlowy
// pins the Capricorn release with table dragging; the current pin is 0.5.10.
const source = [
  '| Name | Notes | Status | Owner |',
  '| :--- | :---: | ---: | --- |',
  '| First | **Important** | Open | Alice |',
  '| Second |  | Done | Bob |',
  '| Third | [Details](https://example.com) | Open | Carol |',
  '| Fourth | Last | Done | David |',
].join('\n')

const localization: CapricornLocalizationAdapter = {
  getDirection: () => (i18n.dir() === 'rtl' ? 'rtl' : 'ltr'),
  getLocale: () => i18n.resolvedLanguage || i18n.language || 'en',
  subscribe(listener) {
    i18n.on('languageChanged', listener)
    return () => i18n.off('languageChanged', listener)
  },
  translate: ({ defaultValue, key, values }) =>
    i18n.t(`capricorn.${key}`, { defaultValue, ...values }),
}

let adapter: CapricornRuntimeAdapter | undefined

afterEach(async () => {
  await act(async () => adapter?.destroy())
  adapter = undefined
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

async function mount() {
  await i18nInit({ lng: 'cn' })
  const container = document.createElement('div')
  document.body.append(container)
  vi.spyOn(container, 'getBoundingClientRect').mockReturnValue(new DOMRect(40, 40, 800, 600))
  Object.defineProperties(container, {
    clientWidth: { configurable: true, value: 800 },
    clientHeight: { configurable: true, value: 600 },
  })
  const onChange = vi.fn()
  const onError = vi.fn()
  await act(async () => {
    adapter = createCapricornRuntimeAdapter({
      container,
      createRuntime: createCapricornRuntime as CapricornRuntimeFactory,
      onChange,
      options: {
        markdown: source,
        autoFocus: false,
        virtualize: { enable: false },
        localization,
        onError,
      },
    })
  })

  const content = container.querySelector<HTMLElement>('[data-cap-content]')!
  vi.spyOn(content, 'getBoundingClientRect').mockReturnValue(new DOMRect(80, 60, 720, 500))
  const root = container.querySelector<HTMLElement>('[data-cap-editable]')!
  vi.spyOn(root, 'getBoundingClientRect').mockReturnValue(new DOMRect(80, 60, 720, 500))
  const rows = Array.from(root.querySelectorAll<HTMLElement>('[role="row"][data-markdown-table]'))
  const cells = rows.map((row, index) => {
    vi.spyOn(row, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(100, 140 + index * 36, 640, 36),
    )
    return Array.from(
      row.querySelectorAll<HTMLElement>('[role="cell"], [role="columnheader"]'),
    ).map((cell, column) => {
      vi.spyOn(cell, 'getBoundingClientRect').mockReturnValue(
        new DOMRect(100 + column * 160, 140 + index * 36, 160, 36),
      )
      return cell
    })
  })
  expect(cells).toHaveLength(5)
  onChange.mockClear()
  return { container, cells, runtime: adapter!, onChange, onError }
}

async function dragAxis(
  container: HTMLElement,
  cell: HTMLElement,
  target: HTMLElement,
  axis: 'row' | 'column',
) {
  expect(
    container.querySelector('[data-cap-overlay="table-axis"]'),
    'table axis overlay',
  ).not.toBeNull()
  const start = cell.getBoundingClientRect()
  const destination = target.getBoundingClientRect()
  const pointer = { pointerId: 1, pointerType: 'mouse', button: 0, isPrimary: true }
  await act(async () => {
    fireEvent.pointerMove(cell, {
      ...pointer,
      clientX: start.left + 20,
      clientY: start.top + 18,
    })
  })
  const handleSelector = `button[data-cap-table-axis-handle="${axis}"]`
  await waitFor(() => expect(container.querySelector(handleSelector)).not.toBeNull())
  const handle = container.querySelector<HTMLButtonElement>(handleSelector)!
  expect(handle.getAttribute('aria-label')).toBe(axis === 'row' ? '选择整行' : '选择整列')
  const clientX = axis === 'column' ? destination.left + 1 : destination.left + 20
  const clientY = axis === 'row' ? destination.top + 1 : destination.top + 18
  await act(async () => {
    fireEvent.pointerDown(handle, {
      ...pointer,
      buttons: 1,
      clientX: start.left + 20,
      clientY: start.top + 18,
    })
    fireEvent.pointerMove(document, { ...pointer, buttons: 1, clientX, clientY })
  })
  await waitFor(() =>
    expect(container.querySelector('[data-cap-table-drop-indicator]')).not.toBeNull(),
  )
  await act(async () => {
    fireEvent.pointerUp(document, { ...pointer, buttons: 0, clientX, clientY })
  })
}

describe('Capricorn table reordering in MarkFlowy', () => {
  it.each([
    {
      axis: 'row' as const,
      sourceRow: 4,
      sourceColumn: 0,
      targetRow: 1,
      targetColumn: 0,
      expected: [
        '| Name | Notes | Status | Owner |',
        '| :--- | :---: | ---: | --- |',
        '| Fourth | Last | Done | David |',
        '| First | **Important** | Open | Alice |',
        '| Second |  | Done | Bob |',
        '| Third | [Details](https://example.com) | Open | Carol |',
      ].join('\n'),
    },
    {
      axis: 'column' as const,
      sourceRow: 0,
      sourceColumn: 3,
      targetRow: 0,
      targetColumn: 0,
      expected: [
        '| Owner | Name | Notes | Status |',
        '| --- | :--- | :---: | ---: |',
        '| Alice | First | **Important** | Open |',
        '| Bob | Second |  | Done |',
        '| Carol | Third | [Details](https://example.com) | Open |',
        '| David | Fourth | Last | Done |',
      ].join('\n'),
    },
  ])(
    'drags a $axis across multiple positions and saves, undoes and redoes through the host adapter',
    async ({ axis, sourceRow, sourceColumn, targetRow, targetColumn, expected }) => {
      const { container, cells, runtime, onChange, onError } = await mount()
      await dragAxis(
        container,
        cells[sourceRow][sourceColumn],
        cells[targetRow][targetColumn],
        axis,
      )

      await waitFor(() => expect(runtime.getMarkdown()).toBe(expected))
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ documentChanged: true }))
      expect(container.querySelector('[data-cap-table-drop-indicator]')).toBeNull()
      expect(document.activeElement).toBe(getCapricornRuntimeInput(container))
      await act(async () => runtime.commands.undo())
      expect(runtime.getMarkdown()).toBe(source)
      await act(async () => runtime.commands.redo())
      expect(runtime.getMarkdown()).toBe(expected)
      expect(onError).not.toHaveBeenCalled()
    },
  )
})
