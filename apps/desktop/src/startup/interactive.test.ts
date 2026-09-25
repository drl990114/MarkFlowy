import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { afterStartupInteractive, createInteractiveGate } from './interactive'

beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) =>
    window.setTimeout(() => callback(performance.now()), 16),
  )
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(window.clearTimeout.bind(window))
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

it('does not release work until editor readiness, then leaves a paint before running once', async () => {
  const gate = createInteractiveGate()
  const task = vi.fn()
  afterStartupInteractive(task, { gate })
  await vi.advanceTimersByTimeAsync(10_000)
  expect(task).not.toHaveBeenCalled()
  gate.settle('editable')
  expect(task).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(48)
  expect(task).toHaveBeenCalledOnce()
  gate.settle('empty')
  await vi.runAllTimersAsync()
  expect(task).toHaveBeenCalledOnce()
  expect(gate.getOutcome()).toBe('editable')
})

it.each(['empty', 'error', 'preview'] as const)('releases work in a %s window without claiming editability', async (outcome) => {
  const gate = createInteractiveGate()
  gate.settle(outcome)
  const task = vi.fn()
  afterStartupInteractive(task, { gate })
  await vi.runAllTimersAsync()
  expect(task).toHaveBeenCalledOnce()
  expect(gate.getOutcome()).toBe(outcome)
})

it.each(['before', 'after'] as const)('cancels work %s the editor becomes ready', async (when) => {
  const gate = createInteractiveGate()
  const controller = new AbortController()
  const task = vi.fn()
  afterStartupInteractive(task, { gate, signal: controller.signal })
  if (when === 'before') controller.abort()
  gate.settle('editable')
  if (when === 'after') controller.abort()
  await vi.runAllTimersAsync()
  expect(task).not.toHaveBeenCalled()
})
