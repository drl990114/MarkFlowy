import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { observeStartupEditable } from './observeEditable'
import type { startupInteractive } from './interactive'

let observe: typeof observeStartupEditable
let gate: typeof startupInteractive
let frames: Map<number, FrameRequestCallback>
let container: HTMLElement
let nextFrame: number
let stop: (() => void) | undefined
const bounds = { width: 600, height: 400, top: 0, left: 0, right: 600, bottom: 400 } as DOMRect
const frame = () => {
  const pending = [...frames.values()]
  frames.clear()
  pending.forEach((callback) => callback(performance.now()))
}

beforeEach(async () => {
  vi.resetModules()
  ;({ observeStartupEditable: observe } = await import('./observeEditable'))
  ;({ startupInteractive: gate } = await import('./interactive'))
  frames = new Map()
  nextFrame = 0
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    frames.set(++nextFrame, callback)
    return nextFrame
  })
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => { frames.delete(id) })
  container = document.createElement('div')
  container.innerHTML = '<div class="cm-content" contenteditable="true">Markdown</div>'
  document.body.append(container)
  vi.spyOn(container.firstElementChild!, 'getBoundingClientRect').mockReturnValue(bounds)
})
afterEach(() => {
  stop?.()
  stop = undefined
  container.remove()
  document.querySelectorAll('textarea[data-cap-input]').forEach((element) => element.remove())
  vi.restoreAllMocks()
})

it('requires a visible editable surface across two frames even when diagnostics are disabled', () => {
  const content = container.firstElementChild! as HTMLElement
  content.style.visibility = 'hidden'
  stop = observe(container, () => true)
  frame()
  frame()
  expect(gate.getOutcome()).toBeUndefined()
  content.style.visibility = 'visible'
  frame()
  expect(gate.getOutcome()).toBeUndefined()
  frame()
  expect(gate.getOutcome()).toBe('editable')
})

it('does not report a document that was switched or unmounted before paint', () => {
  let current = true
  stop = observe(container, () => current)
  frame()
  current = false
  frame()
  expect(gate.getOutcome()).toBeUndefined()
  expect(frames.size).toBe(0)
})

it('releases read-only documents without reporting editability', () => {
  container.firstElementChild!.setAttribute('contenteditable', 'false')
  stop = observe(container, () => true)
  frame()
  frame()
  expect(gate.getOutcome()).toBe('preview')
})

it('waits for the matching Capricorn portal input and visible embedded source editors', () => {
  container.innerHTML = '<div data-cap-content><div data-cap-editable data-cap-key="document"><span data-cap-leaf>Markdown</span></div></div><div data-cap-source-editor-pending="true"></div>'
  vi.spyOn(container.firstElementChild!, 'getBoundingClientRect').mockReturnValue(bounds)
  const pending = container.lastElementChild!
  vi.spyOn(pending, 'getBoundingClientRect').mockReturnValue(bounds)
  const input = document.createElement('textarea')
  input.setAttribute('data-cap-input', '')
  input.setAttribute('data-cap-dockey', 'other')
  document.body.append(input)
  stop = observe(container, () => true)
  frame()
  frame()
  expect(gate.getOutcome()).toBeUndefined()
  input.setAttribute('data-cap-dockey', 'document')
  frame()
  frame()
  expect(gate.getOutcome()).toBeUndefined()
  pending.remove()
  container.querySelector('[data-cap-leaf]')!.textContent = ''
  frame()
  frame()
  expect(gate.getOutcome()).toBeUndefined()
  container.querySelector('[data-cap-leaf]')!.textContent = 'Markdown'
  frame()
  frame()
  expect(gate.getOutcome()).toBe('editable')
})

it('releases background recovery after a visible source module failure without claiming an editable document', () => {
  const failed = document.createElement('div')
  failed.setAttribute('data-cap-source-editor-pending', 'true')
  failed.setAttribute('data-cap-source-editor-error', 'true')
  container.append(failed)
  vi.spyOn(failed, 'getBoundingClientRect').mockReturnValue({ ...bounds, top: 5000, bottom: 5400 })
  const ready = vi.fn()
  stop = observe(container, () => true, ready)
  frame()
  expect(gate.getOutcome()).toBeUndefined()
  vi.spyOn(failed, 'getBoundingClientRect').mockReturnValue(bounds)
  frame()
  expect(gate.getOutcome()).toBe('error')
  expect(ready).not.toHaveBeenCalled()
})
