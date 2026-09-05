import { isCapricornRuntimeAvailable } from '@/constants/capricornRuntime'
import { getCapricornActiveHeadingId } from './capricornHeadingViewport'

export interface CapricornFileWithProgress {
  file: File
  progress: (progress: number) => void
}

export interface CapricornImageInput {
  'data-file-name'?: string
  alt?: string
  referenceLabel?: string
  src: string
  title?: string
}

export type CapricornImageUploadResult = CapricornImageInput | null | string

export type CapricornBlockType =
  | 'blockquote'
  | 'code-block'
  | 'heading-1'
  | 'heading-2'
  | 'heading-3'
  | 'heading-4'
  | 'heading-5'
  | 'heading-6'
  | 'paragraph'

export type CapricornMarkType = 'bold' | 'code' | 'italic'

export interface CapricornCommandApi {
  insertLink?: (link: { href: string; text?: string; title?: string }) => void
  updateLink?: (update: { href?: string; title?: string | null }) => void
  removeLink?: () => void
  updateImage?: (key: string, update: Partial<CapricornImageInput>) => void
  removeImage?: (key: string) => void
  insertImage: (image: CapricornImageInput) => void
  redo: () => void
  setBlockType: (type: CapricornBlockType) => void
  toggleBlockquote: () => void
  toggleList: (type: 'bullet' | 'ordered' | 'task') => void
  toggleMark: (type: CapricornMarkType) => void
  undo: () => void
}

export interface CapricornUiState {
  link?: { key: string; href: string; title?: string } | null
  canRedo: boolean
  canUndo: boolean
  currentBlockType: string | null
  listType: 'bullet' | 'ordered' | 'task' | null
  markStates: Record<string, 'active' | 'inactive' | 'mixed'>
  readOnly: boolean
}

export interface CapricornFindState {
  activeIndex?: number
  caseSensitive: boolean
  matches: readonly unknown[]
  query: string
}

export interface CapricornFindApi {
  clear: () => CapricornFindState
  close: () => CapricornFindState
  getState: () => CapricornFindState
  next: () => Promise<unknown>
  open: (options?: { replace?: boolean }) => CapricornFindState
  previous: () => Promise<unknown>
  replace: (replacement: string) => Promise<boolean>
  replaceAll: (replacement: string) => number
  search: (request: {
    activeIndex?: number
    caseSensitive?: boolean
    query: string
  }) => CapricornFindState
  subscribe: (listener: (state: CapricornFindState) => void) => () => void
}

export interface CapricornHeading {
  id: string
  level: number
  number: string | null
  text: string
  title: string
}

export interface CapricornHeadingsApi {
  applyNumbering: () => { complete: boolean; hasHeadings: boolean }
  getAll: () => CapricornHeading[]
  getNumbering: () => { complete: boolean; hasHeadings: boolean }
  jumpTo: (id: string, options?: { offset?: number }) => Promise<boolean>
  removeNumbering: () => { complete: boolean; hasHeadings: boolean }
  subscribe: (listener: (headings: CapricornHeading[]) => void) => () => void
}

export interface CapricornKeybindingRule {
  id: string
  command: string
  keys: string
  when?: { context: string; op: 'truthy' | 'falsy' }
}

export interface CapricornKeybindingConfiguration {
  inheritDefaults: boolean
  customizations: readonly (
    | { type: 'replace'; targetRuleId: string; keys: string }
    | { type: 'disable'; targetRuleId: string }
    | { type: 'add'; rule: CapricornKeybindingRule }
  )[]
}

export interface CapricornEditorSettings {
  className?: string
  colorScheme?: 'dark' | 'light' | 'system'
  density?: 'comfortable' | 'compact'
  keybindingConfiguration?: CapricornKeybindingConfiguration
  readOnly?: boolean
  spellCheck?: boolean
  style?: React.CSSProperties
  typewriter?: boolean | { enabled?: boolean }
}

export interface CapricornLocalizationAdapter {
  getDirection?: () => 'ltr' | 'rtl'
  getLocale?: () => string
  subscribe?: (listener: () => void) => () => void
  translate: (request: {
    defaultValue: string
    key: string
    values?: Readonly<Record<string, number | string | undefined>>
  }) => string
}

export interface CapricornCopilotOptions {
  generateText: (request: {
    currentBlockAfter: string
    currentBlockBefore: string
    nextBlock: string
    previousBlock: string
    signal: AbortSignal
  }) => AsyncIterable<string> | Promise<AsyncIterable<string> | null | string> | null | string
}

export interface CapricornRuntimeOptions extends CapricornEditorSettings {
  commands?: readonly {
    id: `host.${string}`
    label: string
    precondition?: { context: string; op: 'truthy' | 'falsy' }
    execute: (context: { event?: KeyboardEvent }) => boolean
  }[]
  clipboard?: { writeText: (text: string) => void | Promise<void> }
  onClipboardResult?: (result: {
    action: 'copy' | 'cut'
    status: 'markdown' | 'retained' | 'failed'
  }) => void
  linkOpenMode?: 'button' | 'click' | 'modifier'
  onEditInline?: (request: { kind: 'link' | 'image'; key?: string; focus: boolean }) => void
  autoFocus?: boolean
  copilot?: false | CapricornCopilotOptions
  getScrollableContainer?: () => HTMLElement | Window
  handleLinkClick?: (href: string) => Promise<void> | void
  handleViewImgSrcUrl?: (source: string) => Promise<string> | string
  imageInsertHandler?: () => CapricornImageUploadResult | Promise<CapricornImageUploadResult>
  imagePasteHandler?: (source: string) => Promise<string> | string
  localization?: CapricornLocalizationAdapter
  markdown?: string
  mode?: 'edit' | 'preview'
  onError?: (error: unknown) => void
  uploadImageHandler?: (
    files: CapricornFileWithProgress[],
  ) => (() => Promise<CapricornImageUploadResult>)[]
  virtualize?: {
    bufferRange?: number
    enable?: boolean
    enableScrollAnchoring?: boolean
    firstPaintBlockSize?: number
  }
}

// Keep enough content rendered ahead of Desktop's throttled scroll events to
// avoid exposing placeholders during ordinary trackpad and wheel scrolling.
export const CAPRICORN_DESKTOP_VIRTUALIZE_OPTIONS = {
  bufferRange: 900,
  enable: true,
  enableScrollAnchoring: true,
  firstPaintBlockSize: 40,
} as const satisfies NonNullable<CapricornRuntimeOptions['virtualize']>

interface CapricornRuntimeChangeEvent {
  markdown: string
  mode: 'edit' | 'preview'
  type: 'change' | 'mode'
}

export interface CapricornEditorChangeEvent {
  composing?: boolean
  documentChanged?: boolean
  pending?: boolean
}

export interface CapricornSelectionBookmark {
  id: string
  text: string
  isCollapsed: boolean
  canInsertInline: boolean
  link: { key: string; href: string; title?: string } | null
  image: (CapricornImageInput & { key: string }) | null
}

export interface CapricornSelectionApi {
  capture: (nodeKey?: string) => CapricornSelectionBookmark | null
  getRect: (id: string) => { x: number; y: number; width: number; height: number } | null
  isValid: (id: string) => boolean
  restore: (id: string) => boolean
  release: (id?: string) => void
}

export interface CapricornInlineEditRequest {
  kind: 'link' | 'image'
  focus: boolean
  bookmark: CapricornSelectionBookmark
}

export interface CapricornRuntimeSession {
  query?: <Result = unknown>(query: string, ...args: unknown[]) => Result
  keybindings?: {
    validateConfiguration: (configuration: CapricornKeybindingConfiguration) => {
      ok: boolean
      diagnostics: readonly { message: string }[]
    }
  }
  readonly selection?: CapricornSelectionApi
  readonly commands: CapricornCommandApi
  readonly find: CapricornFindApi
  readonly headings: CapricornHeadingsApi
  destroy: () => void
  export: (format?: 'html' | 'json' | 'markdown' | 'text') => Promise<string>
  focus: () => void
  getMarkdown: () => string
  /**
   * Returns a cached or cooperatively computed plain-text count. Implementations
   * must not synchronously export or traverse the whole document on the caller's
   * thread.
   */
  getStatistics?: (options?: { signal?: AbortSignal }) => Promise<CapricornDocumentStatistics>
  isComposing?: () => boolean
  getUiState: () => CapricornUiState
  setMarkdown: (markdown: string) => void
  subscribe: (listener: (event: CapricornRuntimeChangeEvent) => void) => () => void
  subscribeDocumentChange?: (
    listener: (event: { composing?: boolean; pending?: boolean; revision: number }) => void,
  ) => () => void
  subscribeUiState: (listener: (state: CapricornUiState) => void) => () => void
  updateSettings: (settings: Partial<CapricornEditorSettings>) => void
  waitForResources: () => Promise<void>
}

export interface CapricornDocumentStatistics {
  characterCount: number
  nonWhitespaceCharacterCount: number
  wordCount: number
}

export type CapricornRuntimeFactory = (
  container: HTMLElement,
  options?: CapricornRuntimeOptions,
) => CapricornRuntimeSession

export interface CapricornRuntimeProgress {
  stage:
    | 'module-ready'
    | 'queued'
    | 'parse'
    | 'transfer'
    | 'hydrate'
    | 'model'
    | 'index'
    | 'mount'
    | 'ready'
  elapsedMs: number
  completed?: number
  total?: number
  blockCount?: number
  durationMs?: number
  moduleState?: 'cold' | 'warm'
}

export interface CapricornRuntimeAsyncOptions extends CapricornRuntimeOptions {
  signal?: AbortSignal
  onProgress?: (progress: CapricornRuntimeProgress) => void
}

export type CapricornRuntimeAsyncFactory = (
  container: HTMLElement,
  options?: CapricornRuntimeAsyncOptions,
) => Promise<CapricornRuntimeSession>

export const CAPRICORN_ASYNC_OPEN_THRESHOLD_BYTES = 256 * 1024

export function requiresAsyncCapricornOpen(markdown: string): boolean {
  // UTF-8 uses at least one and at most three bytes per UTF-16 code unit.
  // Avoid allocating a second complete buffer for ordinary large documents.
  if (markdown.length >= CAPRICORN_ASYNC_OPEN_THRESHOLD_BYTES) return true
  if (markdown.length * 3 < CAPRICORN_ASYNC_OPEN_THRESHOLD_BYTES) return false
  return new TextEncoder().encode(markdown).byteLength >= CAPRICORN_ASYNC_OPEN_THRESHOLD_BYTES
}

export function getCapricornFirstPaintBlockSize(viewportHeight: number): number {
  return Math.max(1, Math.min(40, Math.ceil((viewportHeight || 640) / 24) + 2))
}

export interface CapricornRuntimeAdapter {
  getActiveHeadingId?: (
    headings: readonly CapricornHeading[],
    scrollEl: HTMLElement,
  ) => string | null
  readonly selection?: CapricornSelectionApi
  requestInlineEdit?: (kind: 'link' | 'image', key?: string, focus?: boolean) => boolean
  subscribeInlineEdit?: (
    listener: (request: CapricornInlineEditRequest | null) => void,
  ) => () => void
  readonly commands: CapricornCommandApi
  readonly find: CapricornFindApi
  readonly headings: CapricornHeadingsApi
  destroy: () => void
  export: (format?: 'html' | 'json' | 'markdown' | 'text') => Promise<string>
  focus: () => void
  getMarkdown: () => string
  getStatistics?: (options?: { signal?: AbortSignal }) => Promise<CapricornDocumentStatistics>
  isComposing: () => boolean
  getUiState: () => CapricornUiState
  requestImageInsert: () => Promise<boolean>
  setMarkdown: (markdown: string) => void
  subscribeUiState: (listener: (state: CapricornUiState) => void) => () => void
  updateSettings: (settings: Partial<CapricornEditorSettings>) => void
  waitForResources: () => Promise<void>
}

export function createCapricornRuntimeAdapter({
  container,
  createRuntime,
  onChange,
  options,
}: {
  container: HTMLElement
  createRuntime: CapricornRuntimeFactory
  onChange: (event?: CapricornEditorChangeEvent) => void
  options: CapricornRuntimeOptions
}): CapricornRuntimeAdapter {
  const inlineEditListeners = new Set<(request: CapricornInlineEditRequest | null) => void>()
  let inlineBookmarkId: string | undefined
  const invalidateInlineEdit = () => {
    if (!inlineBookmarkId || session.selection?.isValid(inlineBookmarkId)) return
    inlineBookmarkId = undefined
    inlineEditListeners.forEach((listener) => listener(null))
  }
  const requestInlineEdit = (kind: 'link' | 'image', key?: string, focus = true) => {
    if (destroyed || !inlineEditListeners.size) return false
    const bookmark = session.selection?.capture(key)
    if (!bookmark) return false
    inlineBookmarkId = bookmark.id
    inlineEditListeners.forEach((listener) => listener({ kind, bookmark, focus }))
    return true
  }
  const session = createRuntime(container, {
    ...options,
    // Validate user settings on the mounted session so an old/unsupported
    // shortcut cannot make the entire document fail to open.
    keybindingConfiguration: undefined,
    linkOpenMode: 'button',
    onEditInline: ({ kind, key, focus }) => requestInlineEdit(kind, key, focus),
  })
  let applyingHostMarkdown = false
  let currentMarkdown = options.markdown ?? ''
  let markdownSnapshotDirty = false
  // The runtime starts at revision zero. A composition boundary can be the
  // first notification without changing the committed document.
  let documentRevision = 0
  let currentUiState: CapricornUiState
  let destroyed = false
  const uiStateListeners = new Set<(state: CapricornUiState) => void>()
  let unsubscribe: (() => void) | undefined
  let unsubscribeUiState: (() => void) | undefined
  const getStatistics = session.getStatistics
  const updateSettings = (settings: Partial<CapricornEditorSettings>) => {
    const { keybindingConfiguration, ...otherSettings } = settings
    const validation =
      keybindingConfiguration && session.keybindings?.validateConfiguration(keybindingConfiguration)
    if (validation && !validation.ok) {
      options.onError?.(
        new Error(validation.diagnostics.map((diagnostic) => diagnostic.message).join('; ')),
      )
      if (Object.keys(otherSettings).length) session.updateSettings(otherSettings)
    } else {
      session.updateSettings(settings)
    }
  }
  const destroySession = () => {
    if (destroyed) return
    destroyed = true
    session.selection?.release()
    inlineEditListeners.clear()
    uiStateListeners.clear()
    // A broken unsubscribe must not prevent the remaining resources from
    // being released, including during partial initialization.
    try {
      unsubscribe?.()
    } finally {
      try {
        unsubscribeUiState?.()
      } finally {
        session.destroy()
      }
    }
  }

  try {
    if (options.keybindingConfiguration)
      updateSettings({ keybindingConfiguration: options.keybindingConfiguration })
    currentUiState = session.getUiState()
    unsubscribe = session.subscribeDocumentChange
      ? session.subscribeDocumentChange((event) => {
          invalidateInlineEdit()
          if (destroyed) return
          const documentChanged = documentRevision !== event.revision
          documentRevision = event.revision
          // setMarkdown publishes its replacement revision synchronously. Keep
          // that baseline even though the host-owned notification itself must
          // not be echoed back as a local edit. Otherwise the next composition
          // boundary at the same revision looks dirty.
          if (applyingHostMarkdown) return
          markdownSnapshotDirty ||= documentChanged
          onChange({
            ...(event.composing === undefined ? {} : { composing: event.composing }),
            documentChanged,
            pending: event.pending,
          })
        })
      : session.subscribe((event) => {
          invalidateInlineEdit()
          if (event.type !== 'change' || applyingHostMarkdown || destroyed) return
          currentMarkdown = event.markdown
          markdownSnapshotDirty = false
          onChange()
        })
    unsubscribeUiState = session.subscribeUiState((state) => {
      if (destroyed) return
      currentUiState = state
      uiStateListeners.forEach((listener) => listener(state))
    })
  } catch (error) {
    try {
      destroySession()
    } catch {
      // Preserve the initialization error for the host's Source Code fallback.
    }
    throw error
  }

  return {
    selection: session.selection,
    requestInlineEdit,
    subscribeInlineEdit(listener) {
      inlineEditListeners.add(listener)
      return () => {
        inlineEditListeners.delete(listener)
      }
    },
    commands: session.commands,
    find: session.find,
    headings: session.headings,
    getActiveHeadingId(headings, scrollEl) {
      return destroyed ? null : getCapricornActiveHeadingId(session, container, headings, scrollEl)
    },
    destroy: destroySession,
    export(format) {
      return session.export(format)
    },
    focus() {
      if (!destroyed) session.focus()
    },
    getMarkdown() {
      if (destroyed || !markdownSnapshotDirty) return currentMarkdown
      currentMarkdown = session.getMarkdown()
      markdownSnapshotDirty = false
      return currentMarkdown
    },
    ...(getStatistics
      ? {
          getStatistics(requestOptions?: { signal?: AbortSignal }) {
            requestOptions?.signal?.throwIfAborted()
            if (destroyed) {
              return Promise.reject(new DOMException('Editor is not active.', 'AbortError'))
            }
            return getStatistics.call(session, requestOptions)
          },
        }
      : {}),
    isComposing() {
      return !destroyed && (session.isComposing?.() ?? false)
    },
    getUiState() {
      return currentUiState
    },
    async requestImageInsert() {
      if (session.selection && requestInlineEdit('image')) return true
      try {
        const result = await options.imageInsertHandler?.()
        if (!result || destroyed) return false
        session.commands.insertImage(typeof result === 'string' ? { src: result } : result)
        return true
      } catch (error) {
        options.onError?.(error)
        return false
      }
    },
    setMarkdown(markdown) {
      if (destroyed || (!markdownSnapshotDirty && currentMarkdown === markdown)) return
      currentMarkdown = markdown
      markdownSnapshotDirty = false
      applyingHostMarkdown = true
      try {
        session.setMarkdown(markdown)
      } finally {
        applyingHostMarkdown = false
        invalidateInlineEdit()
      }
    },
    updateSettings(settings) {
      if (!destroyed) updateSettings(settings)
    },
    subscribeUiState(listener) {
      if (destroyed) return () => undefined
      uiStateListeners.add(listener)
      return () => uiStateListeners.delete(listener)
    },
    waitForResources() {
      return destroyed ? Promise.resolve() : session.waitForResources()
    },
  }
}

export async function createCapricornRuntimeAdapterAsync({
  container,
  createRuntime,
  onChange,
  options,
}: {
  container: HTMLElement
  createRuntime: CapricornRuntimeAsyncFactory
  onChange: (event?: CapricornEditorChangeEvent) => void
  options: CapricornRuntimeAsyncOptions
}): Promise<CapricornRuntimeAdapter> {
  options.signal?.throwIfAborted()
  const inlineEditBridge: { current?: CapricornRuntimeAdapter } = {}
  const session = await createRuntime(container, {
    ...options,
    keybindingConfiguration: undefined,
    linkOpenMode: 'button',
    onEditInline: ({ kind, key, focus }) =>
      inlineEditBridge.current?.requestInlineEdit?.(kind, key, focus),
  })
  if (options.signal?.aborted) {
    session.destroy()
    options.signal.throwIfAborted()
  }
  // Reuse the same ownership, revision, subscription and snapshot semantics;
  // only session creation differs between the two paths.
  const adapter = createCapricornRuntimeAdapter({
    container,
    createRuntime: () => session,
    onChange,
    options,
  })
  inlineEditBridge.current = adapter
  return adapter
}

let loadedRuntimeFactory: CapricornRuntimeFactory | undefined
let loadedRuntimeAsyncFactory: CapricornRuntimeAsyncFactory | undefined
let prewarmRuntime: (() => void | Promise<void>) | undefined
let prewarmRuntimePromise: Promise<void> | undefined
let runtimeFactoryPromise: Promise<CapricornRuntimeFactory> | undefined

export function getLoadedCapricornRuntimeFactory(): CapricornRuntimeFactory | undefined {
  return loadedRuntimeFactory
}

export function loadCapricornRuntimeFactory(): Promise<CapricornRuntimeFactory> {
  if (!isCapricornRuntimeAvailable) {
    return Promise.reject(new Error('The Capricorn runtime is not installed or is invalid.'))
  }

  if (!runtimeFactoryPromise) {
    runtimeFactoryPromise = import('virtual:markflowy-capricorn-runtime')
      .then((runtimeModule) => {
        if (typeof runtimeModule.createCapricornRuntime !== 'function') {
          throw new TypeError('The Capricorn package does not expose createCapricornRuntime.')
        }

        loadedRuntimeFactory = runtimeModule.createCapricornRuntime as CapricornRuntimeFactory
        loadedRuntimeAsyncFactory =
          'createCapricornRuntimeAsync' in runtimeModule &&
          typeof runtimeModule.createCapricornRuntimeAsync === 'function'
            ? (runtimeModule.createCapricornRuntimeAsync as CapricornRuntimeAsyncFactory)
            : undefined
        prewarmRuntime =
          'prewarmCapricornRuntime' in runtimeModule &&
          typeof runtimeModule.prewarmCapricornRuntime === 'function'
            ? (runtimeModule.prewarmCapricornRuntime as () => void | Promise<void>)
            : undefined
        return loadedRuntimeFactory
      })
      .catch((error: unknown) => {
        runtimeFactoryPromise = undefined
        throw error
      })
  }

  return runtimeFactoryPromise
}

export async function loadCapricornRuntimeAsyncFactory(): Promise<CapricornRuntimeAsyncFactory> {
  await loadCapricornRuntimeFactory()
  if (!loadedRuntimeAsyncFactory) {
    throw new Error(
      'This Capricorn runtime does not support background document preparation. Upgrade the private runtime to open large Markdown files in WYSIWYG mode.',
    )
  }
  return loadedRuntimeAsyncFactory
}

export async function preloadCapricornRuntimeFactory(): Promise<void> {
  // Guard here as well as at startup so future callers cannot accidentally
  // preload the unavailable-package stub or turn an optional module into a dependency.
  if (!isCapricornRuntimeAvailable) return

  try {
    await loadCapricornRuntimeFactory()
    // The runtime owns one bounded idle Worker. This only discovers the
    // optional capability; old packages still preload their synchronous entry.
    if (prewarmRuntime && !prewarmRuntimePromise) {
      prewarmRuntimePromise = Promise.resolve()
        .then(() => prewarmRuntime?.())
        .then(() => undefined)
        .catch(() => undefined)
    }
    const pendingPrewarm = prewarmRuntimePromise
    try {
      await pendingPrewarm
    } finally {
      // Share only concurrent handshakes. The runtime may park its idle Worker,
      // so a later preload must be allowed to request a fresh readiness check.
      if (prewarmRuntimePromise === pendingPrewarm) prewarmRuntimePromise = undefined
    }
  } catch {
    // Preloading is best effort. An actual editor mount owns error reporting
    // and the Source Code fallback, and may retry a failed module request.
  }
}
