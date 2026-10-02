import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { EditorView } from '@codemirror/view'
import { afterEach, describe, expect, it, vi } from 'vitest'
import HistoryDiff from './HistoryDiff'

vi.mock('@/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, values?: { current?: number; total?: number }) =>
      values?.total ? `${values.current} / ${values.total}` : key,
  }),
}))
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const context = Array.from({ length: 40 }, (_, i) => `Unchanged line ${i}`).join('\n')
const before = `Old title\n${context}\nOld ending`
const after = `New title\n${context}\nNew ending`

function view(container: HTMLElement, side = 'b') {
  return EditorView.findFromDOM(container.querySelector(`.cm-merge-${side}`) as HTMLElement)!
}

describe('history comparison', () => {
  it('renders labelled snapshots with line numbers in read-only CodeMirror panes', () => {
    const { container, unmount } = render(
      <HistoryDiff
        before={'# Before\noriginal'}
        after={'# After\nchanged'}
        beforeLabel='Saved version'
        afterLabel='Current draft'
      />,
    )
    const panes = container.querySelectorAll('.cm-content')
    expect(panes).toHaveLength(2)
    expect(panes[0].textContent).toContain('original')
    expect(panes[1].textContent).toContain('changed')
    for (const pane of panes) expect(pane.getAttribute('contenteditable')).toBe('false')
    expect(panes[0].getAttribute('aria-label')).toBe('Saved version')
    expect(panes[1].getAttribute('aria-label')).toBe('Current draft')
    expect(container.querySelectorAll('.cm-lineNumbers')).toHaveLength(2)
    expect(view(container).lineWrapping).toBe(false)
    expect(container.querySelectorAll('.cm-changedLine').length).toBeGreaterThan(0)
    unmount()
    expect(container.querySelector('.cm-editor')).toBeNull()
  })

  it('navigates changes in both panes and wraps with buttons and F7', () => {
    const { container } = render(<HistoryDiff before={before} after={after} />)
    expect(screen.getByRole('status').textContent).toContain('1 / 2')
    fireEvent.click(screen.getByRole('button', { name: 'history.next_change (F7)' }))
    expect(screen.getByRole('status').textContent).toContain('2 / 2')
    expect(view(container).state.selection.main.head).toBe(after.lastIndexOf('New ending'))
    expect(view(container, 'a').state.selection.main.head).toBe(before.lastIndexOf('Old ending'))
    fireEvent.keyDown(container.querySelector('.cm-content')!, { key: 'F7' })
    expect(screen.getByRole('status').textContent).toContain('1 / 2')
    fireEvent.keyDown(container.querySelector('.cm-content')!, { key: 'F7', shiftKey: true })
    expect(screen.getByRole('status').textContent).toContain('2 / 2')
  })

  it('switches to unified view without merge controls and preserves the selected change', () => {
    const { container } = render(<HistoryDiff before={before} after={after} />)
    fireEvent.click(screen.getByRole('button', { name: 'history.next_change (F7)' }))
    fireEvent.click(screen.getByRole('button', { name: 'history.unified' }))
    expect(container.querySelectorAll('.cm-editor')).toHaveLength(1)
    expect(container.querySelector('.cm-deletedChunk')).not.toBeNull()
    expect(container.querySelector('.cm-chunkButtons')).toBeNull()
    expect(view(container).lineWrapping).toBe(true)
    expect(view(container).state.doc.toString()).toBe(after)
    expect(view(container).state.selection.main.head).toBe(after.lastIndexOf('New ending'))
    expect(screen.getByRole('status').textContent).toContain('2 / 2')
    fireEvent.click(screen.getByRole('button', { name: 'history.split' }))
    expect(container.querySelectorAll('.cm-editor')).toHaveLength(2)
    expect(view(container, 'a').state.doc.toString()).toBe(before)
    expect(view(container).state.doc.toString()).toBe(after)
  })

  it('expands and collapses unchanged context in either layout without changing snapshots', () => {
    const { container } = render(<HistoryDiff before={before} after={after} />)
    expect(container.querySelector('.cm-collapsedLines')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'history.full_context' }))
    expect(container.querySelector('.cm-collapsedLines')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'history.unified' }))
    expect(container.querySelector('.cm-collapsedLines')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'history.full_context' }))
    expect(container.querySelector('.cm-collapsedLines')).not.toBeNull()
    expect(view(container).state.doc.toString()).toBe(after)
  })

  it('shows a no-differences state and disables navigation for identical snapshots', () => {
    render(<HistoryDiff before='Same content' after='Same content' />)
    expect(screen.getByRole('status').textContent).toBe('history.no_changes')
    expect(
      (screen.getByRole('button', { name: 'history.next_change (F7)' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true)
    expect(
      (
        screen.getByRole('button', {
          name: 'history.previous_change (Shift+F7)',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true)
  })

  it.each([
    ['', 'first\nsecond', '+2', '−0'],
    ['first\nsecond', '', '+0', '−2'],
    ['first\n', 'first\nsecond\n', '+1', '−0'],
    ['first\n', 'first', '+1', '−1'],
  ])(
    'counts added and removed lines with empty and trailing-newline snapshots',
    (a, b, added, removed) => {
      render(<HistoryDiff before={a} after={b} />)
      expect(screen.getByLabelText('history.added_lines').textContent).toBe(added)
      expect(screen.getByLabelText('history.removed_lines').textContent).toBe(removed)
    },
  )

  it('discards old navigation positions when another comparison loads', () => {
    const { container, rerender } = render(<HistoryDiff before={before} after={after} />)
    fireEvent.click(screen.getByRole('button', { name: 'history.next_change (F7)' }))
    rerender(<HistoryDiff before='Earlier' after='Later' />)
    expect(screen.getByRole('status').textContent).toContain('1 / 1')
    expect(container.querySelectorAll('.cm-editor')).toHaveLength(2)
    expect(view(container).state.doc.toString()).toBe('Later')
    expect(view(container).state.selection.main.head).toBe(0)
  })
})

describe('large history comparisons', () => {
  it('ignores a worker response after the comparison changes and terminates the worker', () => {
    const worker = {
      postMessage: vi.fn(),
      terminate: vi.fn(),
      onmessage: undefined as ((event: MessageEvent) => void) | undefined,
    }
    vi.stubGlobal(
      'Worker',
      class {
        constructor() {
          return worker
        }
      },
    )
    const large = 'unchanged\n'.repeat(210000)
    const { container, rerender } = render(<HistoryDiff before={large} after={`${large}Added`} />)
    expect(screen.getByRole('status').textContent).toBe('history.loading')
    expect(worker.postMessage).toHaveBeenCalledOnce()
    rerender(<HistoryDiff before='old' after='new' />)
    act(() => worker.onmessage?.({ data: { changes: [] } } as MessageEvent))
    expect(worker.terminate).toHaveBeenCalled()
    expect(container.querySelectorAll('.cm-editor')).toHaveLength(2)
    expect(view(container).state.doc.toString()).toBe('new')
  })

  it('reuses the worker result when changing layout or context', () => {
    const worker = {
      postMessage: vi.fn(),
      terminate: vi.fn(),
      onmessage: undefined as ((event: MessageEvent) => void) | undefined,
    }
    vi.stubGlobal(
      'Worker',
      class {
        constructor() {
          return worker
        }
      },
    )
    const large = 'unchanged\n'.repeat(210000)
    const { container } = render(<HistoryDiff before={large} after={`${large}Added`} />)
    act(() =>
      worker.onmessage?.({
        data: {
          changes: [
            { fromA: large.length, toA: large.length, fromB: large.length, toB: large.length + 5 },
          ],
        },
      } as MessageEvent),
    )
    fireEvent.click(screen.getByRole('button', { name: 'history.unified' }))
    fireEvent.click(screen.getByRole('button', { name: 'history.full_context' }))
    expect(worker.postMessage).toHaveBeenCalledOnce()
    expect(view(container).state.doc.toString()).toBe(`${large}Added`)
    expect(screen.getByLabelText('history.added_lines').textContent).toBe('+1')
  })
})
