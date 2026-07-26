const DIAGNOSTICS_STORAGE_KEY = 'mf:editor-performance'
const SNAPSHOT_MODE_STORAGE_KEY = 'mf:editor-snapshot-mode'
const MAX_RETAINED_SAMPLES = 2_000

export interface EditorInteractionSample {
  fileId: string
  duration: number
  recordedAt: number
}

export interface EditorSnapshotSample {
  fileId: string
  documentSize: number
  duration: number
  mode: 'coalesced' | 'immediate'
  recordedAt: number
}

export interface EditorLongTaskSample {
  duration: number
  startTime: number
}

export interface EditorPerformanceDiagnostics {
  interactions: EditorInteractionSample[]
  longTasks: EditorLongTaskSample[]
  snapshots: EditorSnapshotSample[]
}

declare global {
  interface Window {
    __MF_EDITOR_PERFORMANCE__?: EditorPerformanceDiagnostics
  }
}

let longTaskObserver: PerformanceObserver | undefined

function diagnosticsEnabled(): boolean {
  return (
    import.meta.env.DEV &&
    typeof window !== 'undefined' &&
    window.localStorage.getItem(DIAGNOSTICS_STORAGE_KEY) === '1'
  )
}

function getDiagnostics(): EditorPerformanceDiagnostics {
  const diagnostics = window.__MF_EDITOR_PERFORMANCE__ ?? {
    interactions: [],
    longTasks: [],
    snapshots: [],
  }
  diagnostics.longTasks ??= []
  window.__MF_EDITOR_PERFORMANCE__ = diagnostics
  if (!longTaskObserver && 'PerformanceObserver' in window) {
    try {
      longTaskObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          appendSample(diagnostics.longTasks, {
            duration: entry.duration,
            startTime: entry.startTime,
          })
        })
      })
      longTaskObserver.observe({ type: 'longtask', buffered: true })
    } catch {
      longTaskObserver = undefined
    }
  }
  return diagnostics
}

function appendSample<T>(samples: T[], sample: T): void {
  samples.push(sample)
  if (samples.length > MAX_RETAINED_SAMPLES) {
    samples.splice(0, samples.length - MAX_RETAINED_SAMPLES)
  }
}

export function shouldCoalesceEditorSnapshots(): boolean {
  if (!import.meta.env.DEV || typeof window === 'undefined') return true
  return window.localStorage.getItem(SNAPSHOT_MODE_STORAGE_KEY) !== 'immediate'
}

export function startEditorInteractionMeasurement(): number | undefined {
  return diagnosticsEnabled() ? window.performance.now() : undefined
}

export function recordEditorInteractionMeasurement(
  fileId: string,
  startedAt: number | undefined,
): void {
  if (startedAt === undefined || !diagnosticsEnabled()) return

  window.requestAnimationFrame(() => {
    if (!diagnosticsEnabled()) return
    appendSample(getDiagnostics().interactions, {
      fileId,
      duration: window.performance.now() - startedAt,
      recordedAt: window.performance.now(),
    })
  })
}

export function measureEditorSnapshot<T>(
  fileId: string,
  documentSize: number,
  mode: EditorSnapshotSample['mode'],
  serialize: () => T,
): T {
  if (!diagnosticsEnabled()) return serialize()

  const startedAt = window.performance.now()
  const result = serialize()
  appendSample(getDiagnostics().snapshots, {
    fileId,
    documentSize,
    duration: window.performance.now() - startedAt,
    mode,
    recordedAt: window.performance.now(),
  })
  return result
}
