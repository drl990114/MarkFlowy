import { StrictMode } from 'react'
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EditorLoadingProgress, EditorOpeningClockContext } from './EditorLoadingProgress'

vi.mock('@/i18n', () => ({ t: () => 'Loading' }))
beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})
const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms)
  })

describe('EditorLoadingProgress', () => {
  it('never flashes for a fast open, including after its former deadline', () => {
    const view = render(<EditorLoadingProgress pending />)
    advance(799)
    expect(view.queryByRole('progressbar')).toBeNull()
    view.rerender(<EditorLoadingProgress pending={false} />)
    advance(1000)
    expect(view.queryByRole('progressbar')).toBeNull()
  })

  it('counts across preparation rerenders, clears immediately, and restarts on retry', () => {
    const view = render(<EditorLoadingProgress pending />)
    advance(500)
    view.rerender(<EditorLoadingProgress pending />)
    advance(300)
    expect(view.queryByRole('progressbar')).not.toBeNull()
    view.rerender(<EditorLoadingProgress pending={false} />)
    expect(view.queryByRole('progressbar')).toBeNull()
    view.rerender(<EditorLoadingProgress pending />)
    expect(view.queryByRole('progressbar')).toBeNull()
    advance(800)
    expect(view.queryByRole('progressbar')).not.toBeNull()
  })

  it('inherits the lazy-loading deadline only for the initial handoff', () => {
    const clock = { startedAt: performance.now() as number | null }
    advance(600)
    const view = render(
      <StrictMode>
        <EditorOpeningClockContext value={clock}>
          <EditorLoadingProgress pending />
        </EditorOpeningClockContext>
      </StrictMode>,
    )
    clock.startedAt = null
    advance(199)
    expect(view.queryByRole('progressbar')).toBeNull()
    advance(1)
    expect(view.queryByRole('progressbar')).not.toBeNull()
    view.unmount()
    const next = render(
      <EditorOpeningClockContext value={clock}>
        <EditorLoadingProgress pending />
      </EditorOpeningClockContext>,
    )
    advance(799)
    expect(next.queryByRole('progressbar')).toBeNull()
    advance(1)
    expect(next.queryByRole('progressbar')).not.toBeNull()
  })

  it('cancels hidden and closed feedback without affecting another pane', () => {
    const first = render(<EditorLoadingProgress pending />)
    const second = render(<EditorLoadingProgress pending />)
    advance(400)
    first.rerender(<EditorLoadingProgress pending visible={false} />)
    advance(400)
    expect(first.container.querySelector('[role="progressbar"]')).toBeNull()
    expect(second.container.querySelector('[role="progressbar"]')).not.toBeNull()
    first.rerender(<EditorLoadingProgress pending />)
    advance(400)
    first.unmount()
    advance(1000)
    expect(second.container.querySelector('[role="progressbar"]')).not.toBeNull()
  })
})
