import { afterEach, describe, expect, it, vi } from 'vitest'
import { projectStartupStage } from './performance'

const native = vi.hoisted(() => ({ invoke: vi.fn(), isTauri: vi.fn(() => true) }))
vi.mock('@tauri-apps/api/core', () => native)

afterEach(() => {
  vi.restoreAllMocks()
  vi.resetModules()
  delete window.__MF_STARTUP_PERFORMANCE__
})

describe('startup timing across native and WebView clocks', () => {
  it('keeps IPC uncertainty and navigation duration separate', () => {
    expect(projectStartupStage('shell-ready', 150, {
      nativeElapsedMs: 400,
      windowLabel: 'main',
      requestStartedAt: 90,
      responseReceivedAt: 110,
    })).toEqual({
      name: 'shell-ready',
      navigationElapsedMs: 150,
      nativeElapsedMs: { min: 440, max: 460 },
    })
    expect(projectStartupStage('shell-ready', 150)).toEqual({
      name: 'shell-ready', navigationElapsedMs: 150,
    })
  })

  it('calibrates without blocking rendering and includes earlier module loading', async () => {
    let resolve!: (value: { nativeElapsedMs: number; windowLabel: string }) => void
    native.invoke.mockReturnValueOnce(new Promise((done) => { resolve = done }))
    const marks: { name: string; startTime: number }[] = []
    vi.spyOn(performance, 'mark').mockImplementation((name, options) => {
      const mark = { name, startTime: options?.startTime ?? 50 }
      marks.push(mark)
      return mark as PerformanceMark
    })
    vi.spyOn(performance, 'getEntriesByType').mockImplementation((kind) =>
      (kind === 'mark' ? marks : [{ type: 'reload' }]) as PerformanceEntryList)
    const { initStartupPerformance, getStartupPerformanceReport } = await import('./performance')
    initStartupPerformance()
    initStartupPerformance()
    expect(native.invoke).toHaveBeenCalledOnce()
    expect(getStartupPerformanceReport()).toMatchObject({ nativeClockAvailable: false, navigationType: 'reload' })
    expect(marks[0]).toEqual({ name: 'mf:startup:webview-start', startTime: 0 })
    resolve({ nativeElapsedMs: 100, windowLabel: 'main' })
    await Promise.resolve()
    expect(getStartupPerformanceReport()).toMatchObject({ nativeClockAvailable: true, windowLabel: 'main' })
  })

  it('keeps timing usable when the native command is unavailable', async () => {
    native.invoke.mockRejectedValueOnce(new Error('Unknown command'))
    const { initStartupPerformance, getStartupPerformanceReport } = await import('./performance')
    initStartupPerformance()
    await Promise.resolve()
    await Promise.resolve()
    expect(getStartupPerformanceReport().nativeClockAvailable).toBe(false)
  })
})
