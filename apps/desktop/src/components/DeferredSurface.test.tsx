import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { DeferredSurface } from './DeferredSurface'

const environment = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
let root: Root
let container: HTMLDivElement
beforeAll(() => { environment.IS_REACT_ACT_ENVIRONMENT = true })
afterAll(() => { delete environment.IS_REACT_ACT_ENVIRONMENT })
beforeEach(() => {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

const render = (load: () => Promise<string>) => root.render(
  <DeferredSurface load={load} loadingLabel='Loading' errorTitle='Could not open' retryLabel='Retry'>
    {(text) => <input autoFocus aria-label={text} />}
  </DeferredSurface>,
)

it('keeps the loading surface dismissible and ignores completion after close', async () => {
  let resolve!: (value: string) => void
  const pending = new Promise<string>((done) => { resolve = done })
  await act(async () => render(() => pending))
  expect(container.querySelector('[role="status"]')?.textContent).toBe('Loading')
  await act(async () => root.render(null))
  await act(async () => resolve('late'))
  expect(container.innerHTML).toBe('')
})

it.each(['sync', 'async'])('retries a %s module failure and focuses the loaded input', async (kind) => {
  const load = vi.fn<() => Promise<string>>().mockImplementationOnce(() => {
    if (kind === 'sync') throw new Error('offline')
    return Promise.reject(new Error('offline'))
  }).mockResolvedValue('Search')
  await act(async () => render(load))
  expect(container.querySelector('[role="alert"]')?.textContent).toContain('offline')
  await act(async () => container.querySelector('button')!.click())
  expect(load).toHaveBeenCalledTimes(2)
  expect(document.activeElement).toBe(container.querySelector('input'))
})
