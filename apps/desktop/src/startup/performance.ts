import { invoke, isTauri } from '@tauri-apps/api/core'
import { capricornRuntimeEntrySha256, capricornRuntimeVersion } from '@/constants/capricornRuntime'

export interface NativeStartupCalibration {
  nativeElapsedMs: number
  windowLabel: string
  requestStartedAt: number
  responseReceivedAt: number
}

interface NativeStartupSnapshot {
  nativeElapsedMs: number
  windowLabel: string
  processSessionId?: string
  hostVersion?: string
  buildKind?: 'debug' | 'release'
  stages?: { name: string; elapsedMs: number; windowLabel?: string }[]
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
let nativeSnapshot: NativeStartupSnapshot | undefined
let nativeEnabled = false
let finalNativeSampleRequested = false
let initialized = false
let editorContext: { fileId: string; viewId?: string; mode: string; openRequestId?: string } | undefined

export function recordStartupEditor(context: NonNullable<typeof editorContext>) {
  editorContext ??= context
}

export function markStartupStage(name: string) {
  try {
    performance.mark(`mf:startup:${name}`)
  } catch {
    // Diagnostics cannot be a dependency of startup, opening or saving.
  }
  if (nativeEnabled && name.startsWith('interactive-') && !finalNativeSampleRequested) {
    finalNativeSampleRequested = true
    sampleNativeStartup()
  }
}

export function getStartupPerformanceReport() {
  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
  const editor = window.__MF_EDITOR_PERFORMANCE__
  const open = editorContext?.openRequestId
    ? editor?.opens?.find((sample) => sample.openRequestId === editorContext?.openRequestId)
    : undefined
  return {
    schemaVersion: 1,
    hostVersion: typeof __MARKFLOWY_HOST_VERSION__ === 'string' ? __MARKFLOWY_HOST_VERSION__ : undefined,
    buildKind: import.meta.env.DEV ? 'development' : 'production',
    runtime: { version: capricornRuntimeVersion, entrySha256: capricornRuntimeEntrySha256 },
    timeOrigin: performance.timeOrigin,
    navigationType: navigation?.type ?? 'unknown',
    windowLabel: calibration?.windowLabel,
    native: nativeSnapshot ? {
      processSessionId: nativeSnapshot.processSessionId,
      hostVersion: nativeSnapshot.hostVersion,
      buildKind: nativeSnapshot.buildKind,
      sampledAtElapsedMs: nativeSnapshot.nativeElapsedMs,
      stages: nativeSnapshot.stages,
    } : undefined,
    nativeClockAvailable: Boolean(calibration),
    calibrationRoundTripMs: calibration
      ? calibration.responseReceivedAt - calibration.requestStartedAt
      : undefined,
    editor: {
      context: editorContext,
      detailedDiagnosticsEnabled: Boolean(editor),
      open,
      firstInputFeedbackMs: open?.firstInputDuration,
      firstInputCommitMs: open?.firstInputCommitDuration,
    },
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
  nativeEnabled = true
  sampleNativeStartup()
}

function sampleNativeStartup() {
  const requestStartedAt = performance.now()
  void invoke<NativeStartupSnapshot>('get_startup_timing')
    .then((result) => {
      if (!Number.isFinite(result.nativeElapsedMs) || result.nativeElapsedMs < 0) return
      const responseReceivedAt = performance.now()
      if (!calibration || responseReceivedAt - requestStartedAt <
        calibration.responseReceivedAt - calibration.requestStartedAt) {
        calibration = {
          nativeElapsedMs: result.nativeElapsedMs,
          windowLabel: result.windowLabel,
          requestStartedAt,
          responseReceivedAt,
        }
      }
      // The first IPC response can arrive after the final sample. Never replace
      // newer native stages with an older snapshot, even with a better clock fit.
      if (!nativeSnapshot || result.nativeElapsedMs >= nativeSnapshot.nativeElapsedMs) {
        nativeSnapshot = {
          ...result,
          stages: result.stages?.filter((stage) =>
            Number.isFinite(stage.elapsedMs) && stage.elapsedMs >= 0 &&
            stage.elapsedMs <= result.nativeElapsedMs &&
            (!stage.windowLabel || stage.windowLabel === result.windowLabel)),
        }
      }
    })
    .catch(() => {
      // Source previews may run against an older native binary.
    })
}
