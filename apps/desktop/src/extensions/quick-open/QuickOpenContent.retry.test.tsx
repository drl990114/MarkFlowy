import { act, createRef } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { QuickOpenContent } from './QuickOpenContent'
import { loadQuickOpenFiles } from './quickOpenFiles'
import type { QuickOpenFile } from './quickOpenRanking'

const ranker = vi.hoisted(() => ({ rank: vi.fn(), destroy: vi.fn() }))
vi.mock('./quickOpenRanker', () => ({
  QUICK_OPEN_ASYNC_THRESHOLD: 1000,
  createQuickOpenRanker: () => ranker,
}))
vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('@/helper/logger', () => ({ logger: { error: vi.fn() } }))
vi.mock('./quickOpenFiles', async (importOriginal) => {
  const original = await importOriginal<typeof import('./quickOpenFiles')>()
  return {
    ...original,
    getRecentQuickOpenFiles: () => [],
    getOpenedQuickOpenFiles: () => files,
    checkRecentQuickOpenFiles: async () => {},
    loadQuickOpenFiles: vi.fn(),
  }
})
const files: QuickOpenFile[] = Array.from({ length: 1000 }, (_, index) => ({
  id: String(index), name: `note-${index}.md`, relativePath: `note-${index}.md`,
}))
const environment = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
afterEach(() => { delete environment.IS_REACT_ACT_ENVIRONMENT; vi.resetAllMocks() })

it('retries ranking from the error action without a workspace or a new query', async () => {
  environment.IS_REACT_ACT_ENVIRONMENT = true
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const input = createRef<HTMLInputElement>()
  const select = vi.fn()
  try {
    ranker.rank.mockRejectedValueOnce(new Error('temporary ranking failure'))
    await act(async () => root.render(
      <QuickOpenContent fileExcludePatterns='' inputRef={input} onSelect={select} />,
    ))
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input.current, 'note')
      input.current!.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(container.querySelector('[role="alert"]')).not.toBeNull()
    let resolve!: (matches: QuickOpenFile[]) => void
    ranker.rank.mockImplementationOnce(() => new Promise((done) => { resolve = done }))
    await act(async () => container.querySelector<HTMLButtonElement>('[role="alert"] button')!.click())
    expect(ranker.rank).toHaveBeenCalledTimes(2)
    expect(loadQuickOpenFiles).not.toHaveBeenCalled()
    expect(container.querySelector('[role="alert"]')).toBeNull()
    expect(container.querySelector('[role="status"]')).not.toBeNull()
    expect(document.activeElement).toBe(input.current)
    expect(select).not.toHaveBeenCalled()
    await act(async () => resolve([files[7]]))
    expect(container.querySelector('[cmdk-item]')?.textContent).toContain('note-7.md')
    expect(container.querySelector('[role="status"]')).toBeNull()
  } finally {
    await act(async () => root.unmount())
    container.remove()
  }
})
