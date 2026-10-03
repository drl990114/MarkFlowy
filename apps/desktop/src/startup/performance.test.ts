import { afterEach, describe, expect, it, vi } from 'vitest'
import { projectStartupStage } from './performance'

const native = vi.hoisted(() => ({ invoke: vi.fn(), isTauri: vi.fn(() => true) }))
vi.mock('@tauri-apps/api/core', () => native)

afterEach(() => {
  vi.restoreAllMocks()
  native.invoke.mockReset()
  vi.resetModules()
  delete window.__MF_STARTUP_PERFORMANCE__
  delete window.__MF_EDITOR_PERFORMANCE__
})

describe('startup timing across native and WebView clocks', () => {
  it('joins startup to the exact editor request and keeps input feedback separate from model commits', async () => {
    const { recordStartupEditor, getStartupPerformanceReport } = await import('./performance')
    window.__MF_EDITOR_PERFORMANCE__ = {
      interactions: [], longTasks: [], snapshots: [],
      opens: ['startup', 'later'].map((openRequestId, index) => ({
        openRequestId, fileId: 'file', viewId: 'left', origin: 'mount', kind: 'open',
        startedAt: 100, status: 'ready', stages: [],
        firstInputDuration: index ? 900 : 12,
        firstInputCommitDuration: index ? 950 : 48,
      })),
    }
    recordStartupEditor({ fileId: 'file', viewId: 'left', mode: 'wysiwyg', openRequestId: 'startup' })
    recordStartupEditor({ fileId: 'other', mode: 'wysiwyg', openRequestId: 'later' })
    expect(getStartupPerformanceReport().editor).toMatchObject({
      detailedDiagnosticsEnabled: true,
      open: { openRequestId: 'startup' },
      firstInputFeedbackMs: 12,
      firstInputCommitMs: 48,
    })
    expect(getStartupPerformanceReport().hostVersion).toBeTruthy()
  })
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

  it('refreshes native stages once after readiness and rejects stale or other-window samples', async () => {
    let resolveFirst!: (value: unknown) => void
    native.invoke.mockReturnValueOnce(new Promise((resolve) => { resolveFirst = resolve }))
    native.invoke.mockResolvedValueOnce({
      nativeElapsedMs: 500, windowLabel: 'main', hostVersion: '0.7.0', buildKind: 'release',
      processSessionId: 'native-process-session',
      stages: [
        { name: 'setup-start', elapsedMs: 40 },
        { name: 'window-built', elapsedMs: 300, windowLabel: 'main' },
        { name: 'window-built', elapsedMs: 100, windowLabel: 'other' },
        { name: 'invalid', elapsedMs: Number.NaN },
        { name: 'future', elapsedMs: 900 },
      ],
    })
    const { initStartupPerformance, markStartupStage, getStartupPerformanceReport } = await import('./performance')
    initStartupPerformance()
    markStartupStage('interactive-editable')
    markStartupStage('interactive-editable')
    expect(native.invoke).toHaveBeenCalledTimes(2)
    await Promise.resolve()
    resolveFirst({ nativeElapsedMs: 200, windowLabel: 'main', stages: [] })
    await Promise.resolve()
    expect(getStartupPerformanceReport().native).toEqual({
      processSessionId: 'native-process-session',
      sampledAtElapsedMs: 500, hostVersion: '0.7.0', buildKind: 'release',
      stages: [
        { name: 'setup-start', elapsedMs: 40 },
        { name: 'window-built', elapsedMs: 300, windowLabel: 'main' },
      ],
    })
    expect(getStartupPerformanceReport().schemaVersion).toBe(1)
  })
})
