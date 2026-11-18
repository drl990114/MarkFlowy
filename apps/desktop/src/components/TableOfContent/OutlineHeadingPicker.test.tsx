import type { IHeadingData } from '@markflowy/interface'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createStore } from 'zustand/vanilla'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { OutlineHeadingPicker } from './OutlineHeadingPicker'

vi.mock('@/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => ({
    'sidebar.outline_find_heading': 'Find heading',
    'search.search_empty': 'No matches',
    'document_preview.next_page': 'Next page',
    'document_preview.previous_page': 'Previous page',
    'file.untitled': 'Untitled',
  })[key] ?? key }),
}))

const heading = (id: string, value: string, depth = 1): IHeadingData => ({
  id, value, depth, htmlNode: null, onClick: vi.fn(),
})
const trigger = () => screen.getByRole('button', { name: 'Find heading' })
const open = () => {
  fireEvent.click(trigger())
  return screen.getByRole('combobox')
}
function mount(entries: IHeadingData[]) {
  const owner = {}
  const headings = createStore<IHeadingData[]>(() => entries)
  const view = render(<OutlineHeadingPicker headings={headings} owner={owner} />)
  return { headings, owner, view }
}

afterEach(cleanup)

describe('outline heading picker', () => {
  it('finds duplicate titles by keyboard and leaves focus with the source editor after choosing', async () => {
    const first = heading('first', 'Summary', 2)
    const second = heading('second', 'Summary', 2)
    const editor = document.createElement('textarea')
    document.body.append(editor)
    second.onClick = vi.fn(() => editor.focus())
    try {
      mount([heading('a', 'Chapter A'), first, heading('b', 'Chapter B'), second])
      const input = open()
      await waitFor(() => expect(document.activeElement).toBe(input))
      fireEvent.change(input, { target: { value: 'sUmmARY' } })
      expect(screen.getAllByRole('option').map((option) => option.getAttribute('data-value')))
        .toEqual(['first', 'second'])
      expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
        'H2SummaryChapter A', 'H2SummaryChapter B',
      ])
      fireEvent.keyDown(input, { key: 'ArrowDown' })
      fireEvent.keyDown(input, { key: 'Enter', isComposing: true })
      fireEvent.keyDown(input, { key: 'Enter', keyCode: 229 })
      fireEvent.keyDown(input, { key: 'Enter', repeat: true })
      expect(second.onClick).not.toHaveBeenCalled()
      expect(screen.getByRole('combobox')).toBe(input)
      fireEvent.keyDown(input, { key: 'Enter' })
      expect(second.onClick).toHaveBeenCalledExactlyOnceWith(second)
      expect(first.onClick).not.toHaveBeenCalled()
      await waitFor(() => expect(screen.queryByRole('combobox')).toBeNull())
      await new Promise((resolve) => setTimeout(resolve, 0))
      expect(document.activeElement).toBe(editor)
    } finally {
      editor.remove()
    }
  })

  it('narrows by ancestor and Unicode title without matching an entire subtree for a parent alone', () => {
    const first = heading('1', '概要', 3)
    const second = heading('2', '概要', 4)
    mount([heading('a', 'A 部'), first, heading('b', 'B 部'), second])
    const input = open()
    fireEvent.change(input, { target: { value: 'Ｂ' } })
    expect(screen.getAllByRole('option')).toHaveLength(1)
    fireEvent.change(input, { target: { value: 'Ｂ 概要' } })
    fireEvent.click(screen.getByRole('option', { name: /概要.*B 部/ }))
    expect(second.onClick).toHaveBeenCalledExactlyOnceWith(second)
    expect(first.onClick).not.toHaveBeenCalled()
  })

  it('clears empty results, respects composing Escape, and restores the trigger on a real cancellation', async () => {
    const row = heading('one', 'Intro')
    mount([row])
    const input = open()
    fireEvent.change(input, { target: { value: 'not present' } })
    expect(screen.getByText('No matches')).toBeTruthy()
    expect(screen.queryByRole('option')).toBeNull()
    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.keyDown(input, { key: 'Escape', isComposing: true })
    expect(screen.getByRole('combobox')).toBe(input)
    fireEvent.keyDown(input, { key: 'Escape' })
    await waitFor(() => expect(document.activeElement).toBe(trigger()))
    expect((open() as HTMLInputElement).value).toBe('')
    expect(screen.getAllByRole('option')).toHaveLength(1)
    expect(row.onClick).not.toHaveBeenCalled()
  })

  it('rejects an option from a replaced publication and does not reopen a stale owner', async () => {
    const old = heading('same', 'Old title')
    const fresh = heading('same', 'New title')
    const { headings, owner, view } = mount([old])
    open()
    const oldRow = screen.getByRole('option')
    act(() => {
      headings.setState([fresh], true)
      fireEvent.click(oldRow)
    })
    expect(old.onClick).not.toHaveBeenCalled()
    expect(fresh.onClick).not.toHaveBeenCalled()
    expect(screen.getByRole('option').textContent).toContain('New title')
    view.rerender(<OutlineHeadingPicker headings={headings} owner={{}} />)
    await waitFor(() => expect(screen.queryByRole('combobox')).toBeNull())
    view.rerender(<OutlineHeadingPicker headings={headings} owner={owner} />)
    expect(screen.queryByRole('combobox')).toBeNull()
  })

  it('bounds a 20,000-heading result list, pages duplicates and finds the final title directly', () => {
    const rows = Array.from({ length: 20_000 }, (_, i) => heading(String(i), i === 19_999 ? '尾声' : 'Chapter'))
    mount(rows)
    const input = open()
    expect(screen.getAllByRole('option')).toHaveLength(40)
    expect(screen.getByText('1–40 / 20000')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
    expect(screen.getByText('41–80 / 20000')).toBeTruthy()
    expect(screen.getAllByRole('option')[0].getAttribute('data-value')).toBe('40')
    fireEvent.click(screen.getByRole('button', { name: 'Previous page' }))
    expect(screen.getByText('1–40 / 20000')).toBeTruthy()
    fireEvent.change(input, { target: { value: '尾声' } })
    fireEvent.click(screen.getByRole('option', { name: '尾声' }))
    expect(rows.at(-1)?.onClick).toHaveBeenCalledOnce()
    expect(screen.queryByRole('option')).toBeNull()
  })
})
