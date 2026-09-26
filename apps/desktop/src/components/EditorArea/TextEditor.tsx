import { SemanticThemeContext } from '@/themes/context'
import { useSnippetLibrary } from '@/features/snippets/store'
import { getVisibleSnippets } from '@/features/snippets/builtins'
import type { CapricornSnippetKind } from '@/features/snippets/types'
import { markStartupInteractive } from '@/startup/interactive'
import { observeStartupEditable } from '@/startup/observeEditable'
import { takeStartupDocumentRead } from '@/startup/prepareEditor'
import { recordStartupEditor } from '@/startup/performance'
import {
  observeHistoryFile,
  endHistoryBatch,
  protectLocalEdit,
  historyFileSaved,
  isHistoryAutosavePaused,
  releaseClosedFileContent,
} from '@/services/local-history'
import { bindEditorResume, bindSourceEditorResume } from './editorResume'
import { editorAutomationRegistry, type EditorAutomationHandle } from './editorAutomationRegistry'
import { exportHtmlDocument } from './exportHtmlDocument'
import { setSourceCodeEditor } from './sourceCodeEditorRegistry'
import { reportEditorSearchLoadFailure, useEditorSearchStore } from './editorSearchStore'
import { commandRegistry } from '@/commands'
import { capricornClipboard, handleCapricornClipboardResult } from './capricornClipboard'
import { AppEditorThemeProvider } from '@/AppThemeProvider'
import { EVENT } from '@/constants'
import {
  EditorViewType,
  isCapricornView as isCapricornEditorView,
  type EditorViewTypeValue,
} from '@/constants/editorViewType'
import { capricornRuntimeEntrySha256, capricornRuntimeVersion } from '@/constants/capricornRuntime'
import { clipboardRead } from '@/helper/clipboard'
import { createShortcutMatcher } from '@/helper/bindkeys'
import { countNonWhitespaceCharacters } from '@/helper/editorCounter'
import bus from '@/helper/eventBus'
import useFileCacheStore, {
  deleteFileObject,
  delSaveOpenedEditorEntries,
  getFileIdsByPathIdentity,
  getFileObject,
  getFileObjectByPath,
  getFileObjects,
  setSaveOpenedEditorEntries,
  updateFileObject,
} from '@/helper/files'
import {
  canvasDataToBinary,
  FileResultCode,
  FileSysResult,
  getFileNameFromPath,
  getFolderPathFromPath,
  updateFile,
  type IFile,
} from '@/helper/filesys'
import { isSupportedMode, type FileTypeConfig } from '@/helper/fileTypeHandler'
import { getExportableImageSrc } from '@/helper/image'
import { logger } from '@/helper/logger'
import {
  comparePathRelation,
  findPathCollisions,
  memoizePathRelationResolver,
  type PathRelationResolver,
} from '@/helper/physicalPathIdentity'
import { useEditorKeybindingStore } from '@/hooks/useKeyboard'
import {
  capricornClipboardCommands,
  createCapricornKeybindingConfiguration,
} from './capricornKeybindings'
import { normalizeClonedExportColors } from './exportColors'
import { i18n, useTranslation } from '@/i18n'
import { captureException } from '@/services/error-reporting'
import { useEditorStateStore, useEditorStore } from '@/stores'
import useRecentFilesStore from '@/stores/useRecentFilesStore'
import useAppSettingStore from '@/stores/useAppSettingStore'
import useEditorCounterStore from '@/stores/useEditorCounterStore'
import useEditorViewTypeStore from '@/stores/useEditorViewTypeStore'
import useExternalFileChangeStore, {
  isExternalFileSaveBlocked,
} from '@/stores/useExternalFileChangeStore'
import useThemeStore from '@/stores/useThemeStore'
import { invoke } from '@tauri-apps/api/core'
import { save } from '@tauri-apps/plugin-dialog'
import classNames from 'classnames'
import { debounce, DebouncedFunc, throttle } from 'lodash'
import {
  memo,
  lazy,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useContext,
  useSyncExternalStore,
} from 'react'
import { flushSync } from 'react-dom'
import { PreviewBoundary } from './preview/PreviewBoundary'
import { useUnmount } from 'react-use'
import type {
  CreateWysiwygDelegateOptions,
  EditorDelegate,
  EditorChangeEventParams,
  EditorChangeHandler,
  EditorContext,
  EditorRef,
  MfCodemirrorView,
  EditorProps as MfEditorProps,
} from 'rme'
import { AsyncSurface } from '@/components/AsyncSurface'
import { RmeThemeProvider } from './RmeThemeProvider'
import { useRmeRuntime } from './useRmeRuntime'
import type { RmeRuntime } from './rmeRuntime'
import { toast } from 'zens'
import {
  createWysiwygDelegateOptions,
  getCurrentEditorInsertDateFormat,
  normalizeLivePreviewBlockBehavior,
} from './createWysiwygDelegateOptions'
import { closeCleanPhysicalAliases } from './closeCleanPhysicalAliases'
import { createDeferredLatestPublisher } from './deferredLatestPublisher'
import { getEditorSnapshotTiming } from './editorSnapshotTiming'
import { editorSnapshotRegistry } from './editorSnapshotRegistry'
import {
  beginEditorOpenMeasurement,
  finishEditorOpenMeasurement,
  getEditorOpenMeasurement,
  measureEditorSnapshot,
  observeEditorFirstPaint,
  recordEditorInteractionMeasurement,
  recordEditorOpenContent,
  recordEditorOpenStage,
  shouldCoalesceEditorSnapshots,
  startEditorInteractionMeasurement,
} from './editorPerformanceDiagnostics'
import { EditorWrapper } from './EditorWrapper'
import {
  CapricornEditor,
  type CapricornEditorHandle,
  type CapricornRuntimeRequestIdentity,
} from './CapricornEditor'
import {
  CAPRICORN_DESKTOP_VIRTUALIZE_OPTIONS,
  type CapricornEditorChangeEvent,
  type CapricornLocalizationAdapter,
  type CapricornRuntimeAdapter,
  type CapricornRuntimeOptions,
  type CapricornRuntimeProgress,
} from './capricornRuntimeAdapter'
import { createCapricornStatisticsScheduler } from './capricornStatisticsScheduler'
import { setCapricornEditor } from './capricornEditorRegistry'
import { openEditorLink } from './openEditorLink'
import { conditionalWriteExpectedIfAllowed, getFileWriteRevision } from './conditionalFileWrite'
import { EditorInstanceLifecycle } from './editorInstanceLifecycle'
import {
  EXTERNAL_FILE_CONTENT_SYNC_EVENT,
  type ExternalFileContentSyncPayload,
  markExternalFileConflict,
  releaseExternalFileChange,
} from './externalFileChanges'
import { fileSaveCoordinator } from './fileSaveCoordinator'
import { readStableFileSnapshot } from './fileSnapshot'
import { InstanceResourceRegistry, type ResourceRemoval } from './instanceResourceRegistry'
import { runReservedSaveAs, type SaveAsCollisionSet } from './runReservedSaveAs'
import { runQueuedFileWrite } from './runQueuedFileWrite'
import { runSaveOperation } from './runSaveOperation'
import { getSaveAsCollisionIds } from './saveAsCollision'
import { savePathCoordinator } from './savePathCoordinator'
import { useDebouncedAutosave } from './useDebouncedAutosave'
import { PdfPrintController } from './pdf-print/PdfPrintController'
import { PandocExportController } from './pandoc-export/PandocExportController'
import { WarningHeader } from './styles'

const delegateOptionsCache = new Map<string, CreateWysiwygDelegateOptions>()
const TEXT_EDITOR_CONTENT_SYNC_EVENT = 'editor_content_sync'
const EXPORT_RESOURCE_TIMEOUT_MS = 15_000
const editorInstanceLifecycle = new EditorInstanceLifecycle()
let textEditorInstanceSeq = 0
type Html2Canvas = (typeof import('html2canvas'))['default']
let html2canvasPromise: Promise<Html2Canvas> | undefined

const capricornLocalization: CapricornLocalizationAdapter = {
  getDirection: () => (i18n.dir() === 'rtl' ? 'rtl' : 'ltr'),
  getLocale: () => i18n.resolvedLanguage || i18n.language || 'en',
  subscribe(listener) {
    i18n.on('languageChanged', listener)
    return () => i18n.off('languageChanged', listener)
  },
  translate: ({ defaultValue, key, values }) =>
    i18n.t(`capricorn.${key}`, { defaultValue, ...values }),
}

interface TextEditorContentSyncPayload {
  fileId: string
  sourceInstanceId: string
  content: string
}

interface PendingRmeEditorSnapshot {
  delegate: EditorDelegate
  doc: EditorChangeEventParams['state']['doc']
  kind: 'rme'
  mode: 'coalesced' | 'immediate'
}

interface PendingCapricornEditorSnapshot {
  documentSize: number
  getMarkdown: () => string
  kind: 'capricorn'
  mode: 'coalesced'
}

type PendingEditorSnapshot = PendingCapricornEditorSnapshot | PendingRmeEditorSnapshot

type TextEditorRef = EditorRef & {
  waitForPendingResources: () => Promise<void>
}

async function waitForEditorResourcesForExport(editor: TextEditorRef | null): Promise<void> {
  const pendingResources = editor?.waitForPendingResources()
  if (!pendingResources) {
    return
  }

  let timeoutHandle: number | undefined
  const timeout = new Promise<never>((_, reject) => {
    timeoutHandle = window.setTimeout(() => {
      reject(new Error('Timed out waiting for Preview images'))
    }, EXPORT_RESOURCE_TIMEOUT_MS)
  })

  try {
    await Promise.race([pendingResources, timeout])
  } finally {
    if (timeoutHandle !== undefined) {
      window.clearTimeout(timeoutHandle)
    }
  }
}

function collectTreeFiles(files: IFile[]): IFile[] {
  return files.flatMap((file) => [file, ...collectTreeFiles(file.children ?? [])])
}

function getPhysicalIdentityCandidates(path: string): { files: IFile[]; signature: string } {
  const editorStore = useEditorStore.getState()
  const identitySensitiveIds = new Set(editorStore.opened)
  useEditorStateStore.getState().idStateMap.forEach((state, fileId) => {
    if (state.hasUnsavedChanges) identitySensitiveIds.add(fileId)
  })
  const targetNameKey = getFileNameFromPath(path).normalize('NFC').toLocaleLowerCase('en-US')
  const files = [...getFileObjects(), ...collectTreeFiles(editorStore.folderData ?? [])].filter(
    (file) => {
      if (identitySensitiveIds.has(file.id)) return true
      if (!file.path) return false

      // Case/Unicode aliases share a filename key, while the backend identity
      // check remains the final authority and avoids false positives on a
      // case-sensitive POSIX volume.
      return (
        getFileNameFromPath(file.path).normalize('NFC').toLocaleLowerCase('en-US') === targetNameKey
      )
    },
  )

  const signature = Array.from(
    new Map(files.map((file) => [file.id, `${file.id}\0${file.path ?? ''}`])).values(),
  )
    .sort()
    .join('\0')
  return { files, signature }
}

function collectSaveAsReplaceIds(path: string, sourceId: string): string[] {
  const editorStore = useEditorStore.getState()
  return getSaveAsCollisionIds({
    cachedTargetId: getFileObjectByPath(path)?.id,
    pathTargetIds: getFileIdsByPathIdentity(path),
    sourceId,
    treeTargetId: editorStore.getFileNodeByPath(path)?.id,
  })
}

async function collectSaveAsCollisions(
  path: string,
  sourceId: string,
  comparePaths: PathRelationResolver,
): Promise<SaveAsCollisionSet> {
  let physicalCollisions: Awaited<ReturnType<typeof findPathCollisions>>

  while (true) {
    const candidates = getPhysicalIdentityCandidates(path)
    physicalCollisions = await findPathCollisions(path, candidates.files, comparePaths)
    if (getPhysicalIdentityCandidates(path).signature === candidates.signature) break
  }

  const replaceIds = Array.from(
    new Set([
      ...collectSaveAsReplaceIds(path, sourceId),
      ...physicalCollisions.replaceFiles.map((file) => file.id),
    ]),
  )
  return {
    protectedIds: Array.from(
      new Set([...replaceIds, ...physicalCollisions.protectedFiles.map((file) => file.id)]),
    ),
    replaceIds,
  }
}

function setTextEditorSaveHandler(
  fileId: string,
  instanceId: string,
  saveHandler: () => Promise<boolean>,
  shouldPromote: boolean,
) {
  const registration = textEditorSaveHandlerRegistry.register(fileId, instanceId, saveHandler)
  const current = shouldPromote
    ? textEditorSaveHandlerRegistry.promote(fileId, instanceId)
    : registration.currentChanged
      ? registration.current
      : undefined

  if (current) setSaveOpenedEditorEntries(fileId, current)
}

function deleteTextEditorSaveHandler(fileId: string, instanceId: string) {
  const removal = textEditorSaveHandlerRegistry.remove(fileId, instanceId)
  if (!removal.currentChanged) return

  if (removal.current) setSaveOpenedEditorEntries(fileId, removal.current)
  else delSaveOpenedEditorEntries(fileId)
}

const requestIdle = (callback: () => void): number => {
  if ('requestIdleCallback' in window) {
    return window.requestIdleCallback(callback, { timeout: 1000 }) as unknown as number
  }
  return setTimeout(callback, 0) as unknown as number
}

const cancelIdle = (handle: number) => {
  if ('cancelIdleCallback' in window) {
    window.cancelIdleCallback(handle)
    return
  }
  clearTimeout(handle)
}

function getOrCreateDelegateOptions(fileId?: string): CreateWysiwygDelegateOptions {
  const key = fileId || '__no_id__'
  let cached = delegateOptionsCache.get(key)
  if (!cached) {
    cached = createWysiwygDelegateOptions(fileId)
    delegateOptionsCache.set(key, cached)
  }
  return cached
}

type SaveHandlerParams = {
  /**
   * when active is true, saveHandler will save the file content to disk.
   * when active is false, saveHandler will save when editor is active.
   */
  active?: boolean
  autosave?: boolean
  expectedContent?: string
  onSuccess?: () => void
  onFinally?: () => void
}

enum TextEditorStatus {
  LOADING,
  SUCCESS,
  NOTEXIST,
  READERROR,
  BINARY,
}

export { sourceCodeCodemirrorViewMap } from './sourceCodeEditorRegistry'

const editorDelegateRegistry = new InstanceResourceRegistry<EditorDelegate<any>>()
const editorContextRegistry = new InstanceResourceRegistry<EditorContext>()
const capricornEditorInstanceRegistry = new InstanceResourceRegistry<CapricornRuntimeAdapter>()
const sourceCodeViewRegistry = new InstanceResourceRegistry<MfCodemirrorView>()
const textEditorSaveHandlerRegistry = new InstanceResourceRegistry<() => Promise<boolean>>()

function registerCompatibilityResource<T>(
  registry: InstanceResourceRegistry<T>,
  fileId: string,
  instanceId: string,
  resource: T,
  shouldPromote: boolean,
  setCurrent: (current: T) => void,
) {
  const registration = registry.register(fileId, instanceId, resource)
  const current = shouldPromote
    ? registry.promote(fileId, instanceId)
    : registration.currentChanged
      ? registration.current
      : undefined

  if (current !== undefined) {
    setCurrent(current)
  }
}

function registerEditorDelegateResource(
  fileId: string,
  instanceId: string,
  delegate: EditorDelegate<any>,
  shouldPromote: boolean,
) {
  registerCompatibilityResource(
    editorDelegateRegistry,
    fileId,
    instanceId,
    delegate,
    shouldPromote,
    (current) => useEditorStore.getState().setEditorDelegate(fileId, current),
  )
}

function updateRmeKeybindings(
  context: EditorContext,
  keymap: Record<string, string | readonly string[]>,
) {
  for (const extension of context.manager.extensions) {
    if (extension.name === 'keyboardSettings') {
      const options = { shortcuts: keymap, createShortcutMatcher }
      extension.setOptions(options)
    }
    if (extension.name === 'codeMirror') {
      const options = {
        commandKeymapOptions: {
          createShortcutMatcher,
          disableAllBuildInShortcuts: true,
          overrideShortcutMap: keymap,
          clipboardReadFunction: clipboardRead,
          currentDateFormat: getCurrentEditorInsertDateFormat,
        },
      }
      extension.setOptions(options)
    }
  }
}

function registerEditorContextResource(
  fileId: string,
  instanceId: string,
  context: EditorContext,
  shouldPromote: boolean,
) {
  const keyboardState = useEditorKeybindingStore.getState()
  if (keyboardState.editorKeybindingsLoaded)
    updateRmeKeybindings(context, keyboardState.editorKeybingMap)
  registerCompatibilityResource(
    editorContextRegistry,
    fileId,
    instanceId,
    context,
    shouldPromote,
    (current) => useEditorStore.getState().setEditorCtx(fileId, current),
  )
}

function registerSourceCodeViewResource(
  fileId: string,
  instanceId: string,
  view: MfCodemirrorView,
  shouldPromote: boolean,
) {
  registerCompatibilityResource(
    sourceCodeViewRegistry,
    fileId,
    instanceId,
    view,
    shouldPromote,
    (current) => setSourceCodeEditor(fileId, current),
  )
}

function registerCapricornEditorResource(
  fileId: string,
  instanceId: string,
  editor: CapricornRuntimeAdapter,
  shouldPromote: boolean,
) {
  registerCompatibilityResource(
    capricornEditorInstanceRegistry,
    fileId,
    instanceId,
    editor,
    shouldPromote,
    (current) => setCapricornEditor(fileId, current),
  )
}

function promoteEditorInstanceResources(fileId: string, instanceId: string) {
  const store = useEditorStore.getState()
  const delegate = editorDelegateRegistry.promote(fileId, instanceId)
  const context = editorContextRegistry.promote(fileId, instanceId)
  const sourceCodeView = sourceCodeViewRegistry.promote(fileId, instanceId)
  const capricornEditor = capricornEditorInstanceRegistry.promote(fileId, instanceId)

  if (delegate === undefined) store.clearEditorDelegate(fileId)
  else store.setEditorDelegate(fileId, delegate)

  if (context === undefined) store.clearEditorCtx(fileId)
  else store.setEditorCtx(fileId, context)

  if (sourceCodeView === undefined) setSourceCodeEditor(fileId, undefined)
  else setSourceCodeEditor(fileId, sourceCodeView)

  setCapricornEditor(fileId, capricornEditor)

  const saveHandler = textEditorSaveHandlerRegistry.promote(fileId, instanceId)
  if (saveHandler === undefined) delSaveOpenedEditorEntries(fileId)
  else setSaveOpenedEditorEntries(fileId, saveHandler)
}

function syncResourceRemoval<T>(
  removal: ResourceRemoval<T>,
  setCurrent: (current: T) => void,
  clearCurrent: () => void,
) {
  if (!removal.currentChanged) return

  if (removal.current === undefined) {
    clearCurrent()
  } else {
    setCurrent(removal.current)
  }
}

function unregisterSourceCodeViewResource(fileId: string, instanceId: string) {
  const removal = sourceCodeViewRegistry.remove(fileId, instanceId)
  syncResourceRemoval(
    removal,
    (current) => setSourceCodeEditor(fileId, current),
    () => setSourceCodeEditor(fileId, undefined),
  )
}

function unregisterCapricornEditorResource(fileId: string, instanceId: string) {
  const removal = capricornEditorInstanceRegistry.remove(fileId, instanceId)
  syncResourceRemoval(
    removal,
    (current) => setCapricornEditor(fileId, current),
    () => setCapricornEditor(fileId, undefined),
  )
}

function clearSwitchingEditorContextResource(fileId: string, instanceId: string) {
  const switchingContext = editorContextRegistry.get(fileId, instanceId)
  const store = useEditorStore.getState()

  if (switchingContext && store.getEditorCtx(fileId) === switchingContext) {
    store.clearEditorCtx(fileId)
  }
}

function unregisterRmeEditorResources(fileId: string, instanceId: string) {
  const delegateRemoval = editorDelegateRegistry.remove(fileId, instanceId)
  const contextRemoval = editorContextRegistry.remove(fileId, instanceId)
  const store = useEditorStore.getState()

  syncResourceRemoval(
    delegateRemoval,
    (current) => store.setEditorDelegate(fileId, current),
    () => store.clearEditorDelegate(fileId),
  )
  syncResourceRemoval(
    contextRemoval,
    (current) => store.setEditorCtx(fileId, current),
    () => store.clearEditorCtx(fileId),
  )
}

function unregisterEditorInstanceResources(fileId: string, instanceId: string) {
  const delegateRemoval = editorDelegateRegistry.remove(fileId, instanceId)
  const contextRemoval = editorContextRegistry.remove(fileId, instanceId)
  const sourceCodeViewRemoval = sourceCodeViewRegistry.remove(fileId, instanceId)
  const capricornEditorRemoval = capricornEditorInstanceRegistry.remove(fileId, instanceId)

  const store = useEditorStore.getState()
  syncResourceRemoval(
    delegateRemoval,
    (current) => store.setEditorDelegate(fileId, current),
    () => store.clearEditorDelegate(fileId),
  )
  syncResourceRemoval(
    contextRemoval,
    (current) => store.setEditorCtx(fileId, current),
    () => store.clearEditorCtx(fileId),
  )
  syncResourceRemoval(
    sourceCodeViewRemoval,
    (current) => setSourceCodeEditor(fileId, current),
    () => setSourceCodeEditor(fileId, undefined),
  )
  syncResourceRemoval(
    capricornEditorRemoval,
    (current) => setCapricornEditor(fileId, current),
    () => setCapricornEditor(fileId, undefined),
  )
}

async function waitForImageLoad(img: HTMLImageElement, src: string) {
  await new Promise<void>((resolve) => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      img.removeEventListener('load', finish)
      img.removeEventListener('error', finish)
      resolve()
    }
    const timer = window.setTimeout(finish, 5000)

    img.addEventListener('load', finish, { once: true })
    img.addEventListener('error', finish, { once: true })
    img.src = src

    if (img.decode) {
      img
        .decode()
        .then(finish)
        .catch(() => {
          if (img.complete) {
            finish()
          }
        })
    } else if (img.complete) {
      finish()
    }
  })
}

const CSS_IMAGE_URL_REG = /url\(\s*(['"]?)(.*?)\1\s*\)/g
const XLINK_NS = 'http://www.w3.org/1999/xlink'
const RISKY_EXPORT_TAG_NAMES = new Set([
  'canvas',
  'embed',
  'iframe',
  'img',
  'object',
  'picture',
  'source',
  'svg',
  'video',
])

const getTransparentImageSrc = (element?: Element): string => {
  const rect = element?.getBoundingClientRect()
  const width = Math.max(1, Math.round(rect?.width || 1))
  const height = Math.max(1, Math.round(rect?.height || 1))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas.toDataURL('image/png')
}

const isCanvasSafeImageSrc = (src: string) => /^data:image\/(?:png|jpe?g|gif|webp|bmp);/i.test(src)

async function getCanvasSafeImageSrc(
  src: string,
  fileFolderPath?: string,
  renderedSrc?: string,
  fallbackElement?: Element,
) {
  const exportSrc = await getExportableImageSrc(src, fileFolderPath, renderedSrc)
  return isCanvasSafeImageSrc(exportSrc) ? exportSrc : getTransparentImageSrc(fallbackElement)
}

async function replaceCssImageUrls(
  value: string,
  fileFolderPath?: string,
  fallbackElement?: Element,
) {
  const matches = Array.from(value.matchAll(CSS_IMAGE_URL_REG))
  if (!matches.length) {
    return value
  }

  let nextValue = ''
  let lastIndex = 0

  for (const match of matches) {
    const matchIndex = match.index ?? 0
    const matchedText = match[0]
    const rawUrl = match[2]
    const exportSrc = await getCanvasSafeImageSrc(
      rawUrl,
      fileFolderPath,
      undefined,
      fallbackElement,
    )

    nextValue += value.slice(lastIndex, matchIndex)
    nextValue += `url("${exportSrc.replace(/"/g, '\\"')}")`
    lastIndex = matchIndex + matchedText.length
  }

  nextValue += value.slice(lastIndex)
  return nextValue
}

async function prepareImagesForExport(root: HTMLElement, fileFolderPath?: string) {
  const restoreFns: (() => void)[] = []
  const images = Array.from(root.querySelectorAll('img'))

  await Promise.all(
    images.map(async (img) => {
      const originalSrc =
        img.getAttribute('data-rme-original-src') || img.getAttribute('src') || img.currentSrc || ''
      const renderedSrc = img.currentSrc || img.src
      const exportSrc = await getCanvasSafeImageSrc(originalSrc, fileFolderPath, renderedSrc, img)

      if (exportSrc === renderedSrc) {
        return
      }

      const previousSrc = img.getAttribute('src')
      const previousSrcset = img.getAttribute('srcset')

      restoreFns.push(() => {
        if (previousSrc === null) {
          img.removeAttribute('src')
        } else {
          img.setAttribute('src', previousSrc)
        }

        if (previousSrcset === null) {
          img.removeAttribute('srcset')
        } else {
          img.setAttribute('srcset', previousSrcset)
        }
      })

      img.removeAttribute('srcset')
      await waitForImageLoad(img, exportSrc)
    }),
  )

  return () => {
    restoreFns.reverse().forEach((restore) => restore())
  }
}

async function prepareCssImagesForExport(root: HTMLElement, fileFolderPath?: string) {
  const restoreFns: (() => void)[] = []
  const cssImageProperties = [
    'background-image',
    'border-image-source',
    'list-style-image',
    'mask-image',
    '-webkit-mask-image',
  ]
  const elements = [root, ...Array.from(root.querySelectorAll('*'))]

  for (const element of elements) {
    if (!('style' in element)) {
      continue
    }

    const style = (element as HTMLElement | SVGElement).style
    const computedStyle = window.getComputedStyle(element)

    for (const property of cssImageProperties) {
      const value = computedStyle.getPropertyValue(property)
      if (!value || value === 'none' || !value.includes('url(')) {
        continue
      }

      const nextValue = await replaceCssImageUrls(value, fileFolderPath, element)
      if (nextValue === value) {
        continue
      }

      const previousValue = style.getPropertyValue(property)
      const previousPriority = style.getPropertyPriority(property)
      restoreFns.push(() => {
        if (previousValue) {
          style.setProperty(property, previousValue, previousPriority)
        } else {
          style.removeProperty(property)
        }
      })
      style.setProperty(property, nextValue)
    }
  }

  return () => {
    restoreFns.reverse().forEach((restore) => restore())
  }
}

async function prepareSvgImagesForExport(root: HTMLElement, fileFolderPath?: string) {
  const restoreFns: (() => void)[] = []
  const svgImages = Array.from(root.querySelectorAll('svg image'))

  await Promise.all(
    svgImages.map(async (image) => {
      const previousHref = image.getAttribute('href')
      const previousXlinkHref = image.getAttributeNS(XLINK_NS, 'href')
      const href = previousHref || previousXlinkHref || ''
      if (!href) {
        return
      }

      const exportSrc = await getCanvasSafeImageSrc(href, fileFolderPath, undefined, image)

      restoreFns.push(() => {
        if (previousHref === null) {
          image.removeAttribute('href')
        } else {
          image.setAttribute('href', previousHref)
        }

        if (previousXlinkHref === null) {
          image.removeAttributeNS(XLINK_NS, 'href')
        } else {
          image.setAttributeNS(XLINK_NS, 'href', previousXlinkHref)
        }
      })

      image.setAttribute('href', exportSrc)
      image.setAttributeNS(XLINK_NS, 'href', exportSrc)
    }),
  )

  return () => {
    restoreFns.reverse().forEach((restore) => restore())
  }
}

function prepareEmbeddedMediaForExport(root: HTMLElement) {
  const restoreFns: (() => void)[] = []
  const canvases = Array.from(root.querySelectorAll('canvas')) as HTMLCanvasElement[]
  const embeddedFrames = Array.from(root.querySelectorAll('iframe, video'))

  const hideElement = (element: HTMLElement) => {
    const previousVisibility = element.style.visibility
    restoreFns.push(() => {
      element.style.visibility = previousVisibility
    })
    element.style.visibility = 'hidden'
  }

  canvases.forEach((canvas) => {
    try {
      canvas.toDataURL('image/png')
    } catch (error) {
      hideElement(canvas)
    }
  })

  embeddedFrames.forEach((element) => {
    hideElement(element as HTMLElement)
  })

  return () => {
    restoreFns.reverse().forEach((restore) => restore())
  }
}

async function prepareResourcesForExport(root: HTMLElement, fileFolderPath?: string) {
  const restoreFns = [
    prepareEmbeddedMediaForExport(root),
    await prepareImagesForExport(root, fileFolderPath),
    await prepareSvgImagesForExport(root, fileFolderPath),
    await prepareCssImagesForExport(root, fileFolderPath),
  ]

  return () => {
    restoreFns.reverse().forEach((restore) => restore())
  }
}

function isSecurityError(error: unknown) {
  const errorText = String(error)
  return errorText.includes('SecurityError') || errorText.includes('operation is insecure')
}

function ignoreRiskyExportElement(element: Element) {
  return RISKY_EXPORT_TAG_NAMES.has(element.tagName.toLowerCase())
}

function sanitizeClonedExportDocument(clonedDocument: Document) {
  const style = clonedDocument.createElement('style')
  style.textContent = `
    *, *::before, *::after {
      background-image: none !important;
      border-image-source: none !important;
      list-style-image: none !important;
      mask-image: none !important;
      -webkit-mask-image: none !important;
    }

    canvas, embed, iframe, img, object, picture, source, svg, video {
      visibility: hidden !important;
    }
  `
  clonedDocument.head.appendChild(style)

  clonedDocument
    .querySelectorAll('canvas, embed, iframe, img, object, picture, source, svg, video')
    .forEach((element) => {
      element.setAttribute('data-html2canvas-ignore', 'true')
    })

  clonedDocument.querySelectorAll<HTMLElement>('*').forEach((element) => {
    element.style.backgroundImage = 'none'
    element.style.borderImageSource = 'none'
    element.style.listStyleImage = 'none'
    element.style.maskImage = 'none'
    element.style.setProperty('-webkit-mask-image', 'none')
  })
}

function canvasToExportDataUrl(canvas: HTMLCanvasElement) {
  return canvas.toDataURL('image/jpeg', 0.95)
}

async function loadHtml2Canvas() {
  html2canvasPromise ??= import('html2canvas')
    .then((module) => module.default)
    .catch((error) => {
      html2canvasPromise = undefined
      throw error
    })

  return html2canvasPromise
}

function renderTextFallbackImageDataUrl(element: HTMLElement) {
  const rect = element.getBoundingClientRect()
  const width = Math.max(320, Math.min(4096, Math.ceil(rect.width || element.scrollWidth || 800)))
  const height = Math.max(
    240,
    Math.min(12000, Math.ceil(element.scrollHeight || rect.height || 600)),
  )
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Failed to get canvas context')
  }

  const backgroundColor = window.getComputedStyle(element).backgroundColor || '#ffffff'
  ctx.fillStyle = backgroundColor === 'rgba(0, 0, 0, 0)' ? '#ffffff' : backgroundColor
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = window.getComputedStyle(element).color || '#111111'
  ctx.font = '14px sans-serif'
  ctx.textBaseline = 'top'

  const maxLineWidth = width - 48
  const words = (element.innerText || element.textContent || '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
  let line = ''
  let y = 24

  for (const word of words) {
    const nextLine = line ? `${line} ${word}` : word
    if (ctx.measureText(nextLine).width > maxLineWidth && line) {
      ctx.fillText(line, 24, y)
      y += 22
      line = word
      if (y > height - 24) break
    } else {
      line = nextLine
    }
  }

  if (line && y <= height - 24) {
    ctx.fillText(line, 24, y)
  }

  return canvasToExportDataUrl(canvas)
}

async function renderElementToImageDataUrl(element: HTMLElement, strict = false) {
  const html2canvas = await loadHtml2Canvas()
  const html2canvasOptions: Parameters<Html2Canvas>[1] = {
    allowTaint: false,
    foreignObjectRendering: false,
    imageTimeout: EXPORT_RESOURCE_TIMEOUT_MS,
    logging: false,
    useCORS: true,
    ignoreElements: (candidate: Element) => candidate.tagName.toLowerCase() === 'iframe',
    onclone: normalizeClonedExportColors,
  }

  try {
    const canvas = await html2canvas(element, html2canvasOptions)
    return canvasToExportDataUrl(canvas)
  } catch (error) {
    if (strict || !isSecurityError(error)) {
      throw error
    }
  }

  logger.warn('Canvas was tainted during image export, retrying without media resources.')

  try {
    const fallbackCanvas = await html2canvas(element, {
      ...html2canvasOptions,
      ignoreElements: ignoreRiskyExportElement,
      onclone: (clonedDocument, clonedElement) => {
        sanitizeClonedExportDocument(clonedDocument)
        normalizeClonedExportColors(clonedDocument, clonedElement)
      },
    })

    return canvasToExportDataUrl(fallbackCanvas)
  } catch (error) {
    if (!isSecurityError(error)) {
      throw error
    }
  }

  logger.warn('Canvas stayed tainted after media-free retry, falling back to text-only export.')
  return renderTextFallbackImageDataUrl(element)
}

const HtmlPreview = lazy(() => import('./preview/HtmlPreview'))

function TextEditor(props: TextEditorProps) {
  const { id, active, visible = active, fileTypeConfig, groupId, onLoadingChange } = props
  const isHtml = fileTypeConfig.type === 'html'
  const isCapricornView = useCallback(
    (mode: EditorViewTypeValue) => fileTypeConfig.type === 'markdown' && isCapricornEditorView(mode),
    [fileTypeConfig.type],
  )
  const cachedFile = getFileObject(id)
  const lastKnownFileRef = useRef<IFile | undefined>(cachedFile)
  if (cachedFile) {
    lastKnownFileRef.current = cachedFile
  }
  const curFile = cachedFile ?? lastKnownFileRef.current!
  const filePath = useFileCacheStore((state) => state.entries[id]?.path)
  const instanceIdRef = useRef<string | undefined>(undefined)
  if (!instanceIdRef.current) {
    textEditorInstanceSeq += 1
    instanceIdRef.current = `text-editor-${textEditorInstanceSeq}`
  }
  const editorWrapperRef = useRef<HTMLDivElement>(null)
  const automationHandleRef = useRef<EditorAutomationHandle | null>(null)
  const cliRuntimeErrorRef = useRef<string | undefined>(undefined)
  const [runtimePending, setRuntimePending] = useState(true)
  const [resumeSource, setResumeSource] = useState<MfCodemirrorView | null>(null)
  const [resumeCapricorn, setResumeCapricorn] = useState<CapricornRuntimeAdapter | null>(null)
  const activeRef = useRef(active)
  activeRef.current = active
  const visibleRef = useRef(visible)
  visibleRef.current = visible
  const getSavePathReservationSnapshot = useCallback(
    () => savePathCoordinator.isFileReserved(id, getFileObject(id)?.path),
    [id],
  )
  const savePathReserved = useSyncExternalStore(
    savePathCoordinator.subscribe,
    getSavePathReservationSnapshot,
    () => false,
  )
  const createDelegate = useCallback(
    (runtime: RmeRuntime, sourceCodeLanguage?: string) => {
      const currentSettingData = useAppSettingStore.getState().settingData
      return runtime.createSourceCodeDelegate({
        language: sourceCodeLanguage,
        disableAllBuildInShortcuts: true,
        overrideShortcutMap: useEditorKeybindingStore.getState().editorKeybingMap,
        clipboardReadFunction: clipboardRead,
        currentDateFormat: getCurrentEditorInsertDateFormat,
        onCodemirrorViewLoad: (cmView) => {
          setResumeSource(cmView)
          registerSourceCodeViewResource(id, instanceIdRef.current!, cmView, activeRef.current)
          if (activeRef.current && fileTypeConfig.type === 'markdown') {
            commandRegistry.execute('app:toc_refresh')
          }
        },
        typewriterScroll: {
          enabled: currentSettingData.editor_typewriter_scroll,
        },
      })
    },
    [id, fileTypeConfig.type],
  )
  const [status, setStatus] = useState(TextEditorStatus.LOADING)
  useEffect(() => {
    if (active && status !== TextEditorStatus.LOADING && status !== TextEditorStatus.SUCCESS) {
      reportEditorSearchLoadFailure(id, groupId)
    }
  }, [active, status, id, groupId])

  const insertNodeToFolderData = useEditorStore((state) => state.insertNodeToFolderData)
  const { t } = useTranslation()
  const autosave = useAppSettingStore((state) => state.settingData.autosave)
  const dirtyForAutosave = useEditorStateStore(
    (state) => state.idStateMap.get(id)?.hasUnsavedChanges,
  )
  const codeBlockLineWrapping = useAppSettingStore(
    (state) => state.settingData.wysiwyg_editor_codemirror_line_wrap ?? true,
  )
  const autosaveInterval = useAppSettingStore((state) => state.settingData.autosave_interval)
  const editorFullWidth = useAppSettingStore((state) => state.settingData.editor_full_width)
  const linkEditMode = useAppSettingStore((state) =>
    state.settingData.editor_link_edit_mode === 'markdown' ? 'markdown' : 'popover',
  )
  const editorPlaceholder = useAppSettingStore((state) => state.settingData.editor_placeholder)
  const semanticTheme = useContext(SemanticThemeContext)
  const editorRootFontSize = useAppSettingStore((state) => state.settingData.editor_root_font_size)
  const editorRootLineHeight = useAppSettingStore(
    (state) => state.settingData.editor_root_line_height,
  )
  const editorTypewriterScroll = useAppSettingStore(
    (state) => state.settingData.editor_typewriter_scroll,
  )
  const livePreviewBlockBehavior = useAppSettingStore((state) =>
    normalizeLivePreviewBlockBehavior(state.settingData.wysiwyg_editor_live_preview_block_behavior),
  )
  const sourceCodeEditorSpellcheck = useAppSettingStore(
    (state) => state.settingData.source_code_editor_spellcheck,
  )
  const wysiwygEditorSpellcheck = useAppSettingStore(
    (state) => state.settingData.wysiwyg_editor_spellcheck,
  )
  const editorColorScheme = useThemeStore((state) => state.curTheme.mode)
  const editorKeybingMap = useEditorKeybindingStore((state) => state.editorKeybingMap)
  const editorKeybindingsLoaded = useEditorKeybindingStore((state) => state.editorKeybindingsLoaded)
  const externalChangeState = useExternalFileChangeStore((state) => {
    const notice = state.notices[id]
    if (notice?.kind !== 'conflict') return 'none'
    return notice.resolving ?? 'pending'
  })
  const externalChangeResolving =
    externalChangeState === 'reload' || externalChangeState === 'overwrite'
  const [currentViewType, setCurrentViewType] = useState<EditorViewTypeValue>(() => {
    const selected = useEditorViewTypeStore.getState().editorViewTypeMap.get(id)
    return selected && isSupportedMode(fileTypeConfig, selected)
      ? selected
      : fileTypeConfig.defaultMode
  })
  const initialViewTypeRef = useRef(currentViewType)
  const sharedHtmlViewType = useEditorViewTypeStore((state) =>
    isHtml ? state.editorViewTypeMap.get(id) : undefined,
  )
  const currentViewTypeRef = useRef(currentViewType)
  currentViewTypeRef.current = currentViewType
  const needsRmeRuntime =
    !isCapricornView(currentViewType) &&
    (!isHtml || currentViewType === EditorViewType.SOURCECODE)
  const {
    runtime: rmeRuntime,
    error: rmeLoadError,
    retry: retryRmeRuntime,
  } = useRmeRuntime(needsRmeRuntime)
  const MfEditor = rmeRuntime?.Editor
  const [content, setContent] = useState<string | undefined>()
  const [delegate, setDelegate] = useState<ReturnType<typeof createDelegate> | null>(null)

  const debounceSaveHandlerCacheRef = useRef<DebouncedFunc<() => Promise<boolean>>>(null)
  const noFileSaveingRef = useRef(false)
  const editorRef = useRef<TextEditorRef>(null)
  const capricornEditorRef = useRef<CapricornEditorHandle>(null)
  const capricornRuntimeAdapterRef = useRef<CapricornRuntimeAdapter | null>(null)
  const stopFirstPaintObservationRef = useRef<(() => void) | undefined>(undefined)
  const editorInitializedRef = useRef(false)
  const editorContextRef = useRef<EditorChangeEventParams>(null)
  const counterIdleHandleRef = useRef<number | null>(null)
  const counterDocumentRef = useRef<EditorChangeEventParams['state']['doc'] | null>(null)
  const isApplyingRemoteContentRef = useRef(false)
  const needsMountedContentSyncRef = useRef(false)
  const latestContentRef = useRef<string | undefined>(undefined)
  const remoteContentResetHandleRef = useRef<number | null>(null)
  const rejectedReservedChangeRef = useRef(false)
  const wasSavePathReservedRef = useRef(false)
  const interactionStartedAtRef = useRef<number | undefined>(undefined)
  const interactionOpenRequestIdRef = useRef<string | undefined>(undefined)
  const isUnmountingRef = useRef(false)
  const publishEditorSnapshotRef = useRef<(snapshot: PendingEditorSnapshot) => boolean>(() => false)
  const hasVisibleSiblingRef = useRef(false)
  const snapshotDemandHandlerRef = useRef<(hasVisibleSibling: boolean) => void>(() => {})
  const wasActiveSnapshotRef = useRef(active)
  const compositionDirtyRef = useRef<{
    wasDirty: boolean
    documentChanged: boolean
    hadPending: boolean
    contentRevision: number
  } | null>(null)

  const capricornStatisticsScheduler = useMemo(
    () =>
      createCapricornStatisticsScheduler(
        (statistics) => {
          if (
            !activeRef.current ||
            !visibleRef.current ||
            !isCapricornView(currentViewTypeRef.current)
          )
            return
          useEditorCounterStore.getState().addEditorCounter({ id, data: statistics })
        },
        { onError: captureException },
      ),
    [id, isCapricornView],
  )

  const scheduleEditorCounter = useCallback(
    (params: EditorChangeEventParams) => {
      const { doc } = params.state
      // Selection transactions reuse the immutable document. Keep its pending
      // count instead of repeatedly traversing it or delaying the first result.
      if (counterDocumentRef.current === doc) return
      if (counterIdleHandleRef.current !== null) {
        cancelIdle(counterIdleHandleRef.current)
      }
      counterDocumentRef.current = doc
      counterIdleHandleRef.current = requestIdle(() => {
        counterIdleHandleRef.current = null
        useEditorCounterStore.getState().addEditorCounter({
          id,
          data: {
            characterCount: params.helpers.getCharacterCount(),
            nonWhitespaceCharacterCount: countNonWhitespaceCharacters(doc.textContent),
            wordCount: params.helpers.getWordCount(),
          },
        })
      })
    },
    [id],
  )

  useEffect(() => {
    if (active && !isCapricornView(currentViewType)) {
      if (editorContextRef.current) scheduleEditorCounter(editorContextRef.current)
      return
    }
    if (counterIdleHandleRef.current !== null) {
      cancelIdle(counterIdleHandleRef.current)
      counterIdleHandleRef.current = null
    }
    counterDocumentRef.current = null
  }, [active, currentViewType, scheduleEditorCounter, isCapricornView])

  const setMountedEditorContent = useCallback(
    (nextContent: string) => {
      editorRef.current?.setContent(nextContent)
      capricornEditorRef.current?.setMarkdown(nextContent, fileSaveCoordinator.getRevision(id))
    },
    [id],
  )
  const snapshotPublisher = useMemo(
    () =>
      createDeferredLatestPublisher(
        (snapshot: PendingEditorSnapshot) => publishEditorSnapshotRef.current(snapshot),
        () => getEditorSnapshotTiming(latestContentRef.current?.length ?? 0),
      ),
    [],
  )

  snapshotDemandHandlerRef.current = (hasVisibleSibling) => {
    hasVisibleSiblingRef.current = hasVisibleSibling
    if (currentViewType !== EditorViewType.WYSIWYG) return
    const canRead = editorSnapshotRegistry.canRead(id)
    if (hasVisibleSibling && canRead) {
      snapshotPublisher.resume()
    } else {
      snapshotPublisher.pause()
    }
    if (!canRead) debounceSave.cancel()
    else if (snapshotPublisher.hasPending() && autosave && getFileObject(id)?.path) {
      debounceSaveHandler()
    }
  }

  useEffect(() => {
    isUnmountingRef.current = false
    const unregister = editorSnapshotRegistry.register(id, instanceIdRef.current!, {
      canRead: () => !capricornEditorRef.current?.isComposing(),
      flush: () => snapshotPublisher.flush(),
      hasPending: () => snapshotPublisher.hasPending(),
      isVisible: () => activeRef.current || visibleRef.current,
      onSyncDemandChanged: (hasVisibleSibling) =>
        snapshotDemandHandlerRef.current(hasVisibleSibling),
    })
    return () => {
      isUnmountingRef.current = true
      snapshotPublisher.pause()
      if (editorSnapshotRegistry.flush(id)) snapshotPublisher.cancel()
      unregister()
    }
  }, [id, snapshotPublisher])

  useEffect(() => {
    editorSnapshotRegistry.updateVisibility(id)
  }, [id, active, visible, currentViewType])

  useUnmount(() => {
    capricornStatisticsScheduler.cancel()
    if (counterIdleHandleRef.current !== null) {
      cancelIdle(counterIdleHandleRef.current)
      counterIdleHandleRef.current = null
    }
    if (remoteContentResetHandleRef.current !== null) {
      window.clearTimeout(remoteContentResetHandleRef.current)
      remoteContentResetHandleRef.current = null
    }
  })

  useEffect(() => {
    const instanceId = instanceIdRef.current!
    editorInstanceLifecycle.mount(id)

    return () => {
      unregisterEditorInstanceResources(id, instanceId)
      editorInstanceLifecycle.unmount(id, () => {
        void releaseClosedFileContent(id)
          .then((released) => {
            // Retain an unacknowledged closed draft, including its encoding state.
            if (!released && !useEditorStore.getState().opened.includes(id)) return
            return fileSaveCoordinator.releaseWhenIdle(
              id,
              () => !editorInstanceLifecycle.hasInstances(id),
              () => {
                useEditorCounterStore.getState().deleteEditorCounter({ id })
                useEditorStateStore.getState().delIdStateMap(id)
                useEditorStore.getState().clearEditorResources(id)
                setSourceCodeEditor(id, undefined)
                delegateOptionsCache.delete(id)
                releaseExternalFileChange(id)
              },
            )
          })
          .catch((error) => logger.error('Failed to release closed document', error))
      })
    }
  }, [id])

  useEffect(() => {
    if (active) {
      promoteEditorInstanceResources(id, instanceIdRef.current!)
    }
  }, [active, id])

  const updateCachedFileContent = useCallback(
    (nextContent: string) => {
      fileSaveCoordinator.recordContent(id, nextContent)
      const file = getFileObject(id)
      if (!file) return

      updateFileObject(id, {
        ...file,
        content: nextContent,
      })
    },
    [id],
  )

  const emitContentSync = useCallback(
    (nextContent: string) => {
      bus.emit(TEXT_EDITOR_CONTENT_SYNC_EVENT, undefined, {
        fileId: id,
        sourceInstanceId: instanceIdRef.current!,
        content: nextContent,
      } satisfies TextEditorContentSyncPayload)
    },
    [id],
  )

  const applySyncedContent = useCallback(
    (nextContent: string, force = false) => {
      // A newer local edit wins this race. Its pending publication will bring
      // the sibling instance back to the same content.
      if (!force && snapshotPublisher.hasPending()) return
      if (!force && latestContentRef.current === nextContent) return

      snapshotPublisher.cancel()
      if (remoteContentResetHandleRef.current !== null) {
        window.clearTimeout(remoteContentResetHandleRef.current)
        remoteContentResetHandleRef.current = null
      }

      isApplyingRemoteContentRef.current = true
      latestContentRef.current = nextContent
      setContent(nextContent)
      updateCachedFileContent(nextContent)

      // Capricorn treats content as a remount seed. Keep the shared host value
      // current without parsing every sibling edit into an invisible runtime.
      // Suppress late callbacks from its old document until it catches up.
      if (isCapricornView(currentViewType) && !activeRef.current && !visibleRef.current) {
        needsMountedContentSyncRef.current = true
        return
      }

      needsMountedContentSyncRef.current = false
      setMountedEditorContent(nextContent)
      remoteContentResetHandleRef.current = window.setTimeout(() => {
        isApplyingRemoteContentRef.current = false
        remoteContentResetHandleRef.current = null
      }, 0)
    },
    [
      currentViewType,
      setMountedEditorContent,
      snapshotPublisher,
      updateCachedFileContent,
      isCapricornView,
    ],
  )

  useLayoutEffect(() => {
    if (!active && !visible) return
    // Capricorn flushes its separate React root synchronously. Leave this
    // commit before replacing its document, then catch up before native input.
    let canceled = false
    queueMicrotask(() => {
      if (canceled || (!activeRef.current && !visibleRef.current)) return
      if (!editorSnapshotRegistry.flush(id)) return
      if (needsMountedContentSyncRef.current) {
        applySyncedContent(latestContentRef.current ?? '', true)
      }
    })
    return () => {
      canceled = true
    }
  }, [id, active, visible, applySyncedContent])

  useEffect(() => {
    latestContentRef.current = content
  }, [content])

  useEffect(() => {
    const wasActive = wasActiveSnapshotRef.current
    wasActiveSnapshotRef.current = active
    if (wasActive && !active) {
      editorSnapshotRegistry.flush(id)
    }
  }, [id, active])

  useEffect(() => {
    const wasReserved = wasSavePathReservedRef.current
    wasSavePathReservedRef.current = savePathReserved
    if (savePathReserved) {
      editorSnapshotRegistry.flush(id)
      return
    }
    if (!wasReserved) return
    if (!rejectedReservedChangeRef.current) return
    rejectedReservedChangeRef.current = false

    const cachedContent = getFileObject(id)?.content
    if (typeof cachedContent !== 'string') return

    latestContentRef.current = cachedContent
    setMountedEditorContent(cachedContent)
    setContent(cachedContent)
  }, [id, savePathReserved, setMountedEditorContent, snapshotPublisher])

  useEffect(() => {
    const handleContentSync = (payload: TextEditorContentSyncPayload) => {
      if (payload.fileId !== id) return
      if (payload.sourceInstanceId === instanceIdRef.current) return

      applySyncedContent(payload.content)
    }

    bus.on(TEXT_EDITOR_CONTENT_SYNC_EVENT, handleContentSync)

    return () => {
      bus.detach(TEXT_EDITOR_CONTENT_SYNC_EVENT, handleContentSync)
    }
  }, [applySyncedContent, id])

  useEffect(() => {
    const handleExternalContentSync = (payload: ExternalFileContentSyncPayload) => {
      if (payload.fileId !== id) return
      applySyncedContent(payload.content, true)
      setStatus(TextEditorStatus.SUCCESS)
    }

    bus.on(EXTERNAL_FILE_CONTENT_SYNC_EVENT, handleExternalContentSync)

    return () => {
      bus.detach(EXTERNAL_FILE_CONTENT_SYNC_EVENT, handleExternalContentSync)
    }
  }, [applySyncedContent, id])

  useEffect(() => {
    let canceled = false
    const readController = new AbortController()
    const file = getFileObject(id) ?? lastKnownFileRef.current
    if (!file || file.path !== filePath) return
    const openRequestId =
      getEditorOpenMeasurement(id, groupId) ??
      beginEditorOpenMeasurement(id, { viewId: groupId, origin: 'mount' })
    recordEditorOpenStage(openRequestId, 'host-content-start', {
      contentRevision: fileSaveCoordinator.getRevision(id),
      kind: 'open',
    })
    const contentRevision = fileSaveCoordinator.getRevision(id)
    const diskRevision = fileSaveCoordinator.getDiskRevision(id)

    // Loading a sibling or changing paths must not overwrite an edit or a
    // newer watcher/save publication that arrived while the read was pending.
    const keepNewerContent = () => {
      const currentFile = getFileObject(id)
      if (canceled || !currentFile || currentFile.path !== filePath) return true
      const currentState = useEditorStateStore.getState().idStateMap.get(id)
      if (
        (currentState?.hasUnsavedChanges && typeof currentFile.content === 'string') ||
        editorSnapshotRegistry.hasPending(id) ||
        !editorSnapshotRegistry.canRead(id) ||
        currentFile.content !== file.content ||
        fileSaveCoordinator.getRevision(id) !== contentRevision ||
        fileSaveCoordinator.getDiskRevision(id) !== diskRevision
      ) {
        if (typeof currentFile.content === 'string') {
          recordEditorOpenContent(openRequestId, currentFile.content)
          recordEditorOpenStage(openRequestId, 'host-content-ready', {
            contentRevision: fileSaveCoordinator.getRevision(id),
          })
          setContent(currentFile.content)
          setStatus(TextEditorStatus.SUCCESS)
        }
        return true
      }
      return false
    }

    const init = async () => {
      const editorState = useEditorStateStore.getState().idStateMap.get(file.id)

      if (
        (editorState?.hasUnsavedChanges ||
          editorSnapshotRegistry.hasPending(id) ||
          !editorSnapshotRegistry.canRead(id)) &&
        typeof file.content === 'string'
      ) {
        fileSaveCoordinator.recordContent(id, file.content)
        recordEditorOpenStage(openRequestId, 'cache-ready')
        recordEditorOpenContent(openRequestId, file.content)
        recordEditorOpenStage(openRequestId, 'host-content-ready', {
          contentRevision: fileSaveCoordinator.getRevision(id),
        })
        setContent(file.content)
        return setStatus(TextEditorStatus.SUCCESS)
      }

      if (file.path) {
        recordEditorOpenStage(openRequestId, 'read-start')
        const startupRead = activeRef.current ? takeStartupDocumentRead(id, file.path) : undefined
        const preparedSnapshot = startupRead ? await startupRead : undefined
        if (canceled) return
        const snapshot =
          preparedSnapshot ??
          (await readStableFileSnapshot(file.path, {
            reuseInFlight: true,
            signal: readController.signal,
            scope: useEditorStore.getState().folderData?.[0],
            priority: activeRef.current ? 'foreground' : 'visible',
          }))
        recordEditorOpenStage(openRequestId, 'read-end')
        if (keepNewerContent()) return
        if (snapshot.status === 'unstable') {
          finishEditorOpenMeasurement(openRequestId, 'error')
          toast.error(i18n.t('external_file_change.read_failed'))
          return setStatus(TextEditorStatus.READERROR)
        }
        if (snapshot.status === 'success') {
          recordEditorOpenContent(openRequestId, snapshot.content)
          fileSaveCoordinator.loadSnapshot(id, snapshot)
          void observeHistoryFile(id, snapshot.content).catch((error) =>
            logger.error('History baseline failed', error),
          )
          setContent(snapshot.content)
          updateCachedFileContent(snapshot.content)
          recordEditorOpenStage(openRequestId, 'host-content-ready', {
            contentRevision: fileSaveCoordinator.getRevision(id),
          })
          return setStatus(TextEditorStatus.SUCCESS)
        }

        const res = snapshot.result
        finishEditorOpenMeasurement(openRequestId, 'error')
        if (res.code === FileResultCode.NotFound) {
          useRecentFilesStore.getState().removePath(file.path)
          return setStatus(TextEditorStatus.NOTEXIST)
        }
        if (String(res.code) === 'Binary') {
          return setStatus(TextEditorStatus.BINARY)
        }
        if (res.code !== FileResultCode.Success) {
          toast.error(res.content)
          return setStatus(TextEditorStatus.READERROR)
        }
      } else if (file.content !== undefined) {
        if (canceled) return
        fileSaveCoordinator.recordContent(id, file.content)
        recordEditorOpenStage(openRequestId, 'cache-ready')
        recordEditorOpenContent(openRequestId, file.content)
        recordEditorOpenStage(openRequestId, 'host-content-ready', {
          contentRevision: fileSaveCoordinator.getRevision(id),
        })
        setContent(file.content)
      }

      return setStatus(TextEditorStatus.SUCCESS)
    }
    void init().catch((error) => {
      if (keepNewerContent()) return
      finishEditorOpenMeasurement(openRequestId, 'error')
      logger.error('Failed to read file snapshot', error)
      toast.error(i18n.t('external_file_change.read_failed'))
      setStatus(TextEditorStatus.READERROR)
    })

    return () => {
      canceled = true
      readController.abort()
    }
  }, [filePath, groupId, id, updateCachedFileContent])

  useEffect(() => {
    if (status !== TextEditorStatus.SUCCESS || editorInitializedRef.current) return
    editorInitializedRef.current = true
    const initialMode = initialViewTypeRef.current
    useEditorViewTypeStore.getState().setEditorViewType(id, initialMode)
  }, [status, id])

  useEffect(() => {
    if (
      status !== TextEditorStatus.SUCCESS ||
      currentViewType !== EditorViewType.SOURCECODE ||
      delegate ||
      !rmeRuntime
    ) return
    const newDelegate = createDelegate(rmeRuntime, fileTypeConfig.type)
    setDelegate(newDelegate)
    registerEditorDelegateResource(id, instanceIdRef.current!, newDelegate, activeRef.current)
  }, [status, id, currentViewType, delegate, rmeRuntime, fileTypeConfig.type, createDelegate])

  const saveHandler = useCallback(
    async (params: SaveHandlerParams = {}) => {
      return runSaveOperation(async () => {
        if (!active && !params.active) return false
        if (
          params.autosave &&
          (!useAppSettingStore.getState().settingData.autosave ||
            isHistoryAutosavePaused(id) ||
            fileSaveCoordinator.getTextMetadata(id).decoding.needsConfirmation ||
            !getFileObject(id)?.path)
        )
          return false

        const fileBeforeFlush = getFileObject(id) ?? curFile
        if (!fileBeforeFlush) return false

        const curEditorState = useEditorStateStore.getState().idStateMap.get(fileBeforeFlush.id)

        if (!editorSnapshotRegistry.canRead(id)) return false
        if (!curEditorState?.hasUnsavedChanges) {
          if (!params.autosave) await endHistoryBatch(id)
          // Editing can resume while the native batch boundary is being committed.
          if (!useEditorStateStore.getState().idStateMap.get(id)?.hasUnsavedChanges) {
            historyFileSaved(id)
            return true
          }
        }
        if (isExternalFileSaveBlocked(id)) return false

        if (!editorSnapshotRegistry.flush(id)) return false
        if (
          params.expectedContent !== undefined &&
          useEditorStore.getState().getEditorContent(id) !== params.expectedContent
        )
          return false
        const initialFile = getFileObject(id) ?? fileBeforeFlush
        const sharedContent =
          typeof initialFile.content === 'string'
            ? initialFile.content
            : editorContextRef.current?.state.doc && delegate
              ? delegate.docToString(editorContextRef.current.state.doc)
              : undefined
        if (typeof sharedContent !== 'string') return false

        fileSaveCoordinator.recordContent(id, sharedContent)
        let selectedSaveAsPath: string | undefined

        return fileSaveCoordinator.saveLatest(
          id,
          async (saveSnapshot) => {
            const { content: fileContent, textOptions } = saveSnapshot
            if (isExternalFileSaveBlocked(id)) return false

            const fileToSave = getFileObject(id) ?? initialFile
            if (!fileToSave || typeof fileContent !== 'string') return false

            if (!useEditorStateStore.getState().idStateMap.get(id)?.hasUnsavedChanges) {
              return true
            }

            try {
              if (!fileToSave.path) {
                if (!selectedSaveAsPath) {
                  if (noFileSaveingRef.current) return false

                  noFileSaveingRef.current = true
                  let selectedPath: string | null
                  try {
                    selectedPath = await save({
                      title: t('file.save_dialog_title'),
                      defaultPath: fileToSave.name ?? `${t('file.untitled')}.md`,
                    })
                  } finally {
                    noFileSaveingRef.current = false
                  }

                  if (!selectedPath) return false
                  selectedSaveAsPath = selectedPath
                }

                const targetPath = selectedSaveAsPath
                const comparePaths = memoizePathRelationResolver(comparePathRelation)
                let blockedByDirtyTarget = false
                let expectedRevision: string | undefined
                let writeConflict = false
                let writtenRevision: string | undefined
                const saved = await runReservedSaveAs({
                  applyReservationUpdate: (update) => flushSync(update),
                  collectCollisions: () => collectSaveAsCollisions(targetPath, id, comparePaths),
                  collectPostWriteReplaceIds: () => collectSaveAsReplaceIds(targetPath, id),
                  coordinator: savePathCoordinator,
                  isDirty: (fileId) => {
                    const dirty = !!useEditorStateStore.getState().idStateMap.get(fileId)
                      ?.hasUnsavedChanges
                    blockedByDirtyTarget ||= dirty
                    return dirty
                  },
                  ownerFileId: id,
                  onUnexpectedDirty: () => {
                    toast.error('The target changed during saving and was kept open.')
                  },
                  path: targetPath,
                  prepareWrite: async () => {
                    expectedRevision = await getFileWriteRevision(targetPath)
                  },
                  replaceCollisions: (collisionIds) => {
                    const editorStore = useEditorStore.getState()
                    const editorStateStore = useEditorStateStore.getState()
                    collisionIds.forEach((collisionId) => {
                      editorStore.delOpenedFile(collisionId)
                      editorStateStore.delIdStateMap(collisionId)
                      deleteFileObject(collisionId)
                    })

                    const filename = getFileNameFromPath(targetPath)
                    const savedFile = getFileObject(fileToSave.id)
                      ? updateFile({
                          id: fileToSave.id,
                          path: targetPath,
                          name: filename,
                        })
                      : updateFile({
                          ...fileToSave,
                          content: fileContent,
                          path: targetPath,
                          name: filename,
                        })
                    insertNodeToFolderData(savedFile, collisionIds)
                  },
                  syncProtectedAliases: (aliasIds) => {
                    const editorStore = useEditorStore.getState()
                    closeCleanPhysicalAliases({
                      aliasIds: aliasIds.filter((aliasId) => editorStore.opened.includes(aliasId)),
                      closeTab: editorStore.delOpenedFile,
                      content: fileContent,
                      getFile: getFileObject,
                      updateFile: (file) => {
                        updateFile(file)
                      },
                    })
                  },
                  write: async () => {
                    if (!expectedRevision) return false
                    const writeResult = await conditionalWriteExpectedIfAllowed(
                      targetPath,
                      fileContent,
                      expectedRevision,
                      () =>
                        !isExternalFileSaveBlocked(id) &&
                        (!params.autosave ||
                          (useAppSettingStore.getState().settingData.autosave &&
                            !isHistoryAutosavePaused(id))) &&
                        (params.expectedContent === undefined ||
                          useEditorStore.getState().getEditorContent(id) ===
                            params.expectedContent),
                      undefined,
                      params.autosave ? 'autosave' : 'save',
                      { ...textOptions, originalFormat: undefined },
                    )
                    if (writeResult.status === 'blocked') return false
                    if (writeResult.status === 'conflict') {
                      writeConflict = true
                      return false
                    }
                    writtenRevision = writeResult.revision
                    return true
                  },
                })

                if (saved && writtenRevision) {
                  fileSaveCoordinator.acknowledgeSaved(id, saveSnapshot, writtenRevision)
                }

                if (!saved && blockedByDirtyTarget) {
                  toast.error('Save the target file before overwriting it.')
                } else if (!saved && writeConflict) {
                  toast.error('The target changed in another window. Save again to retry.')
                }
                return saved
              } else {
                const expectedRevision = fileSaveCoordinator.getDiskRevision(id)
                if (!expectedRevision) {
                  const diskSnapshot = await readStableFileSnapshot(fileToSave.path)
                  if (diskSnapshot.status === 'success') {
                    markExternalFileConflict(id, diskSnapshot.revision)
                  } else {
                    toast.error(t('external_file_change.read_failed'))
                  }
                  return false
                }

                const queuedWrite = await runQueuedFileWrite({
                  coordinator: savePathCoordinator,
                  getCurrentPath: () => getFileObject(id)?.path,
                  write: (currentPath) =>
                    conditionalWriteExpectedIfAllowed(
                      currentPath,
                      fileContent,
                      expectedRevision,
                      () =>
                        !isExternalFileSaveBlocked(id) &&
                        (!params.autosave ||
                          (useAppSettingStore.getState().settingData.autosave &&
                            !isHistoryAutosavePaused(id))) &&
                        (params.expectedContent === undefined ||
                          useEditorStore.getState().getEditorContent(id) ===
                            params.expectedContent),
                      undefined,
                      params.autosave ? 'autosave' : 'save',
                      textOptions,
                    ),
                })
                if (queuedWrite.status === 'missing-path') return false
                if (queuedWrite.value.status === 'blocked') return false
                if (queuedWrite.value.status === 'conflict') {
                  markExternalFileConflict(id, queuedWrite.value.revision)
                  return false
                }
                fileSaveCoordinator.acknowledgeSaved(id, saveSnapshot, queuedWrite.value.revision)
              }

              return true
            } catch (error) {
              const message = String(error)
              const notify = !message.includes('text_') || fileSaveCoordinator.recordSaveError(id, message)
              if (!params.autosave || notify) toast.error(message)
              return false
            }
          },
          (snapshot) => {
            if (typeof snapshot.content === 'string') {
              const latestCachedFile = getFileObject(id)
              if (latestCachedFile) {
                updateFileObject(id, {
                  ...latestCachedFile,
                  content: snapshot.content,
                })
              } else {
                updateFile({
                  ...initialFile,
                  content: snapshot.content,
                })
              }
              latestContentRef.current = snapshot.content
              setContent(snapshot.content)
            }
            useEditorStateStore.getState().setIdStateMap(id, {
              hasUnsavedChanges: false,
            })
            historyFileSaved(id)
          },
          {
            canAttempt: () =>
              (params.expectedContent === undefined ||
                useEditorStore.getState().getEditorContent(id) === params.expectedContent) &&
              (!params.autosave ||
                (useAppSettingStore.getState().settingData.autosave &&
                  !isHistoryAutosavePaused(id))) &&
              !isExternalFileSaveBlocked(id) &&
              editorSnapshotRegistry.canRead(id) &&
              !editorSnapshotRegistry.hasPending(id),
          },
        )
      }, params)
    },
    [active, id, delegate, t, insertNodeToFolderData, snapshotPublisher],
  )

  const debounceSave = useDebouncedAutosave(() => saveHandler({ active: true, autosave: true }), {
    active,
    flushOnDeactivate: autosave && Boolean(getFileObject(id)?.path),
    enabled: autosave,
    dirty: dirtyForAutosave,
    wait: autosaveInterval,
  })

  const debounceRefreshToc = useMemo(
    () =>
      debounce(() => {
        if (fileTypeConfig.type === 'markdown') {
          commandRegistry.execute('app:toc_refresh')
        }
      }, 1000),
    [fileTypeConfig.type],
  )

  useEffect(() => {
    return () => {
      if (debounceSaveHandlerCacheRef.current === debounceSave) {
        debounceSaveHandlerCacheRef.current = null
      }
    }
  }, [debounceSave])

  useEffect(() => {
    if (externalChangeState !== 'none') {
      debounceSave.cancel()
      if (debounceSaveHandlerCacheRef.current === debounceSave) {
        debounceSaveHandlerCacheRef.current = null
      }
    }
  }, [debounceSave, externalChangeState])

  useEffect(() => {
    return () => debounceRefreshToc.cancel()
  }, [debounceRefreshToc])

  const debounceSaveHandler = useCallback(() => {
    if (debounceSave && !isExternalFileSaveBlocked(id)) {
      debounceSaveHandlerCacheRef.current = debounceSave
      debounceSave()
    }
  }, [debounceSave, id])

  useEffect(() => {
    const instanceId = instanceIdRef.current!
    setTextEditorSaveHandler(id, instanceId, () => saveHandler({ active: true }), activeRef.current)

    return () => {
      deleteTextEditorSaveHandler(id, instanceId)
    }
  }, [id, saveHandler])

  const setContentHandler = useCallback(
    (newContent: string) => {
      if (!active || savePathReserved || externalChangeResolving) return
      snapshotPublisher.cancel()
      setMountedEditorContent(newContent)
      setContent(newContent)
      latestContentRef.current = newContent
      updateCachedFileContent(newContent)

      // Set save state to unsaved after content change
      const { setIdStateMap } = useEditorStateStore.getState()
      setIdStateMap(id, {
        hasUnsavedChanges: true,
      })
      emitContentSync(newContent)
      protectLocalEdit(id)
    },
    [
      active,
      emitContentSync,
      externalChangeResolving,
      id,
      savePathReserved,
      setMountedEditorContent,
      snapshotPublisher,
      updateCachedFileContent,
    ],
  )

  const editorTypeSwitchingRef = useRef(false)

  useEffect(() => {
    if (!active) return
    const ctx = useEditorStore.getState().getEditorCtx(id)
    if (ctx?.commands?.toggleTypewriterScroll) {
      ctx.commands.toggleTypewriterScroll(editorTypewriterScroll)
    }
  }, [editorTypewriterScroll, delegate, id, active])

  useEffect(() => {
    if (!active) return
    const ctx = useEditorStore.getState().getEditorCtx(id)
    if (ctx?.commands?.togglePlaceholder) {
      ctx.commands.togglePlaceholder(editorPlaceholder)
    }
  }, [editorPlaceholder, delegate, id, active])

  useEffect(() => {
    const ctx = editorContextRegistry.get(id, instanceIdRef.current!)
    if (ctx?.commands?.setLivePreviewBlockBehavior) {
      ctx.commands.setLivePreviewBlockBehavior(livePreviewBlockBehavior)
    }
  }, [delegate, id, livePreviewBlockBehavior])

  useEffect(() => {
    delegateOptionsCache.clear()
  }, [editorPlaceholder, editorTypewriterScroll, livePreviewBlockBehavior, editorKeybingMap])

  useEffect(() => {
    if (!editorKeybindingsLoaded) return
    const context = editorContextRegistry.get(id, instanceIdRef.current!)
    if (context) updateRmeKeybindings(context, editorKeybingMap)
  }, [id, delegate, editorKeybingMap, editorKeybindingsLoaded])

  const switchHtmlView = useCallback(
    (mode: EditorViewTypeValue) => {
      if (!isHtml || (mode !== EditorViewType.PREVIEW && mode !== EditorViewType.SOURCECODE)) return
      if (!editorSnapshotRegistry.flush(id)) return
      if (currentViewType === EditorViewType.SOURCECODE && resumeSource) {
        if (resumeSource.cm.composing) return
        setContent(resumeSource.content)
      }
      if (mode === EditorViewType.SOURCECODE) {
        if (delegate && resumeSource) {
          registerSourceCodeViewResource(
            id,
            instanceIdRef.current!,
            resumeSource,
            activeRef.current,
          )
        }
      } else {
        unregisterSourceCodeViewResource(id, instanceIdRef.current!)
      }
      useEditorViewTypeStore.getState().setEditorViewType(id, mode)
      setCurrentViewType(mode)
    },
    [currentViewType, delegate, id, isHtml, resumeSource],
  )

  useEffect(() => {
    if (
      status === TextEditorStatus.SUCCESS &&
      sharedHtmlViewType &&
      sharedHtmlViewType !== currentViewType
    ) {
      switchHtmlView(sharedHtmlViewType)
    }
  }, [currentViewType, sharedHtmlViewType, status, switchHtmlView])

  useEffect(() => {
    const cb = throttle(
      (payload: EditorViewTypeValue) => {
        if (active) {
          if (editorTypeSwitchingRef.current) {
            return
          }

          if (currentViewType === payload) return
          if (!fileTypeConfig.supportedModes.includes(payload)) return

          if (isHtml) {
            switchHtmlView(payload)
            return
          }

          editorTypeSwitchingRef.current = true
          bus.emit(EVENT.app_save, undefined, {
            onSuccess: () => {
              // A new Remirror manager mounts asynchronously. Do not expose the
              // previous mode's extension-specific helpers during that gap.
              clearSwitchingEditorContextResource(curFile.id, instanceIdRef.current!)

              if (payload !== EditorViewType.SOURCECODE) {
                unregisterSourceCodeViewResource(curFile.id, instanceIdRef.current!)
              }

              const switchingFromCapricorn = isCapricornView(currentViewType)

              if (isCapricornView(payload)) {
                unregisterRmeEditorResources(curFile.id, instanceIdRef.current!)
                editorContextRef.current = null
                setDelegate(null)
              } else if (payload === EditorViewType.SOURCECODE) {
                const sourceCodeDelegate = rmeRuntime
                  ? createDelegate(rmeRuntime, fileTypeConfig.type)
                  : null
                if (sourceCodeDelegate) {
                  registerEditorDelegateResource(
                    curFile.id,
                    instanceIdRef.current!,
                    sourceCodeDelegate,
                    activeRef.current,
                  )
                }
                setResumeSource(null)
                setDelegate(sourceCodeDelegate)
              } else if (payload === EditorViewType.PREVIEW) {
                debounceRefreshToc()
              }
              useEditorViewTypeStore.getState().setEditorViewType(curFile.id, payload)
              setCurrentViewType(payload)
              if (!switchingFromCapricorn && !isCapricornView(payload)) {
                editorRef.current?.toggleType(payload)
              }
            },
            onFinally: () => {
              editorTypeSwitchingRef.current = false
            },
          })
        }
      },
      300,
      { leading: true, trailing: false },
    )

    bus.on('editor_toggle_type', cb)

    return () => {
      cb.cancel()
      bus.detach('editor_toggle_type', cb)
    }
  }, [
    active,
    curFile,
    currentViewType,
    debounceRefreshToc,
    fileTypeConfig.supportedModes,
    fileTypeConfig.type,
    createDelegate,
    rmeRuntime,
    isHtml,
    switchHtmlView,
    isCapricornView,
  ])

  useEffect(() => {
    const exportImageHandler = async () => {
      if (!active) {
        return
      }

      const file = getFileObject(id)
      if (!file) return

      try {
        const markdown = useEditorStore.getState().getEditorContent(id)
        const capricornEditor = isCapricornView(currentViewType) ? capricornEditorRef.current : null
        const path = await save({
          title: t('contextmenu.editor_tab.export_image'),
          defaultPath: file.name.split('.')?.[0] + '.jpg',
        })
        if (!path) return

        const n = toast.loading(t('contextmenu.editor_tab.export_image') + '...')
        let restoreExportResources: (() => void) | undefined
        let disposeExportSurface: (() => void) | undefined

        try {
          let exportElement: HTMLElement | null
          if (isCapricornView(currentViewType)) {
            if (!capricornEditor) throw new Error('Editor is not ready.')
            const surface = await capricornEditor.createExportSurface(markdown)
            disposeExportSurface = surface.dispose
            exportElement = surface.element
          } else {
            await waitForEditorResourcesForExport(editorRef.current)
            exportElement = document.getElementById(id)
          }
          if (!exportElement) {
            throw new Error('Editor element not found')
          }

          restoreExportResources = await prepareResourcesForExport(
            exportElement,
            getFolderPathFromPath(getFileObject(id)?.path ?? file.path),
          )
          const image = await renderElementToImageDataUrl(exportElement)
          const data = canvasDataToBinary(image)
          const res = await invoke<FileSysResult>('write_u8_array_to_file', {
            filePath: path,
            content: data,
          })

          if (res.code !== FileResultCode.Success) {
            throw new Error(res.content)
          }

          toast.success('Exported to ' + path)
        } catch (error) {
          logger.error('Failed to export image:', error)
          toast.error(String(error))
        } finally {
          try {
            restoreExportResources?.()
          } finally {
            disposeExportSurface?.()
            toast.dismiss(n)
          }
        }
      } catch (error) {
        toast.error(String(error))
      }
    }

    const exportHtmlHandler = async () => {
      if (!active) return
      const file = getFileObject(id)
      if (!file) return
      let loading: ReturnType<typeof toast.loading> | undefined
      try {
        const path = await save({
          title: t('contextmenu.editor_tab.export_html'),
          defaultPath: file.name.split('.')?.[0] + '.html',
        })
        if (!path) return
        editorSnapshotRegistry.flushForRead(id)
        loading = toast.loading(t('contextmenu.editor_tab.export_html') + '...')
        const res = isCapricornView(currentViewType)
          ? await capricornEditorRef.current?.export('html')
          : await editorRef.current?.exportHtml()
        if (typeof res !== 'string') throw new Error('Editor is not ready.')
        const html = exportHtmlDocument(res, editorWrapperRef.current, file.name)
        await invoke('export_html_to_path', { str: html, path })
        toast.success('Exported to ' + path)
      } catch (error) {
        toast.error(String(error))
      } finally {
        if (loading !== undefined) toast.dismiss(loading)
      }
    }

    bus.on('editor_export_html', exportHtmlHandler)
    bus.on('editor_export_image', exportImageHandler)
    bus.on('editor_set_content', setContentHandler)

    return () => {
      bus.detach('editor_export_html', exportHtmlHandler)
      bus.detach('editor_export_image', exportImageHandler)
      bus.detach('editor_set_content', setContentHandler)
    }
  }, [active, currentViewType, id, setContentHandler, t, isCapricornView])

  useEffect(() => {
    if (active) {
      debounceRefreshToc()
    }
  }, [active, debounceRefreshToc])

  useEffect(() => {
    if (active) {
      debounceRefreshToc()
    }
  }, [active, delegate, debounceRefreshToc])

  useEffect(() => {
    if (active) {
      const disposable = commandRegistry.registerCommand({
        id: 'app_save',
        handler: () => {
          saveHandler()
        },
      })

      return () => disposable.dispose()
    }
  }, [active, saveHandler])

  useEffect(() => {
    const callback = (hooks: SaveHandlerParams) => {
      if (!active) {
        return
      }
      saveHandler({ onSuccess: hooks?.onSuccess, onFinally: hooks?.onFinally })
    }

    bus.on(EVENT.app_save, callback)

    return () => {
      bus.detach(EVENT.app_save, callback)
    }
  }, [active, saveHandler])

  const handleWrapperClick: React.MouseEventHandler<HTMLDivElement> = useCallback(
    (e) => {
      if (currentViewType === EditorViewType.WYSIWYG) {
        if (
          e.target === e.currentTarget ||
          (e.target as HTMLElement).parentElement === e.currentTarget
        ) {
          capricornEditorRef.current?.focus()
        }
        return
      }
      if (currentViewType === EditorViewType.PREVIEW || !delegate || !delegate.manager.mounted) {
        return
      }
      if (
        (e.target as HTMLElement)?.id === 'editorarea-wrapper' ||
        (e.target as HTMLElement).parentElement?.id === 'editorarea-wrapper'
      ) {
        delegate.manager.view.focus()
      }
    },
    [currentViewType, delegate],
  )

  const themeFontSize = semanticTheme?.['font.editor.size'] ?? `${editorRootFontSize ?? 16}px`
  const rootLineHeight =
    semanticTheme?.['font.editor.lineHeight'] ?? (editorRootLineHeight || '1.65')
  const wysiwygRootLineHeight =
    semanticTheme?.['font.editor.lineHeight'] ?? (editorRootLineHeight || '1.7')

  const editorProps: MfEditorProps = useMemo(
    () => ({
      initialType: isHtml ? EditorViewType.SOURCECODE : currentViewType,
      content: content!,
      delegate: delegate ?? undefined,
      editable: !savePathReserved && !externalChangeResolving,
      style: {
        height: '100%',
      },
      wysiwygTextContainerProps: {
        spellCheck: wysiwygEditorSpellcheck,
      },
      sourceCodeTextContainerProps: {
        spellCheck: sourceCodeEditorSpellcheck,
      },
      offset: { top: 10, left: 16 },
      styleToken: {
        id,
        rootFontSize: themeFontSize,
        rootLineHeight,
      },
      onContextMounted: (context: EditorContext) => {
        registerEditorContextResource(id, instanceIdRef.current!, context, activeRef.current)
      },
      delegateOptions: getOrCreateDelegateOptions(curFile.id),
      wysiwygToolBarOptions: {
        enable: false,
      },
      errorHandler: {
        onError(params) {
          if (params.error) {
            captureException(params.error)
          }
        },
      },
    }),
    [
      content,
      delegate,
      id,
      sourceCodeEditorSpellcheck,
      wysiwygEditorSpellcheck,
      fileTypeConfig,
      currentViewType,
      themeFontSize,
      rootLineHeight,
      savePathReserved,
      externalChangeResolving,
      isHtml,
    ],
  )
  publishEditorSnapshotRef.current = (snapshot) =>
    editorSnapshotRegistry.publish(id, instanceIdRef.current!, () => {
      try {
        const serialize =
          snapshot.kind === 'capricorn'
            ? snapshot.getMarkdown
            : () => snapshot.delegate.docToString(snapshot.doc)
        const shouldMeasure = snapshot.kind === 'capricorn' || snapshot.delegate.view === 'Wysiwyg'
        const documentSize =
          snapshot.kind === 'capricorn' ? snapshot.documentSize : snapshot.doc.content.size
        const nextContent = shouldMeasure
          ? measureEditorSnapshot(id, documentSize, snapshot.mode, serialize)
          : serialize()

        latestContentRef.current = nextContent
        if (!isUnmountingRef.current) {
          setContent(nextContent)
        }
        updateCachedFileContent(nextContent)
        emitContentSync(nextContent)

        if (!isUnmountingRef.current) {
          // Capricorn's heading subscription already publishes actual outline
          // changes; plain text snapshots must not rebuild its full directory.
          if (activeRef.current && snapshot.kind !== 'capricorn') {
            debounceRefreshToc()
          }

          const latestFile = getFileObject(id)
          if (snapshot.kind !== 'capricorn' && autosave && latestFile?.path) {
            debounceSaveHandler()
          }
        }
        return true
      } catch (error) {
        captureException(error)
        return false
      }
    })

  const handleBeforeInputCapture = useCallback(() => {
    interactionStartedAtRef.current = startEditorInteractionMeasurement()
    interactionOpenRequestIdRef.current = getEditorOpenMeasurement(id, groupId)
  }, [groupId, id])

  const handleChange: EditorChangeHandler = useCallback(
    (params) => {
      const { tr, helpers } = params
      editorContextRef.current = params

      if (savePathReserved && tr?.docChanged) {
        snapshotPublisher.flush()
        const cachedContent = getFileObject(id)?.content
        const changedContent = delegate?.docToString(params.state.doc)
        if (typeof cachedContent === 'string' && changedContent !== cachedContent) {
          rejectedReservedChangeRef.current = true
          queueMicrotask(() => {
            latestContentRef.current = cachedContent
            setMountedEditorContent(cachedContent)
            setContent(cachedContent)
            rejectedReservedChangeRef.current = false
          })
        }
        interactionStartedAtRef.current = undefined
        interactionOpenRequestIdRef.current = undefined
        return
      }

      if (active) {
        scheduleEditorCounter(params)
      }

      if (tr?.docChanged && !tr.getMeta('APPLY_MARKS')) {
        if (isApplyingRemoteContentRef.current || !delegate) {
          interactionStartedAtRef.current = undefined
          interactionOpenRequestIdRef.current = undefined
          return
        }

        useEditorStateStore.getState().setIdStateMap(id, {
          hasUnsavedChanges: true,
          undoDepth: helpers.undoDepth(),
        })
        editorSnapshotRegistry.changed(id, instanceIdRef.current!)
        protectLocalEdit(id)

        const coalesce = delegate.view === 'Wysiwyg' && shouldCoalesceEditorSnapshots()
        const snapshot: PendingEditorSnapshot = {
          delegate,
          doc: params.state.doc,
          kind: 'rme',
          mode: coalesce ? 'coalesced' : 'immediate',
        }

        snapshotPublisher.schedule(snapshot)
        if (!coalesce) {
          snapshotPublisher.flush()
        }

        recordEditorInteractionMeasurement(
          id,
          interactionStartedAtRef.current,
          groupId,
          'visual-feedback',
          interactionOpenRequestIdRef.current,
        )
        interactionStartedAtRef.current = undefined
        interactionOpenRequestIdRef.current = undefined
      }
    },
    [
      id,
      groupId,
      delegate,
      active,
      savePathReserved,
      scheduleEditorCounter,
      setMountedEditorContent,
      snapshotPublisher,
    ],
  )

  const handleCapricornChange = useCallback(
    (event?: CapricornEditorChangeEvent) => {
      if (isApplyingRemoteContentRef.current || isUnmountingRef.current) {
        interactionStartedAtRef.current = undefined
        interactionOpenRequestIdRef.current = undefined
        return
      }

      if (savePathReserved || externalChangeResolving) {
        const cachedContent = getFileObject(id)?.content
        if (typeof cachedContent === 'string') {
          capricornEditorRef.current?.setMarkdown(
            cachedContent,
            fileSaveCoordinator.getRevision(id),
          )
        }
        interactionStartedAtRef.current = undefined
        interactionOpenRequestIdRef.current = undefined
        return
      }

      if (event?.composing && !compositionDirtyRef.current) {
        compositionDirtyRef.current = {
          wasDirty: useEditorStateStore.getState().idStateMap.get(id)?.hasUnsavedChanges ?? false,
          documentChanged: false,
          hadPending: snapshotPublisher.hasPending(),
          contentRevision: fileSaveCoordinator.getRevision(id),
        }
      }
      if (event?.documentChanged !== false && compositionDirtyRef.current) {
        compositionDirtyRef.current.documentChanged = true
      }
      if (event?.composing === false && compositionDirtyRef.current) {
        const composition = compositionDirtyRef.current
        compositionDirtyRef.current = null
        if (!composition.documentChanged && !composition.hadPending) {
          snapshotPublisher.cancel()
          if (
            !composition.wasDirty &&
            !editorSnapshotRegistry.hasPending(id) &&
            composition.contentRevision === fileSaveCoordinator.getRevision(id)
          ) {
            useEditorStateStore.getState().setIdStateMap(id, { hasUnsavedChanges: false })
          }
          editorSnapshotRegistry.updateVisibility(id)
          if (
            autosave &&
            getFileObject(id)?.path &&
            useEditorStateStore.getState().idStateMap.get(id)?.hasUnsavedChanges
          )
            debounceSaveHandler()
          interactionStartedAtRef.current = undefined
          interactionOpenRequestIdRef.current = undefined
          return
        }
      }

      if (event?.documentChanged === false && !event.composing && !snapshotPublisher.hasPending()) {
        interactionStartedAtRef.current = undefined
        interactionOpenRequestIdRef.current = undefined
        return
      }

      if (event?.documentChanged !== false || event?.composing) {
        useEditorStateStore.getState().setIdStateMap(id, {
          hasUnsavedChanges: true,
        })
      }
      if (event?.documentChanged !== false) {
        editorSnapshotRegistry.changed(id, instanceIdRef.current!)
        protectLocalEdit(id)
      }
      if (event?.documentChanged !== false && activeRef.current) {
        capricornStatisticsScheduler.schedule(capricornRuntimeAdapterRef.current)
      }
      // React detaches imperative refs before the parent's final snapshot flush.
      const editor = capricornEditorRef.current
      const snapshot: PendingEditorSnapshot = {
        documentSize: latestContentRef.current?.length ?? 0,
        getMarkdown: () => {
          if (editor?.isComposing()) throw new Error('Finish composing before using this action.')
          return editor?.getMarkdown() ?? latestContentRef.current ?? ''
        },
        kind: 'capricorn',
        mode: 'coalesced',
      }
      snapshotPublisher.stage(snapshot)
      if (event?.composing || editor?.isComposing()) {
        debounceSave.cancel()
      } else {
        if (!event?.pending && hasVisibleSiblingRef.current) snapshotPublisher.resume()
        if (autosave && getFileObject(id)?.path) debounceSaveHandler()
      }
      if (event?.composing !== undefined) editorSnapshotRegistry.updateVisibility(id)
      // Visible feedback is measured from the editor DOM mutation. Retain the
      // same start separately until the intentionally debounced model commit.
      if (!event?.pending) {
        recordEditorInteractionMeasurement(
          id,
          interactionStartedAtRef.current,
          groupId,
          'commit',
          interactionOpenRequestIdRef.current,
        )
        interactionStartedAtRef.current = undefined
        interactionOpenRequestIdRef.current = undefined
      }
    },
    [
      autosave,
      debounceSave,
      debounceSaveHandler,
      externalChangeResolving,
      groupId,
      id,
      savePathReserved,
      snapshotPublisher,
      capricornStatisticsScheduler,
    ],
  )

  const { library: snippetLibrary } = useSnippetLibrary()
  const snippetOptions = useMemo(
    () => ({
      items: getVisibleSnippets(snippetLibrary, (key) => t(key)),
      onManage: (kind: CapricornSnippetKind) => {
        void commandRegistry.execute(EVENT.app_openSetting, {
          category: 'snippets',
          snippetKind: kind,
        })
      },
    }),
    [snippetLibrary, t],
  )

  const capricornRuntimeOptions = useMemo<
    Omit<CapricornRuntimeOptions, 'autoFocus' | 'markdown' | 'onError'>
  >(() => {
    const hostOptions = getOrCreateDelegateOptions(curFile.id)
    const generateCopilotText = hostOptions.ai?.copilot?.generateText

    return {
      snippets: snippetOptions,
      clipboard: capricornClipboard,
      commands: capricornClipboardCommands,
      keybindingConfiguration: createCapricornKeybindingConfiguration(
        editorKeybingMap,
        editorKeybindingsLoaded,
      ),
      onClipboardResult: handleCapricornClipboardResult,
      colorScheme: editorColorScheme,
      copilot: generateCopilotText
        ? {
            generateText: ({ currentBlockAfter, currentBlockBefore, nextBlock, previousBlock }) =>
              generateCopilotText({
                context: {
                  nextParagraph: nextBlock || null,
                  nodeType: 'paragraph',
                  prevParagraph: previousBlock || null,
                  textAfter: currentBlockAfter,
                  textBefore: currentBlockBefore,
                },
              }),
          }
        : false,
      density: 'compact',
      codeBlockLineWrapping,
      linkEditMode,
      handleLinkClick: async (href) => {
        const opened = await openEditorLink(href, curFile.id)
        if (!opened) toast.warning(i18n.t('link_editing.open_failed'))
      },
      handleViewImgSrcUrl: hostOptions.handleViewImgSrcUrl,
      imageInsertHandler: hostOptions.imageInsertHandler,
      imagePasteHandler: hostOptions.imagePasteHandler,
      localization: capricornLocalization,
      mode: currentViewType === EditorViewType.PREVIEW ? 'preview' : 'edit',
      placeholder: { enabled: editorPlaceholder },
      readOnly: savePathReserved || externalChangeResolving,
      spellCheck: wysiwygEditorSpellcheck,
      style: {
        '--cap-editor-content-width': 'var(--mf-reader-content-width)',
        fontSize: themeFontSize,
        lineHeight: wysiwygRootLineHeight,
        // Preserve the runtime's 14px code / 16px body ratio as text scales.
        '--cap-code-font-size': `calc(${themeFontSize} * 0.875)`,
      },
      typewriter: { enabled: editorTypewriterScroll },
      uploadImageHandler:
        hostOptions.uploadImageHandler as CapricornRuntimeOptions['uploadImageHandler'],
      virtualize: CAPRICORN_DESKTOP_VIRTUALIZE_OPTIONS,
    }
  }, [
    snippetOptions,
    linkEditMode,
    codeBlockLineWrapping,
    curFile.id,
    currentViewType,
    editorColorScheme,
    editorKeybingMap,
    editorKeybindingsLoaded,
    editorPlaceholder,
    themeFontSize,
    wysiwygRootLineHeight,
    editorTypewriterScroll,
    externalChangeResolving,
    savePathReserved,
    wysiwygEditorSpellcheck,
  ])

  const handleCapricornError = useCallback(
    (error: unknown) => {
      if (activeRef.current && visibleRef.current) markStartupInteractive('error')
      cliRuntimeErrorRef.current = String(error)
      if (activeRef.current) reportEditorSearchLoadFailure(id, groupId)
      finishEditorOpenMeasurement(getEditorOpenMeasurement(id, groupId), 'error')
      captureException(error)
      logger.error('Capricorn editor runtime error', error)
    },
    [groupId, id],
  )

  const handleCapricornOpenProgress = useCallback(
    (progress: CapricornRuntimeProgress, identity: CapricornRuntimeRequestIdentity) => {
      if (currentViewTypeRef.current !== EditorViewType.WYSIWYG) return
      // The file-read, tab-switch or retry path owns measurement creation.
      // Late progress from the pane's previously visible file must not cancel
      // and replace the newer file's request.
      const requestId = getEditorOpenMeasurement(id, groupId)
      if (identity.contentRevision !== fileSaveCoordinator.getRevision(id)) return
      if (progress.stage === 'module-ready') {
        recordEditorOpenContent(requestId, latestContentRef.current ?? '', { onlyIfMissing: true })
      }
      recordEditorOpenStage(requestId, progress.stage, {
        contentRevision: identity.contentRevision,
        mode: EditorViewType.WYSIWYG,
        runtimeVersion: capricornRuntimeVersion,
        runtimeEntrySha256: capricornRuntimeEntrySha256,
        runtimeElapsedMs: progress.elapsedMs,
        durationMs: progress.durationMs,
        ...(progress.moduleState !== undefined ? { moduleState: progress.moduleState } : {}),
        ...(progress.blockCount !== undefined ? { blockCount: progress.blockCount } : {}),
      })
    },
    [groupId, id],
  )

  const handleCapricornRuntimeReady = useCallback(
    (container: HTMLElement, identity: CapricornRuntimeRequestIdentity) => {
      cliRuntimeErrorRef.current = undefined
      if (!visibleRef.current) return
      if (activeRef.current) {
        capricornStatisticsScheduler.schedule(capricornRuntimeAdapterRef.current)
      }
      if (currentViewTypeRef.current !== EditorViewType.WYSIWYG) return
      const requestId = getEditorOpenMeasurement(id, groupId)
      recordEditorOpenContent(requestId, latestContentRef.current ?? '', { onlyIfMissing: true })
      recordEditorOpenStage(requestId, 'runtime-ready', {
        contentRevision: identity.contentRevision,
        mode: EditorViewType.WYSIWYG,
        runtimeVersion: capricornRuntimeVersion,
        runtimeEntrySha256: capricornRuntimeEntrySha256,
      })
      stopFirstPaintObservationRef.current?.()
      stopFirstPaintObservationRef.current = observeEditorFirstPaint({
        requestId,
        fileId: id,
        container,
        isCurrent: () =>
          visibleRef.current &&
          getEditorOpenMeasurement(id, groupId) === requestId &&
          container.dataset.mfCapricornRuntimeRequest === String(identity.runtimeRequestSequence),
        onBeforeInput: () => {
          interactionStartedAtRef.current = startEditorInteractionMeasurement()
          interactionOpenRequestIdRef.current = requestId
        },
      })
    },
    [capricornStatisticsScheduler, groupId, id],
  )

  const handleCapricornRetry = useCallback(() => {
    cliRuntimeErrorRef.current = undefined
    beginEditorOpenMeasurement(id, {
      viewId: groupId,
      origin: 'command',
      kind: 'open',
    })
  }, [groupId, id])

  useEffect(() => {
    if (!active || !visible || !isCapricornView(currentViewType)) {
      capricornStatisticsScheduler.cancel()
    }
  }, [active, capricornStatisticsScheduler, currentViewType, visible, isCapricornView])

  useEffect(() => {
    if (!visible) {
      interactionStartedAtRef.current = undefined
      interactionOpenRequestIdRef.current = undefined
      stopFirstPaintObservationRef.current?.()
      finishEditorOpenMeasurement(getEditorOpenMeasurement(id, groupId), 'canceled')
    } else if (currentViewType !== EditorViewType.WYSIWYG) {
      const requestId = getEditorOpenMeasurement(id, groupId)
      recordEditorOpenStage(requestId, 'outside-wysiwyg-scope', { mode: currentViewType })
      finishEditorOpenMeasurement(requestId, 'unverified')
    }
  }, [active, currentViewType, groupId, id, visible])

  useEffect(
    () => () => {
      stopFirstPaintObservationRef.current?.()
      finishEditorOpenMeasurement(getEditorOpenMeasurement(id, groupId), 'canceled')
    },
    [groupId, id],
  )

  const handleCapricornUnavailable = useCallback(
    (error: unknown) => {
      handleCapricornError(error)
      if (activeRef.current) {
        bus.emit('editor_toggle_type', undefined, EditorViewType.SOURCECODE)
      }
    },
    [handleCapricornError],
  )

  const handleCapricornEditorChange = useCallback(
    (editor: CapricornRuntimeAdapter | null) => {
      const instanceId = instanceIdRef.current!
      capricornRuntimeAdapterRef.current = editor
      setResumeCapricorn(editor)
      if (editor) {
        registerCapricornEditorResource(id, instanceId, editor, activeRef.current)
      } else {
        capricornStatisticsScheduler.cancel()
        unregisterCapricornEditorResource(id, instanceId)
      }
    },
    [capricornStatisticsScheduler, id],
  )

  useEffect(() => {
    if (!filePath || !visible || status !== TextEditorStatus.SUCCESS) return
    const options = {
      path: filePath,
      group: groupId ?? '',
      isVisible: () => visibleRef.current,
      shouldRestore: () => {
        const navigation = useEditorSearchStore.getState().navigation
        return navigation?.fileId !== id || navigation.groupId !== groupId
      },
    }
    if (currentViewType === EditorViewType.SOURCECODE && resumeSource?.cm?.dom.isConnected) {
      return bindSourceEditorResume(resumeSource.cm, options)
    }
    const resume = resumeCapricorn?.resume
    const container = editorWrapperRef.current?.querySelector<HTMLElement>(
      '[data-mf-capricorn-runtime]',
    )
    if (!isCapricornView(currentViewType)) {
      if (currentViewType !== EditorViewType.PREVIEW || !editorWrapperRef.current) return
      return bindEditorResume({
        ...options,
        container: editorWrapperRef.current,
        mode: 'preview',
        isComposing: () => false,
        captureSelection: () => undefined,
        restoreSelection: () => {},
        subscribeSelection: () => () => {},
      })
    }
    if (!resume || !container) return
    return bindEditorResume({
      ...options,
      container,
      mode: currentViewType === EditorViewType.PREVIEW ? 'preview' : 'edit',
      isComposing: () => resumeCapricorn.isComposing(),
      captureSelection: () =>
        currentViewType === EditorViewType.PREVIEW ? undefined : resume.capture(),
      restoreSelection: (selection) => {
        if (currentViewType !== EditorViewType.PREVIEW) resume.restore(selection)
      },
      subscribeSelection: resume.subscribe,
      waitForResources: () => resumeCapricorn.waitForResources(),
    })
  }, [
    currentViewType,
    filePath,
    groupId,
    id,
    resumeCapricorn,
    resumeSource,
    status,
    visible,
    isCapricornView,
  ])

  const openingFailed =
    !!rmeLoadError ||
    (status !== TextEditorStatus.LOADING && status !== TextEditorStatus.SUCCESS)
  const openingPending =
    !openingFailed &&
    (typeof content !== 'string' ||
      (needsRmeRuntime && !rmeRuntime) ||
      (isCapricornView(currentViewType)
        ? runtimePending
        : currentViewType === EditorViewType.SOURCECODE
          ? !resumeSource
          : false))
  useLayoutEffect(() => {
    onLoadingChange?.(openingPending)
  }, [onLoadingChange, openingPending])

  useEffect(() => {
    if (!active || !visible || openingPending) return
    if (openingFailed) {
      markStartupInteractive('error')
      return
    }
    if (currentViewType === EditorViewType.PREVIEW) {
      markStartupInteractive('preview')
      return
    }
    const container = editorWrapperRef.current
    if (!container) return
    return observeStartupEditable(
      container,
      () => activeRef.current && visibleRef.current && currentViewTypeRef.current === currentViewType,
      () => recordStartupEditor({
        fileId: id, viewId: groupId, mode: currentViewType,
        openRequestId: getEditorOpenMeasurement(id, groupId),
      }),
      !latestContentRef.current?.trim(),
    )
  }, [active, currentViewType, groupId, id, openingFailed, openingPending, visible])

  useLayoutEffect(() => {
    automationHandleRef.current = {
      save: (expectedContent) => saveHandler({ active: true, expectedContent }),
      inspect: () => ({
        active: activeRef.current,
        visible:
          visibleRef.current &&
          !!editorWrapperRef.current?.isConnected &&
          document.visibilityState !== 'hidden',
        ready:
          !openingPending &&
          !openingFailed &&
          !needsMountedContentSyncRef.current &&
          (isCapricornView(currentViewType)
            ? !!capricornRuntimeAdapterRef.current
            : currentViewType === EditorViewType.SOURCECODE
              ? !!resumeSource &&
                sourceCodeViewRegistry.get(id, instanceIdRef.current!) === resumeSource &&
                resumeSource.cm.dom.isConnected
              : (isHtml || !!editorRef.current) &&
                !!editorWrapperRef.current?.querySelector('.mf-preview-content') &&
                !editorWrapperRef.current?.querySelector('.mf-preview-loading')),
        mode: currentViewType,
        error: rmeLoadError
          ? rmeLoadError.message
          : openingFailed
            ? `File loading failed (${TextEditorStatus[status]}).`
            : isCapricornView(currentViewType)
              ? cliRuntimeErrorRef.current
              : editorWrapperRef.current?.querySelector('.mf-preview-error')?.textContent || undefined,
      }),
      readContent: () => {
        editorSnapshotRegistry.flushForRead(id)
        if (isCapricornView(currentViewType)) {
          if (!capricornRuntimeAdapterRef.current) throw new Error('Editor is not ready.')
          return capricornRuntimeAdapterRef.current.getMarkdown()
        }
        if (currentViewType === EditorViewType.SOURCECODE) {
          if (!resumeSource) throw new Error('Source editor is not ready.')
          return resumeSource.content
        }
        if (typeof content !== 'string') throw new Error('Preview is not ready.')
        return content
      },
      preview: () => {
        if (currentViewType === EditorViewType.PREVIEW) return
        if (!fileTypeConfig.supportedModes.includes(EditorViewType.PREVIEW))
          throw new Error('Preview is unavailable for this file type.')
        if (isHtml) {
          switchHtmlView(EditorViewType.PREVIEW)
          return
        }
        editorSnapshotRegistry.flushForRead(id)
        const markdown = automationHandleRef.current!.readContent()
        clearSwitchingEditorContextResource(id, instanceIdRef.current!)
        unregisterSourceCodeViewResource(id, instanceIdRef.current!)
        if (isCapricornView(EditorViewType.PREVIEW)) {
          unregisterRmeEditorResources(id, instanceIdRef.current!)
          editorContextRef.current = null
          setDelegate(null)
        } else {
          editorRef.current?.toggleType(EditorViewType.PREVIEW)
        }
        setContent(markdown)
        useEditorViewTypeStore.getState().setEditorViewType(id, EditorViewType.PREVIEW)
        setCurrentViewType(EditorViewType.PREVIEW)
      },
      render: async (format) => {
        const markdown = automationHandleRef.current!.readContent()
        if (format === 'markdown') return new TextEncoder().encode(markdown)
        const capricorn = isCapricornView(currentViewType) ? capricornEditorRef.current : null
        if (format === 'text' || format === 'json') {
          if (!capricorn)
            throw new Error('This export format requires the Markdown preview or editor.')
          return new TextEncoder().encode(await capricorn.export(format))
        }
        if (format === 'html') {
          if (capricorn) await capricorn.waitForResources()
          else await waitForEditorResourcesForExport(editorRef.current)
          const html = capricorn
            ? await capricorn.export('html')
            : await editorRef.current?.exportHtml()
          if (typeof html !== 'string') throw new Error('HTML renderer is unavailable.')
          return new TextEncoder().encode(
            exportHtmlDocument(html, editorWrapperRef.current, curFile.name),
          )
        }
        let dispose: (() => void) | undefined
        let restore: (() => void) | undefined
        try {
          let element: HTMLElement | null
          if (capricorn) {
            const surface = await capricorn.createExportSurface(markdown)
            element = surface.element
            dispose = surface.dispose
          } else {
            await waitForEditorResourcesForExport(editorRef.current)
            element = editorWrapperRef.current
          }
          if (!element) throw new Error('Image renderer is unavailable.')
          restore = await prepareResourcesForExport(
            element,
            getFolderPathFromPath(getFileObject(id)?.path),
          )
          return new Uint8Array(
            canvasDataToBinary(await renderElementToImageDataUrl(element, true)),
          )
        } finally {
          try {
            restore?.()
          } finally {
            dispose?.()
          }
        }
      },
    }
  })

  useEffect(
    () =>
      editorAutomationRegistry.register(id, instanceIdRef.current!, {
        save: (expectedContent) => automationHandleRef.current!.save!(expectedContent),
        inspect: () => automationHandleRef.current!.inspect(),
        readContent: () => automationHandleRef.current!.readContent(),
        preview: () => automationHandleRef.current!.preview(),
        render: (format) => automationHandleRef.current!.render(format),
      }),
    [id],
  )

  const getExportContent = useCallback(() => {
    return useEditorStore.getState().getEditorContent(id)
  }, [id])

  if (status === TextEditorStatus.NOTEXIST) {
    return <WarningHeader>{t('file.not_found')}</WarningHeader>
  }

  if (status === TextEditorStatus.READERROR) {
    return <WarningHeader>{t('file.read_failed')}</WarningHeader>
  }

  if (status === TextEditorStatus.BINARY) {
    return <WarningHeader>{t('file.binary_not_openable')}</WarningHeader>
  }

  if (rmeLoadError) {
    return (
      <AsyncSurface
        retryLabel={t('common.retry')}
        state={{
          status: 'error',
          title: t('document_preview.load_failed'),
          description: rmeLoadError.message,
          retry: retryRmeRuntime,
        }}
      >
        {() => null}
      </AsyncSurface>
    )
  }

  if (typeof content !== 'string') {
    return null
  }
  if (
    (needsRmeRuntime && !rmeRuntime) ||
    (!delegate && currentViewType === EditorViewType.SOURCECODE)
  ) {
    return (
      <AsyncSurface state={{ status: 'loading', label: t('document_preview.loading') }}>
        {() => null}
      </AsyncSurface>
    )
  }

  const cls = classNames('markdown-body', {
    'editor-active': active,
  })

  return (
    <>
      <EditorWrapper
        ref={editorWrapperRef}
        id='editorarea-wrapper'
        className={cls}
        $editorViewType={currentViewType}
        $fileType={fileTypeConfig.type}
        $fullWidth={editorFullWidth}
        $rootLineHeight={wysiwygRootLineHeight}
        $visible={visible}
        onBeforeInputCapture={handleBeforeInputCapture}
        onClick={handleWrapperClick}
      >
        <AppEditorThemeProvider>
          {isHtml ? (
            <>
              {delegate && MfEditor && rmeRuntime ? (
                <div
                  style={{
                    display: currentViewType === EditorViewType.SOURCECODE ? undefined : 'none',
                  }}
                >
                  <RmeThemeProvider runtime={rmeRuntime}>
                    <AppEditorThemeProvider>
                      <MfEditor ref={editorRef} onChange={handleChange} {...editorProps} />
                    </AppEditorThemeProvider>
                  </RmeThemeProvider>
                </div>
              ) : null}
              {currentViewType === EditorViewType.PREVIEW && visible ? (
                <PreviewBoundary>
                  <HtmlPreview content={content} filePath={filePath} />
                </PreviewBoundary>
              ) : null}
            </>
          ) : isCapricornView(currentViewType) ? (
            <CapricornEditor
              active={active}
              contentRevision={fileSaveCoordinator.getRevision(id)}
              visible={visible}
              editorId={id}
              initialMarkdown={content}
              onLoadingChange={setRuntimePending}
              onChange={handleCapricornChange}
              onError={handleCapricornError}
              onOpenProgress={handleCapricornOpenProgress}
              onRetry={handleCapricornRetry}
              onRuntimeReady={handleCapricornRuntimeReady}
              onEditorChange={handleCapricornEditorChange}
              onUnavailable={handleCapricornUnavailable}
              options={capricornRuntimeOptions}
              ref={capricornEditorRef}
            />
          ) : MfEditor && rmeRuntime ? (
            <RmeThemeProvider runtime={rmeRuntime}>
              <AppEditorThemeProvider>
                <MfEditor ref={editorRef} onChange={handleChange} {...editorProps} />
              </AppEditorThemeProvider>
            </RmeThemeProvider>
          ) : null}
        </AppEditorThemeProvider>
      </EditorWrapper>
      <PdfPrintController
        active={active}
        enabled={fileTypeConfig.type === 'markdown'}
        fileName={curFile.name}
        getContent={getExportContent}
        delegateOptions={editorProps.delegateOptions!}
        styleToken={editorProps.styleToken}
      />
      <PandocExportController
        active={active}
        enabled={fileTypeConfig.type === 'markdown'}
        fileName={curFile.name}
        filePath={curFile.path}
        getContent={getExportContent}
      />
    </>
  )
}

export interface TextEditorProps {
  onLoadingChange?: (pending: boolean) => void
  id: string
  groupId?: string
  active: boolean
  visible?: boolean
  fileTypeConfig: FileTypeConfig
  onSave?: () => void
}

export default memo(TextEditor)
