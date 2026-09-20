import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import HistoryDiff from './HistoryDiff'

vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
afterEach(cleanup)

describe('history comparison', () => {
  it('renders both snapshots in read-only CodeMirror panes', () => {
    const { container, unmount } = render(
      <HistoryDiff before={'# Before\noriginal'} after={'# After\nchanged'} />,
    )
    const panes = container.querySelectorAll('.cm-content')
    expect(panes).toHaveLength(2)
    expect(panes[0].textContent).toContain('original')
    expect(panes[1].textContent).toContain('changed')
    for (const pane of panes) expect(pane.getAttribute('contenteditable')).toBe('false')
    expect(container.querySelectorAll('.cm-changedLine').length).toBeGreaterThan(0)
    unmount()
    expect(container.querySelector('.cm-editor')).toBeNull()
  })
})
