import { invoke, isTauri } from '@tauri-apps/api/core'

export interface NativeStartupCalibration {
  nativeElapsedMs: number
  windowLabel: string
  requestStartedAt: number
  responseReceivedAt: number
}

export interface StartupStageTiming {
  name: string
  navigationElapsedMs: number
  /** Bounds account for IPC transit; native entry excludes OS process creation. */
  nativeElapsedMs?: { min: number; max: number }
}

export function projectStartupStage(
  name: string,
  startTime: number,
  calibration?: NativeStartupCalibration,
): StartupStageTiming {
  return {
    name,
    navigationElapsedMs: startTime,
    ...(calibration ? {
      nativeElapsedMs: {
        min: Math.max(0, calibration.nativeElapsedMs + startTime - calibration.responseReceivedAt),
        max: Math.max(0, calibration.nativeElapsedMs + startTime - calibration.requestStartedAt),
      },
    } : {}),
  }
}

let calibration: NativeStartupCalibration | undefined
let initialized = false

export function markStartupStage(name: string) {
  try {
    performance.mark(`mf:startup:${name}`)
  } catch {
    // Diagnostics cannot be a dependency of startup, opening or saving.
  }
}

export function getStartupPerformanceReport() {
  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
  return {
    timeOrigin: performance.timeOrigin,
    navigationType: navigation?.type ?? 'unknown',
    windowLabel: calibration?.windowLabel,
    nativeClockAvailable: Boolean(calibration),
    calibrationRoundTripMs: calibration
      ? calibration.responseReceivedAt - calibration.requestStartedAt
      : undefined,
    stages: performance.getEntriesByType('mark')
      .filter(({ name }) => name.startsWith('mf:startup:') || name === 'mf:boot-shell-first-frame')
      .map(({ name, startTime }) => projectStartupStage(name, startTime, calibration)),
  }
}

declare global {
  interface Window {
    __MF_STARTUP_PERFORMANCE__?: { getReport: typeof getStartupPerformanceReport }
  }
}

export function initStartupPerformance() {
  if (initialized) return
  initialized = true
  window.__MF_STARTUP_PERFORMANCE__ = { getReport: getStartupPerformanceReport }
  try {
    // Includes HTML, module download and evaluation before React setup starts.
    performance.mark('mf:startup:webview-start', { startTime: 0 })
    markStartupStage('entry-modules-ready')
  } catch { /* Optional User Timing support. */ }
  if (!isTauri()) return
  const requestStartedAt = performance.now()
  void invoke<{ nativeElapsedMs: number; windowLabel: string }>('get_startup_timing')
    .then((result) => {
      if (!Number.isFinite(result.nativeElapsedMs) || result.nativeElapsedMs < 0) return
      calibration = { ...result, requestStartedAt, responseReceivedAt: performance.now() }
    })
    .catch(() => {
      // Source previews may run against an older native binary.
    })
}
