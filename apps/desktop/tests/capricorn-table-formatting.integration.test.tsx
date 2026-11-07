// @vitest-environment jsdom
import { act, fireEvent, waitFor, within } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createCapricornRuntime } from 'virtual:markflowy-capricorn-runtime'
import { resolveThemeTokens } from '@markflowy/theme/semantic'
import { capricornStyle } from '@/themes/runtime'
import type {
  CapricornRuntimeFactory,
  CapricornRuntimeSession,
} from '@/components/EditorArea/capricornRuntimeAdapter'

const markdown = [
  '| 名称 | 说明 | 数量 |',
  '| --- | --- | --- |',
  '| Alpha | **重点** | 123 |',
  '| 中文 | 普通文本 | 4567 |',
].join('\n')
const alignedDivider = '| :--- | :---: | ---: |'
const rangeGeometry = ['getClientRects', 'getBoundingClientRect'].map(
  (name) => [name, Object.getOwnPropertyDescriptor(Range.prototype, name)] as const,
)
let session: CapricornRuntimeSession | undefined

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
  const previous = session
  session = undefined
  await act(async () => previous?.destroy())
  document.body.replaceChildren()
})

async function mount(
  source = markdown,
  mode: 'edit' | 'preview' = 'edit',
  colorScheme: 'light' | 'dark' = 'light',
) {
  const container = document.createElement('div')
  container.className = 'mf-editor-content'
  container.getBoundingClientRect = () => new DOMRect(0, 0, 1000, 800)
  document.body.append(container)
  const tokens = resolveThemeTokens(colorScheme)
  await act(async () => {
    session = (createCapricornRuntime as CapricornRuntimeFactory)(container, {
      markdown: source,
      mode,
      colorScheme,
      autoFocus: false,
      getScrollableContainer: () => container,
      virtualize: { enable: false },
      style: capricornStyle(tokens, 'document'),
    })
  })
  return { container, tokens }
}

function tableRows(container: HTMLElement) {
  return [...container.querySelectorAll<HTMLElement>('[role="row"][data-markdown-table]')]
}
function rowCells(row: HTMLElement) {
  return [...row.querySelectorAll<HTMLElement>('[role="cell"], [role="columnheader"]')]
}
function expectAlignments(container: HTMLElement, alignments: string[]) {
  const rows = tableRows(container)
  expect(rows).toHaveLength(3)
  for (const row of rows) {
    const cells = rowCells(row)
    expect(cells.map((cell) => cell.style.textAlign)).toEqual(alignments)
    expect(cells.map((cell) => cell.getAttribute('data-align') ?? '')).toEqual(alignments)
  }
}

async function openColumnMenu(container: HTMLElement, column: number) {
  const root = container.querySelector<HTMLElement>('[data-cap-editable]')!
  // jsdom has no layout. Only geometry is stubbed; event routing, menu actions
  // and document changes all come from the installed runtime.
  root.getBoundingClientRect = () => new DOMRect(80, 60, 640, 500)
  const rows = tableRows(container)
  rows.forEach((row, rowIndex) => {
    row.getBoundingClientRect = () => new DOMRect(100, 140 + rowIndex * 36, 540, 36)
    rowCells(row).forEach((cell, columnIndex) => {
      cell.getBoundingClientRect = () =>
        new DOMRect(100 + columnIndex * 180, 140 + rowIndex * 36, 180, 36)
    })
  })
  const cell = rowCells(rows[1])[column]
  const bounds = cell.getBoundingClientRect()
  const event = new MouseEvent('contextmenu', {
    bubbles: true,
    cancelable: true,
    composed: true,
    clientX: bounds.x + 10,
    clientY: bounds.y + 10,
  })
  await act(async () => { cell.dispatchEvent(event) })
  expect(event.defaultPrevented).toBe(true)
  await waitFor(() => expect(container.querySelector('[data-cap-markdown-table-menu]')).toBeTruthy())
  return container.querySelector<HTMLElement>('[data-cap-markdown-table-menu]')!
}

function runtimeStyleRules(): CSSStyleRule[] {
  const sheet = document.querySelector<HTMLStyleElement>('style[data-cap-runtime-styles]')?.sheet
  expect(sheet).toBeTruthy()
  const visit = (rules: CSSRuleList): CSSStyleRule[] => Array.from(rules).flatMap((rule) => {
    if (rule.type === CSSRule.STYLE_RULE) return [rule as CSSStyleRule]
    return 'cssRules' in rule ? visit((rule as CSSGroupingRule).cssRules) : []
  })
  return visit(sheet!.cssRules)
}

describe('table formatting through the installed Capricorn runtime', () => {
  it('changes complete columns through the menu and preserves them when Markdown is reopened', async () => {
    const { container } = await mount()
    const alignments = ['', '', '']
    const choices = [
      ['left', 'Left-align column'],
      ['center', 'Center-align column'],
      ['right', 'Right-align column'],
    ] as const
    expectAlignments(container, alignments)
    for (const [column, [alignment, label]] of choices.entries()) {
      const menu = await openColumnMenu(container, column)
      expect(within(menu).getAllByRole('menuitemradio')).toHaveLength(4)
      await act(async () => { fireEvent.click(within(menu).getByRole('menuitemradio', { name: label })) })
      alignments[column] = alignment
      await waitFor(() => expectAlignments(container, alignments))
      const reopenedMenu = await openColumnMenu(container, column)
      expect(within(reopenedMenu).getByRole('menuitemradio', { name: label }).getAttribute('aria-checked')).toBe('true')
      await act(async () => { fireEvent.keyDown(reopenedMenu, { key: 'Escape' }) })
    }
    const saved = session!.getMarkdown()
    expect(saved).toBe(markdown.replace('| --- | --- | --- |', alignedDivider))
    await act(async () => session!.destroy())
    session = undefined
    container.remove()

    const reopened = await mount(saved)
    expectAlignments(reopened.container, ['left', 'center', 'right'])
    expect(session!.getMarkdown()).toBe(saved)
    await act(async () => session!.setMode('preview'))
    expectAlignments(reopened.container, ['left', 'center', 'right'])
    expect(reopened.container.querySelector('[data-cap-markdown-table-menu]')).toBeNull()
    expect(session!.getMarkdown()).toBe(saved)
  })

  it.each([
    ['edit', 'light'], ['edit', 'dark'], ['preview', 'light'], ['preview', 'dark'],
  ] as const)('uses semantic headers and the shipped header CSS in %s / %s', async (mode, colorScheme) => {
    const { container, tokens } = await mount(markdown, mode, colorScheme)
    const rows = tableRows(container)
    expect(rows[0].getAttribute('data-markdown-table-header')).toBe('true')
    expect(rowCells(rows[0]).map((cell) => cell.getAttribute('role'))).toEqual([
      'columnheader', 'columnheader', 'columnheader',
    ])
    for (const row of rows.slice(1))
      expect(rowCells(row).map((cell) => cell.getAttribute('role'))).toEqual(['cell', 'cell', 'cell'])
    const headerRule = runtimeStyleRules().find((rule) =>
      rows[0].matches(rule.selectorText) &&
      rule.style.getPropertyValue('background').includes('--cap-surface-subtle') &&
      Number(rule.style.getPropertyValue('font-weight')) >= 600,
    )
    expect(headerRule, 'the installed CSS must style the rendered header, not just accept a host token').toBeTruthy()
    expect(rows.slice(1).some((row) => row.matches(headerRule!.selectorText))).toBe(false)
    expect(container.querySelector<HTMLElement>('[data-cap-content]')!.style.getPropertyValue('--cap-surface-subtle')).toBe(
      `var(--mf-theme-surface-subtle, ${tokens['surface.subtle']})`,
    )
    expect(session!.getMarkdown()).toBe(markdown)
  })
})
