import { AsyncSurface } from '@/components/AsyncSurface'
import { InlineInsertPopover } from './InlineInsertPopover'
import type { Ref } from 'react'
import {
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { ThemeContext } from 'styled-components'
import { createCapricornExportSurface, type CapricornExportSurface } from './capricornExportSurface'
import {
  createCapricornRuntimeAdapter,
  createCapricornRuntimeAdapterAsync,
  getCapricornFirstPaintBlockSize,
  getLoadedCapricornRuntimeFactory,
  loadCapricornRuntimeAsyncFactory,
  loadCapricornRuntimeFactory,
  requiresAsyncCapricornOpen,
  type CapricornEditorChangeEvent,
  type CapricornEditorSettings,
  type CapricornRuntimeAdapter,
  type CapricornRuntimeFactory,
  type CapricornRuntimeOptions,
  type CapricornRuntimeProgress,
} from './capricornRuntimeAdapter'

export interface CapricornEditorHandle {
  createExportSurface: (markdown: string) => Promise<CapricornExportSurface>
  export: CapricornRuntimeAdapter['export']
  focus: () => void
  getMarkdown: () => string
  isComposing: () => boolean
  setMarkdown: (markdown: string, contentRevision?: number) => void
  waitForResources: () => Promise<void>
}

export interface CapricornRuntimeRequestIdentity {
  contentRevision: number
  runtimeRequestSequence: number
}

export interface CapricornEditorProps {
  active: boolean
  contentRevision?: number
  visible?: boolean
  editorId?: string
  initialMarkdown: string
  onChange: (event?: CapricornEditorChangeEvent) => void
  onError: (error: unknown) => void
  onEditorChange?: (editor: CapricornRuntimeAdapter | null) => void
  onOpenProgress?: (
    progress: CapricornRuntimeProgress,
    identity: CapricornRuntimeRequestIdentity,
  ) => void
  onRetry?: () => void
  onRuntimeReady?: (container: HTMLElement, identity: CapricornRuntimeRequestIdentity) => void
  onUnavailable: (error: unknown) => void
  options: Omit<CapricornRuntimeOptions, 'autoFocus' | 'markdown' | 'onError'>
  ref?: Ref<CapricornEditorHandle>
}

export function CapricornEditor({
  active,
  contentRevision = 0,
  visible = active,
  editorId,
  initialMarkdown,
  onChange,
  onError,
  onEditorChange,
  onOpenProgress,
  onRetry,
  onRuntimeReady,
  onUnavailable,
  options,
  ref,
}: CapricornEditorProps) {
  const editorTheme = useContext(ThemeContext)
  // The private runtime has its own React root, so bridge the host editor
  // theme through its style API (including inline code and CodeMirror blocks).
  const runtimeStyle = useMemo(
    () => ({
      fontFamily: editorTheme?.fontFamily,
      '--cap-font-mono': editorTheme?.codemirrorFontFamily,
      '--cap-code-font-family': editorTheme?.codemirrorFontFamily,
      ...options.style,
    }),
    [editorTheme?.fontFamily, editorTheme?.codemirrorFontFamily, options.style],
  )
  const containerRef = useRef<HTMLDivElement>(null)
  const adapterRef = useRef<CapricornRuntimeAdapter | null>(null)
  const runtimeCleanupRef = useRef<(() => void) | undefined>(undefined)
  const latestMarkdownRef = useRef(initialMarkdown)
  const contentRevisionRef = useRef(contentRevision)
  const initialMarkdownRef = useRef(initialMarkdown)
  const activeRef = useRef(active)
  const visibleRef = useRef(visible)
  const startRuntimeRef = useRef<(() => void) | undefined>(undefined)
  const pendingAutoFocusRef = useRef(false)
  const readyObservationRef = useRef<{
    adapter: CapricornRuntimeAdapter | null
    active: boolean
    visible: boolean
  } | null>(null)
  const attachedIdentityRef = useRef<{
    contentRevision: number
    runtimeRequestSequence: number
  } | null>(null)
  const runtimeRequestSequenceRef = useRef(0)
  const onChangeRef = useRef(onChange)
  const onErrorRef = useRef(onError)
  const onEditorChangeRef = useRef(onEditorChange)
  const onOpenProgressRef = useRef(onOpenProgress)
  const onRetryRef = useRef(onRetry)
  const onRuntimeReadyRef = useRef(onRuntimeReady)
  const onUnavailableRef = useRef(onUnavailable)
  const optionsRef = useRef(options)
  const loadErrorRef = useRef<{ error: unknown; asynchronous: boolean } | null>(null)
  const unavailableReportedRef = useRef(false)
  const [attempt, setAttempt] = useState(0)
  const [inlineSurface, setInlineSurface] = useState<{
    editor: CapricornRuntimeAdapter
    element: HTMLElement
  } | null>(null)
  const [state, setState] = useState<'loading' | 'preparing' | 'ready' | 'error'>(() =>
    getLoadedCapricornRuntimeFactory() ? 'preparing' : 'loading',
  )

  // The Controller owns live edits. Host snapshots are only the seed for a
  // new runtime; external replacements use the imperative setMarkdown handle.
  if (
    contentRevisionRef.current !== contentRevision ||
    initialMarkdownRef.current !== initialMarkdown
  ) {
    initialMarkdownRef.current = initialMarkdown
    latestMarkdownRef.current = initialMarkdown
  }
  contentRevisionRef.current = contentRevision
  activeRef.current = active
  visibleRef.current = visible
  onChangeRef.current = onChange
  onErrorRef.current = onError
  onEditorChangeRef.current = onEditorChange
  onOpenProgressRef.current = onOpenProgress
  onRetryRef.current = onRetry
  onRuntimeReadyRef.current = onRuntimeReady
  onUnavailableRef.current = onUnavailable
  optionsRef.current = { ...options, style: runtimeStyle }

  const reportUnavailable = useCallback((error: unknown) => {
    if (unavailableReportedRef.current) return
    unavailableReportedRef.current = true
    onUnavailableRef.current(error)
  }, [])

  useImperativeHandle(
    ref,
    () => ({
      createExportSurface: (markdown) => {
        const source = containerRef.current
        if (!source) return Promise.reject(new Error('Editor is not ready.'))
        return createCapricornExportSurface({ source, markdown, options: optionsRef.current })
      },
      export: (format) =>
        adapterRef.current?.export(format) ?? Promise.reject(new Error('Editor is not ready.')),
      focus: () => adapterRef.current?.focus(),
      getMarkdown: () => adapterRef.current?.getMarkdown() ?? latestMarkdownRef.current,
      isComposing: () => adapterRef.current?.isComposing() ?? false,
      setMarkdown: (nextMarkdown, nextContentRevision) => {
        latestMarkdownRef.current = nextMarkdown
        if (nextContentRevision !== undefined) {
          contentRevisionRef.current = nextContentRevision
        }
        adapterRef.current?.setMarkdown(nextMarkdown)
        if (!adapterRef.current) startRuntimeRef.current?.()
      },
      waitForResources: () => adapterRef.current?.waitForResources() ?? Promise.resolve(),
    }),
    [],
  )

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return

    let disposed = false
    let ownedAdapter: CapricornRuntimeAdapter | null = null
    let request:
      | {
          abort: AbortController
          markdown: string
          asynchronous: boolean
          contentRevision: number
          runtimeRequestSequence: number
          startedAt: number
          moduleState: 'cold' | 'warm'
          options?: CapricornRuntimeOptions
        }
      | undefined
    loadErrorRef.current = null
    unavailableReportedRef.current = false
    setState(getLoadedCapricornRuntimeFactory() ? 'preparing' : 'loading')
    setInlineSurface(null)

    const getOptions = (): CapricornRuntimeOptions => {
      const getScrollableContainer =
        optionsRef.current.getScrollableContainer ??
        (() => {
          const editorContainer = container.closest<HTMLElement>('[data-editor-id]')
          return (
            editorContainer?.querySelector<HTMLElement>('[data-overlayscrollbars-viewport]') ??
            editorContainer ??
            container
          )
        })
      const viewport = getScrollableContainer()
      const viewportHeight =
        'innerHeight' in viewport ? viewport.innerHeight : viewport.clientHeight
      return {
        ...optionsRef.current,
        autoFocus: activeRef.current,
        getScrollableContainer,
        markdown: latestMarkdownRef.current,
        mode: 'edit',
        onError: (error) => onErrorRef.current(error),
        virtualize: optionsRef.current.virtualize
          ? {
              ...optionsRef.current.virtualize,
              firstPaintBlockSize: Math.min(
                optionsRef.current.virtualize.firstPaintBlockSize ?? 40,
                getCapricornFirstPaintBlockSize(viewportHeight),
              ),
            }
          : undefined,
      }
    }
    const attach = (adapter: CapricornRuntimeAdapter, current: NonNullable<typeof request>) => {
      const stale =
        disposed ||
        request !== current ||
        current.abort.signal.aborted ||
        current.contentRevision !== contentRevisionRef.current ||
        current.markdown !== latestMarkdownRef.current ||
        (current.asynchronous && !visibleRef.current)
      if (stale) {
        adapter.destroy()
        if (!disposed && request === current) {
          request = undefined
          queueMicrotask(start)
        }
        return
      }
      if (current.asynchronous && current.options) {
        const changedSettings = (
          [
            'className',
            'colorScheme',
            'density',
            'keybindingConfiguration',
            'readOnly',
            'spellCheck',
            'style',
            'typewriter',
          ] as const
        ).some((key) => current.options?.[key] !== optionsRef.current[key])
        if (changedSettings) {
          try {
            adapter.updateSettings(optionsRef.current)
          } catch (error) {
            adapter.destroy()
            throw error
          }
        }
      }
      request = undefined
      ownedAdapter = adapter
      adapterRef.current = adapter
      attachedIdentityRef.current = {
        contentRevision: current.contentRevision,
        runtimeRequestSequence: current.runtimeRequestSequence,
      }
      container.dataset.mfCapricornRuntimeRequest = String(current.runtimeRequestSequence)
      pendingAutoFocusRef.current = current.asynchronous
      setInlineSurface({ editor: adapter, element: container })
      onEditorChangeRef.current?.(adapter)
      setState('ready')
    }
    const handleLoadError = (error: unknown, current: NonNullable<typeof request>) => {
      if (disposed || request !== current || current.abort.signal.aborted) return
      request = undefined
      loadErrorRef.current = { error, asynchronous: current.asynchronous }
      setState('error')
      if (current.asynchronous) onErrorRef.current(error)
    }
    const reportProgress = (
      current: NonNullable<typeof request>,
      progress: CapricornRuntimeProgress,
    ) => {
      if (progress.stage === 'module-ready') setState('preparing')
      onOpenProgressRef.current?.(progress, {
        contentRevision: current.contentRevision,
        runtimeRequestSequence: current.runtimeRequestSequence,
      })
    }
    const start = () => {
      if (disposed || ownedAdapter) return
      const markdown = latestMarkdownRef.current
      const currentContentRevision = contentRevisionRef.current
      const asynchronous = requiresAsyncCapricornOpen(markdown)
      if (
        request &&
        (request.contentRevision !== currentContentRevision ||
          request.markdown !== markdown ||
          (request.asynchronous && !visibleRef.current))
      ) {
        request.abort.abort()
        request = undefined
      }
      if (asynchronous && !visibleRef.current) return
      if (request || loadErrorRef.current) return
      const loadedFactory = getLoadedCapricornRuntimeFactory()
      const current = {
        abort: new AbortController(),
        markdown,
        asynchronous,
        contentRevision: currentContentRevision,
        runtimeRequestSequence: ++runtimeRequestSequenceRef.current,
        startedAt: performance.now(),
        moduleState: loadedFactory ? ('warm' as const) : ('cold' as const),
        options: undefined as CapricornRuntimeOptions | undefined,
      }
      request = current
      if (asynchronous) {
        void loadCapricornRuntimeAsyncFactory()
          .then(async (createRuntime) => {
            if (
              disposed ||
              request !== current ||
              current.abort.signal.aborted ||
              current.contentRevision !== contentRevisionRef.current ||
              current.markdown !== latestMarkdownRef.current ||
              !visibleRef.current
            ) {
              if (!disposed && request === current) {
                current.abort.abort()
                request = undefined
                start()
              }
              return
            }
            reportProgress(current, {
              stage: 'module-ready',
              elapsedMs: performance.now() - current.startedAt,
              moduleState: current.moduleState,
            })
            current.options = getOptions()
            const adapter = await createCapricornRuntimeAdapterAsync({
              container,
              createRuntime,
              onChange: (event) => onChangeRef.current(event),
              options: {
                ...current.options,
                // Focus is granted only after the still-current request attaches.
                autoFocus: false,
                signal: current.abort.signal,
                onProgress: (progress) => {
                  if (!disposed && request === current && !current.abort.signal.aborted) {
                    reportProgress(current, progress)
                  }
                },
              },
            })
            attach(adapter, current)
          })
          .catch((error: unknown) => handleLoadError(error, current))
        return
      }
      const initializeRuntime = (createRuntime: CapricornRuntimeFactory) => {
        if (disposed || request !== current) return
        if (
          current.contentRevision !== contentRevisionRef.current ||
          current.markdown !== latestMarkdownRef.current ||
          requiresAsyncCapricornOpen(latestMarkdownRef.current)
        ) {
          current.abort.abort()
          request = undefined
          start()
          return
        }
        reportProgress(current, {
          stage: 'module-ready',
          elapsedMs: performance.now() - current.startedAt,
          moduleState: current.moduleState,
        })
        attach(
          createCapricornRuntimeAdapter({
            container,
            createRuntime,
            onChange: (event) => onChangeRef.current(event),
            options: getOptions(),
          }),
          current,
        )
      }
      if (loadedFactory) {
        // The runtime mounts its own React root with flushSync. Even a warm
        // factory must run after the host commit, including StrictMode replay.
        void Promise.resolve(loadedFactory)
          .then(initializeRuntime)
          .catch((error: unknown) => handleLoadError(error, current))
      } else {
        void loadCapricornRuntimeFactory()
          .then(initializeRuntime)
          .catch((error: unknown) => handleLoadError(error, current))
      }
    }
    startRuntimeRef.current = start

    runtimeCleanupRef.current = () => {
      if (!ownedAdapter) return
      if (adapterRef.current === ownedAdapter) {
        onEditorChangeRef.current?.(null)
        adapterRef.current = null
      }
      ownedAdapter.destroy()
      ownedAdapter = null
      if (
        attachedIdentityRef.current &&
        container.dataset.mfCapricornRuntimeRequest ===
          String(attachedIdentityRef.current.runtimeRequestSequence)
      ) {
        delete container.dataset.mfCapricornRuntimeRequest
      }
      attachedIdentityRef.current = null
    }

    // Queue the small preloaded path outside this commit. Large preparation
    // starts only from the passive effect, never from the layout effect.
    if (!requiresAsyncCapricornOpen(latestMarkdownRef.current)) start()

    return () => {
      disposed = true
      request?.abort.abort()
    }
  }, [attempt])

  // Capture this attempt's cleanup. Destruction must stay passive so the
  // parent can flush its last Markdown snapshot before the session is gone.
  useEffect(() => runtimeCleanupRef.current, [attempt])

  useEffect(() => {
    startRuntimeRef.current?.()
  }, [attempt, contentRevision, initialMarkdown, visible])

  useEffect(() => {
    const previous = readyObservationRef.current
    const adapter = adapterRef.current
    readyObservationRef.current = { adapter, active, visible }
    if (
      state === 'ready' &&
      visible &&
      containerRef.current &&
      (adapter !== previous?.adapter || !previous?.visible || (active && !previous.active))
    ) {
      if (active && pendingAutoFocusRef.current) {
        pendingAutoFocusRef.current = false
        adapterRef.current?.focus()
      }
      const identity = attachedIdentityRef.current
      if (identity) {
        onRuntimeReadyRef.current?.(containerRef.current, {
          ...identity,
          // A retained runtime may have received in-place host or local edits
          // since its initial seed; its request token remains the same.
          contentRevision: contentRevisionRef.current,
        })
      }
    }
  }, [active, visible, state])

  useEffect(() => {
    if (!active || state !== 'error' || !loadErrorRef.current) return
    const { error, asynchronous } = loadErrorRef.current
    // Worker/capability errors are retryable WYSIWYG errors, never an implicit
    // mode change just because a document crossed the large-file threshold.
    if (asynchronous) return
    let disposed = false
    // A warm factory can fail during layout, before the host's passive mode
    // switch listener exists. Report after those listeners have mounted.
    queueMicrotask(() => {
      if (!disposed) reportUnavailable(error)
    })
    return () => {
      disposed = true
    }
  }, [active, attempt, reportUnavailable, state])

  useEffect(() => {
    const settings: CapricornEditorSettings = {
      className: options.className,
      colorScheme: options.colorScheme,
      density: options.density,
      keybindingConfiguration: options.keybindingConfiguration,
      readOnly: options.readOnly,
      spellCheck: options.spellCheck,
      style: runtimeStyle,
      typewriter: options.typewriter,
    }
    adapterRef.current?.updateSettings(settings)
  }, [
    options.className,
    options.colorScheme,
    options.density,
    options.keybindingConfiguration,
    options.readOnly,
    options.spellCheck,
    options.typewriter,
    runtimeStyle,
  ])

  const retry = useCallback(() => {
    onRetryRef.current?.()
    setAttempt((current) => current + 1)
  }, [])

  return (
    <div style={{ display: 'grid', minHeight: '100%', width: '100%' }}>
      <InlineInsertPopover
        editor={inlineSurface?.editor ?? null}
        anchorElement={inlineSurface?.element}
        editorId={editorId}
        active={active && state === 'ready'}
      />
      <div
        data-mf-capricorn-runtime='true'
        id={editorId}
        ref={containerRef}
        style={{
          gridColumn: 1,
          gridRow: 1,
          minHeight: '100%',
          visibility: state === 'ready' ? 'visible' : 'hidden',
          width: '100%',
        }}
      />
      {state === 'loading' || state === 'preparing' ? (
        <div style={{ gridColumn: 1, gridRow: 1 }}>
          <AsyncSurface
            state={{
              status: 'loading',
              label: state === 'loading' ? 'Loading Capricorn editor' : 'Opening document',
            }}
          >
            {() => null}
          </AsyncSurface>
        </div>
      ) : state === 'error' ? (
        <div style={{ gridColumn: 1, gridRow: 1 }}>
          <AsyncSurface
            retryLabel='Retry'
            state={{
              status: 'error',
              title: 'Unable to load the Capricorn editor',
              description: loadErrorRef.current?.asynchronous
                ? loadErrorRef.current.error instanceof Error
                  ? loadErrorRef.current.error.message
                  : 'Background document preparation failed. Please retry.'
                : undefined,
              retry,
            }}
          >
            {() => null}
          </AsyncSurface>
        </div>
      ) : null}
    </div>
  )
}
