import { getCapricornRuntimeInput, subscribeCapricornBeforeInput } from './capricornRuntimeDom'

const DIAGNOSTICS_STORAGE_KEY = 'mf:editor-performance'
const SNAPSHOT_MODE_STORAGE_KEY = 'mf:editor-snapshot-mode'
const MAX_RETAINED_SAMPLES = 2_000

export interface EditorInteractionSample {
  fileId: string
  viewId?: string
  openRequestId?: string
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
  fileId?: string
  viewId?: string
  openRequestId?: string
  duration: number
  startTime: number
}

export interface EditorPerformanceDiagnostics {
  interactions: EditorInteractionSample[]
  /** Model publication lag is intentionally separate from visible feedback. */
  interactionCommits?: EditorInteractionSample[]
  longTasks: EditorLongTaskSample[]
  snapshots: EditorSnapshotSample[]
  opens?: EditorOpenSample[]
  responsiveness?: EditorResponsivenessSample[]
}

export interface EditorOpenSample {
  openRequestId: string
  fileId: string
  viewId: string
  origin: 'command' | 'mount'
  kind: 'open' | 'switch'
  mode?: string
  /** Host-owned content generation used to reject stale prepared documents. */
  contentRevision?: number
  byteLength?: number
  blockCount?: number
  runtimeVersion?: string
  runtimeEntrySha256?: string
  moduleState?: 'cold' | 'warm'
  startedAt: number
  duration?: number
  firstInputDuration?: number
  firstInputCommitDuration?: number
  status: 'opening' | 'ready' | 'canceled' | 'error' | 'unverified'
  stages: {
    stage: string
    elapsedMs: number
    latestElapsedMs?: number
    runtimeElapsedMs?: number
    durationMs?: number
  }[]
}

export interface EditorResponsivenessSample {
  fileId?: string
  viewId?: string
  openRequestId?: string
  /** These are proxies, not native Long Tasks observations. */
  source: 'event-loop-delay' | 'frame-gap'
  duration: number
  recordedAt: number
}

const diagnosticSessionId =
  typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
let openSequence = 0
const currentOpens = new Map<string, EditorOpenSample>()
const pendingOpenContent = new Map<string, { content: string; isBlank: boolean }>()
let responsivenessTimer: number | undefined
let responsivenessFrame: number | undefined

declare global {
  interface Window {
    __MF_EDITOR_PERFORMANCE__?: EditorPerformanceDiagnostics
  }
}

let longTaskObserver: PerformanceObserver | undefined

function openingIdentity(sample: EditorOpenSample) {
  return {
    fileId: sample.fileId,
    viewId: sample.viewId,
    openRequestId: sample.openRequestId,
  }
}

function activeOpeningSamples(): EditorOpenSample[] {
  return [...currentOpens.values()].filter((sample) => sample.status === 'opening')
}

function openingSamplesIntersecting(startTime: number, duration: number): EditorOpenSample[] {
  const endTime = startTime + duration
  return (window.__MF_EDITOR_PERFORMANCE__?.opens ?? []).filter((sample) => {
    const sampleEnd =
      sample.status === 'opening' || sample.duration === undefined
        ? Number.POSITIVE_INFINITY
        : sample.startedAt + sample.duration
    return sample.startedAt <= endTime && sampleEnd >= startTime
  })
}

function appendResponsivenessForActiveOpenings(
  sample: Omit<EditorResponsivenessSample, 'fileId' | 'openRequestId' | 'viewId'>,
): void {
  for (const opening of activeOpeningSamples()) {
    appendSample(getDiagnostics().responsiveness!, {
      ...openingIdentity(opening),
      ...sample,
    })
  }
}

function diagnosticsEnabled(): boolean {
  // Explicit, local-only opt-in also permits measurements of release WebViews.
  // Never send document content or paths to telemetry. Restricted storage must
  // not make an otherwise usable editor fail to open.
  try {
    return (
      typeof window !== 'undefined' && window.localStorage.getItem(DIAGNOSTICS_STORAGE_KEY) === '1'
    )
  } catch {
    return false
  }
}

function getDiagnostics(): EditorPerformanceDiagnostics {
  const diagnostics = window.__MF_EDITOR_PERFORMANCE__ ?? {
    interactions: [],
    longTasks: [],
    snapshots: [],
  }
  diagnostics.longTasks ??= []
  diagnostics.interactionCommits ??= []
  diagnostics.opens ??= []
  diagnostics.responsiveness ??= []
  window.__MF_EDITOR_PERFORMANCE__ = diagnostics
  if (!longTaskObserver && 'PerformanceObserver' in window) {
    try {
      longTaskObserver = new PerformanceObserver((list) => {
        if (!diagnosticsEnabled()) {
          longTaskObserver?.disconnect()
          longTaskObserver = undefined
          return
        }
        list.getEntries().forEach((entry) => {
          const openings = openingSamplesIntersecting(entry.startTime, entry.duration)
          if (!openings.length) {
            appendSample(diagnostics.longTasks, {
              duration: entry.duration,
              startTime: entry.startTime,
            })
            return
          }
          for (const opening of openings) {
            appendSample(diagnostics.longTasks, {
              ...openingIdentity(opening),
              duration: entry.duration,
              startTime: entry.startTime,
            })
          }
        })
      })
      longTaskObserver.observe({ type: 'longtask', buffered: false })
    } catch {
      longTaskObserver = undefined
    }
  }
  return diagnostics
}

function hasOpeningWork(): boolean {
  return (
    diagnosticsEnabled() && [...currentOpens.values()].some((sample) => sample.status === 'opening')
  )
}

function stopOpeningObservers(): void {
  if (responsivenessTimer !== undefined) window.clearTimeout(responsivenessTimer)
  if (responsivenessFrame !== undefined) window.cancelAnimationFrame(responsivenessFrame)
  responsivenessTimer = undefined
  responsivenessFrame = undefined
  longTaskObserver?.disconnect()
  longTaskObserver = undefined
}

function observeOpeningResponsiveness(): void {
  if (responsivenessTimer !== undefined) return
  let expected = window.performance.now() + 50
  let previousFrame = window.performance.now()
  const tick = () => {
    if (!hasOpeningWork()) return stopOpeningObservers()
    const now = window.performance.now()
    if (now - expected >= 50) {
      appendResponsivenessForActiveOpenings({
        source: 'event-loop-delay',
        duration: now - expected,
        recordedAt: now,
      })
    }
    expected = now + 50
    responsivenessTimer = window.setTimeout(tick, 50)
  }
  const frame = () => {
    if (!hasOpeningWork()) return stopOpeningObservers()
    const now = window.performance.now()
    if (now - previousFrame >= 50 && document.visibilityState !== 'hidden') {
      appendResponsivenessForActiveOpenings({
        source: 'frame-gap',
        duration: now - previousFrame,
        recordedAt: now,
      })
    }
    previousFrame = now
    responsivenessFrame = window.requestAnimationFrame(frame)
  }
  responsivenessTimer = window.setTimeout(tick, 50)
  responsivenessFrame = window.requestAnimationFrame(frame)
}

export function beginEditorOpenMeasurement(
  fileId: string,
  options: {
    viewId?: string
    origin?: EditorOpenSample['origin']
    kind?: EditorOpenSample['kind']
  } = {},
): string | undefined {
  if (!diagnosticsEnabled()) return undefined
  const viewId = options.viewId ?? fileId
  const previous = currentOpens.get(viewId)
  if (previous?.status === 'opening')
    finishEditorOpenMeasurement(previous.openRequestId, 'canceled')
  const sample: EditorOpenSample = {
    // Module-first samples necessarily span WebView launches. A per-session
    // prefix keeps request identity unique when those runs are merged into one
    // acceptance report instead of restarting from "open-1" every launch.
    openRequestId: `open-${diagnosticSessionId}-${++openSequence}`,
    fileId,
    viewId,
    origin: options.origin ?? 'command',
    kind: options.kind ?? 'open',
    startedAt: window.performance.now(),
    status: 'opening',
    stages: [{ stage: 'requested', elapsedMs: 0 }],
  }
  currentOpens.set(viewId, sample)
  if (currentOpens.size > MAX_RETAINED_SAMPLES)
    currentOpens.delete(currentOpens.keys().next().value!)
  appendSample(getDiagnostics().opens!, sample)
  observeOpeningResponsiveness()
  return sample.openRequestId
}

export function getEditorOpenMeasurement(fileId: string, viewId = fileId): string | undefined {
  if (!diagnosticsEnabled()) return undefined
  const sample = currentOpens.get(viewId)
  return sample?.fileId === fileId && sample.status === 'opening' ? sample.openRequestId : undefined
}

function findOpen(requestId: string | undefined): EditorOpenSample | undefined {
  if (!requestId || !diagnosticsEnabled()) return undefined
  return [...currentOpens.values()].find((sample) => sample.openRequestId === requestId)
}

export function recordEditorOpenStage(
  requestId: string | undefined,
  stage: string,
  metadata: Partial<
    Pick<
      EditorOpenSample,
      | 'byteLength'
      | 'blockCount'
      | 'contentRevision'
      | 'kind'
      | 'mode'
      | 'runtimeVersion'
      | 'runtimeEntrySha256'
      | 'moduleState'
    >
  > & {
    runtimeElapsedMs?: number
    durationMs?: number
  } = {},
): void {
  const sample = findOpen(requestId)
  if (!sample || sample.status !== 'opening') return
  const { runtimeElapsedMs, durationMs, ...details } = metadata
  Object.assign(sample, details)
  // Keep the first phase timestamp plus its latest completion/duration, without
  // retaining one allocation per hydrated batch. Worker clocks are relative:
  // only its explicit durationMs represents parse CPU time.
  const prior = sample.stages.find((entry) => entry.stage === stage)
  if (prior) {
    prior.latestElapsedMs = window.performance.now() - sample.startedAt
    if (runtimeElapsedMs !== undefined) prior.runtimeElapsedMs = runtimeElapsedMs
    if (durationMs !== undefined) prior.durationMs = durationMs
    return
  }
  sample.stages.push({
    stage,
    elapsedMs: window.performance.now() - sample.startedAt,
    runtimeElapsedMs,
    durationMs,
  })
}

export function recordEditorOpenContent(
  requestId: string | undefined,
  content: string,
  options: { onlyIfMissing?: boolean } = {},
): void {
  const sample = findOpen(requestId)
  if (!sample || sample.status !== 'opening') return
  if (
    options.onlyIfMissing &&
    (sample.byteLength !== undefined || pendingOpenContent.has(sample.openRequestId))
  )
    return

  // Keep content private and only long enough to compute diagnostic metadata.
  // Non-blank Markdown normally exits this test at its first visible byte;
  // the complete scan is only needed to validate a genuinely blank document.
  pendingOpenContent.set(sample.openRequestId, {
    content,
    isBlank: !/[^\s\u200b\ufeff]/u.test(content),
  })
  recordEditorOpenStage(requestId, 'content-ready')
}

export function finishEditorOpenMeasurement(
  requestId: string | undefined,
  status: EditorOpenSample['status'],
): void {
  const sample = findOpen(requestId)
  if (!sample || sample.status !== 'opening') return
  sample.status = status
  sample.duration = window.performance.now() - sample.startedAt
  sample.stages.push({ stage: status, elapsedMs: sample.duration })
  const pendingContent = pendingOpenContent.get(sample.openRequestId)
  pendingOpenContent.delete(sample.openRequestId)
  if (status !== 'canceled' && pendingContent) {
    // Encoding a 2 MiB string is diagnostic work, not editor initialization.
    // Run it in a later task after the terminal endpoint has been captured,
    // and expose its own stage so acceptance collectors can wait for exact
    // UTF-8 bytes without charging that work to open.duration. Canceled opens
    // deliberately release their content without doing diagnostic work.
    window.setTimeout(() => {
      if (!diagnosticsEnabled()) return
      const startedAt = window.performance.now()
      sample.byteLength = new TextEncoder().encode(pendingContent.content).byteLength
      const finishedAt = window.performance.now()
      sample.stages.push({
        stage: 'content-measured',
        elapsedMs: finishedAt - sample.startedAt,
        durationMs: finishedAt - startedAt,
      })
    }, 0)
  }
  if (!hasOpeningWork()) stopOpeningObservers()
}

function hasVisiblePendingSourceEditor(container: HTMLElement): boolean {
  let left = 0
  let top = 0
  let right = window.innerWidth
  let bottom = window.innerHeight
  // Intersect the actual host/panel viewport, not the full document's height.
  for (const element of [container, container.closest<HTMLElement>('[data-editor-id]')]) {
    const rect = element?.getBoundingClientRect()
    if (!rect || rect.width <= 0 || rect.height <= 0) continue
    left = Math.max(left, rect.left)
    top = Math.max(top, rect.top)
    right = Math.min(right, rect.right)
    bottom = Math.min(bottom, rect.bottom)
  }
  return Array.from(
    container.querySelectorAll<HTMLElement>('[data-cap-source-editor-pending="true"]'),
  ).some((element) => {
    const style = getComputedStyle(element)
    if (style.display === 'none' || style.visibility === 'hidden') return false
    const rect = element.getBoundingClientRect()
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      rect.right > left &&
      rect.left < right &&
      rect.bottom > top &&
      rect.top < bottom
    )
  })
}

/** Confirm an actual, current, visible editable surface across a paint opportunity. */
export function observeEditorFirstPaint({
  requestId,
  fileId,
  container,
  isCurrent,
  onBeforeInput,
}: {
  requestId: string | undefined
  fileId: string
  container: HTMLElement
  isCurrent: () => boolean
  onBeforeInput?: () => void
}): () => void {
  const observedOpen = findOpen(requestId)
  if (!observedOpen) return () => {}
  const observedViewId = observedOpen.viewId
  recordEditorOpenStage(requestId, 'surface-committed')
  // Capricorn owns a separate React root and body-portal textarea. The host
  // wrapper's capture handler never sees its native beforeinput events.
  let visualInputStartedAt: number | undefined
  // Multiple native inputs before one paint intentionally collapse to the
  // latest event. This is a paint-level feedback sample, not a keystroke log.
  let visualInputSequence = 0
  let visualFrame: number | undefined
  const mutationObserver = new MutationObserver((records) => {
    if (visualInputStartedAt === undefined) return
    const related = records.some((record) => {
      const element =
        record.target.nodeType === Node.ELEMENT_NODE
          ? (record.target as Element)
          : record.target.parentElement
      if (record.type === 'characterData') {
        return Boolean(element?.closest('.cm-content[contenteditable="true"], [data-cap-leaf]'))
      }
      if (record.type !== 'childList' || (!record.addedNodes.length && !record.removedNodes.length))
        return false
      if (element?.closest('.cm-content[contenteditable="true"]')) return true
      const content = container.querySelector<HTMLElement>('[data-cap-content]')
      return Boolean(content && element && (element === content || content.contains(element)))
    })
    if (!related) return
    const sequence = visualInputSequence
    if (visualFrame !== undefined) window.cancelAnimationFrame(visualFrame)
    visualFrame = window.requestAnimationFrame(() => {
      visualFrame = undefined
      if (sequence !== visualInputSequence || visualInputStartedAt === undefined) return
      appendInteractionSample(fileId, visualInputStartedAt, observedViewId, requestId)
      visualInputStartedAt = undefined
    })
  })
  mutationObserver.observe(container, { characterData: true, childList: true, subtree: true })
  const removeInputListener = subscribeCapricornBeforeInput(container, () => {
    visualInputStartedAt = startEditorInteractionMeasurement()
    visualInputSequence += 1
    onBeforeInput?.()
  })
  let canceled = false
  let frameId: number | undefined
  let confirmed = false
  const startedAt = window.performance.now()
  const check = () => {
    if (canceled) return
    if (findOpen(requestId)?.status !== 'opening') return
    if (!isCurrent() || !container.isConnected) {
      finishEditorOpenMeasurement(requestId, 'canceled')
      return
    }
    const panel = container.closest<HTMLElement>('[data-editor-id]')
    const content = container.querySelector<HTMLElement>('[data-cap-content]')
    const input = getCapricornRuntimeInput(container)
    const bounds = content?.getBoundingClientRect()
    const hasContent =
      pendingOpenContent.get(requestId ?? '')?.isBlank ||
      findOpen(requestId)?.byteLength === 0 ||
      Boolean(content?.textContent?.replace(/[\s\u200b\ufeff]/g, '')) ||
      content?.querySelector('img, hr, table, [data-markdown-block]')
    const valid =
      panel?.dataset.editorId === fileId &&
      panel.style.display !== 'none' &&
      content &&
      getComputedStyle(container).visibility !== 'hidden' &&
      bounds &&
      bounds.width > 0 &&
      bounds.height > 0 &&
      input &&
      !input.disabled &&
      !input.readOnly &&
      !hasVisiblePendingSourceEditor(container) &&
      hasContent &&
      content.querySelector('[data-cap-leaf], img, hr, table, [data-markdown-block]')
    if (valid && confirmed) {
      finishEditorOpenMeasurement(requestId, 'ready')
      return
    }
    confirmed = Boolean(valid)
    if (window.performance.now() - startedAt > 5_000) {
      finishEditorOpenMeasurement(requestId, 'unverified')
      return
    }
    frameId = window.requestAnimationFrame(check)
  }
  frameId = window.requestAnimationFrame(check)
  return () => {
    canceled = true
    removeInputListener?.()
    mutationObserver.disconnect()
    if (visualFrame !== undefined) window.cancelAnimationFrame(visualFrame)
    if (frameId !== undefined) window.cancelAnimationFrame(frameId)
  }
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
  viewId?: string,
  phase: 'commit' | 'visual-feedback' = 'visual-feedback',
  openRequestId?: string,
): void {
  if (startedAt === undefined || !diagnosticsEnabled()) return

  if (phase === 'commit') {
    const now = window.performance.now()
    appendSample(getDiagnostics().interactionCommits!, {
      fileId,
      ...(viewId ? { viewId } : {}),
      ...(openRequestId ? { openRequestId } : {}),
      duration: now - startedAt,
      recordedAt: now,
    })
    const sample = openRequestId
      ? findOpen(openRequestId)
      : [...currentOpens.values()].find(
          (entry) => entry.fileId === fileId && (viewId === undefined || entry.viewId === viewId),
        )
    const canAttach =
      sample?.fileId === fileId &&
      (viewId === undefined || sample.viewId === viewId) &&
      (sample.status === 'ready' ||
        (sample.status === 'opening' &&
          sample.stages.some((stage) => stage.stage === 'surface-committed'))) &&
      sample.firstInputCommitDuration === undefined
    if (canAttach) sample.firstInputCommitDuration = now - startedAt
    return
  }

  window.requestAnimationFrame(() => {
    if (!diagnosticsEnabled()) return
    appendInteractionSample(fileId, startedAt, viewId, openRequestId)
  })
}

function appendInteractionSample(
  fileId: string,
  startedAt: number,
  viewId?: string,
  openRequestId?: string,
): void {
  if (!diagnosticsEnabled()) return
  const now = window.performance.now()
  appendSample(getDiagnostics().interactions, {
    fileId,
    ...(viewId ? { viewId } : {}),
    ...(openRequestId ? { openRequestId } : {}),
    duration: now - startedAt,
    recordedAt: now,
  })
  const sample = openRequestId
    ? findOpen(openRequestId)
    : [...currentOpens.values()].find(
        (entry) => entry.fileId === fileId && (viewId === undefined || entry.viewId === viewId),
      )
  const canAttach =
    sample?.fileId === fileId &&
    (viewId === undefined || sample.viewId === viewId) &&
    (sample.status === 'ready' ||
      (sample.status === 'opening' &&
        sample.stages.some((stage) => stage.stage === 'surface-committed'))) &&
    sample.firstInputDuration === undefined
  if (canAttach) sample.firstInputDuration = now - startedAt
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
