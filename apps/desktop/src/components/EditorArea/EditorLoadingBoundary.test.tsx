import { act, cleanup, render } from '@testing-library/react'
import { lazy, StrictMode, Suspense } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { EditorLoadingBoundary, EditorLoadingSuspense, useEditorLoading } from './EditorLoadingBoundary'

vi.mock('@/i18n', () => ({ t: () => 'Loading' }))

beforeEach(() => vi.useFakeTimers())
afterEach(() => { cleanup(); vi.useRealTimers() })

function Phase({ pending }: { pending: boolean }) {
  useEditorLoading(pending)
  return <div data-testid='content' />
}

const advance = (milliseconds: number) => act(() => { vi.advanceTimersByTime(milliseconds) })
const settle = () => act(async () => { await Promise.resolve() })

it('keeps simultaneous operations owned independently and suppresses fast feedback', async () => {
  const content = (first: boolean, second: boolean) => (
    <StrictMode>
      <EditorLoadingBoundary><Phase pending={first} /><Phase pending={second} /></EditorLoadingBoundary>
    </StrictMode>
  )
  const view = render(content(true, true))
  const owner = view.container.querySelector('[data-slot="editor-loading-boundary"]')!
  expect(owner.getAttribute('aria-busy')).toBe('true')
  advance(400)
  view.rerender(content(false, true))
  await settle()
  expect(owner.getAttribute('aria-busy')).toBe('true')
  expect(view.queryByRole('progressbar')).toBeNull()
  view.rerender(content(false, false))
  await settle()
  expect(owner.getAttribute('aria-busy')).toBe('false')
  advance(1000)
  expect(view.queryByRole('progressbar')).toBeNull()
})

it('contains suspension in its pane and shares the deadline with subsequent preparation', async () => {
  let resolve!: (module: { default: typeof Phase }) => void
  const LazyPhase = lazy(() => new Promise<{ default: typeof Phase }>((done) => { resolve = done }))
  const content = (pending: boolean) => (
    <Suspense fallback={<div data-testid='whole-workspace-loading' />}>
      <header data-testid='toolbar' />
      <EditorLoadingBoundary><LazyPhase pending={pending} /></EditorLoadingBoundary>
      <aside data-testid='other-pane' />
    </Suspense>
  )
  const view = render(content(true))
  const toolbar = view.getByTestId('toolbar')
  const otherPane = view.getByTestId('other-pane')
  expect(view.queryByTestId('whole-workspace-loading')).toBeNull()
  advance(500)
  await act(async () => { resolve({ default: Phase }) })
  expect(view.getByTestId('toolbar')).toBe(toolbar)
  expect(view.getByTestId('other-pane')).toBe(otherPane)
  expect(view.queryByRole('progressbar')).toBeNull()
  advance(299)
  expect(view.queryByRole('progressbar')).toBeNull()
  advance(1)
  expect(view.getAllByRole('progressbar')).toHaveLength(1)
  view.rerender(content(false))
  await settle()
  expect(view.queryByRole('progressbar')).toBeNull()
})

it('preserves the opening deadline when the parent hands loading to a child', async () => {
  const view = render(<EditorLoadingBoundary pending><Phase pending={false} /></EditorLoadingBoundary>)
  advance(600)
  view.rerender(<EditorLoadingBoundary><Phase pending /></EditorLoadingBoundary>)
  await settle()
  advance(200)
  expect(view.getAllByRole('progressbar')).toHaveLength(1)
})

it('keeps hidden panes quiet and provides delayed feedback for standalone previews', async () => {
  const content = (visible: boolean) => (
    <>
      <EditorLoadingBoundary visible={visible} data-testid='hidden-pane'><Phase pending /></EditorLoadingBoundary>
      <EditorLoadingSuspense><Phase pending /></EditorLoadingSuspense>
    </>
  )
  const view = render(content(false))
  advance(800)
  expect(view.getByTestId('hidden-pane').getAttribute('aria-busy')).toBe('false')
  expect(view.getByTestId('hidden-pane').querySelector('[role="progressbar"]')).toBeNull()
  expect(view.getAllByRole('progressbar')).toHaveLength(1)
  view.rerender(content(true))
  advance(799)
  expect(view.getAllByRole('progressbar')).toHaveLength(1)
  advance(1)
  expect(view.getAllByRole('progressbar')).toHaveLength(2)
  view.unmount()
  await settle()
})
