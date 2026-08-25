import { commandRegistry } from '@/commands'
import { AppEditorThemeProvider } from '@/AppThemeProvider'
import { EVENT } from '@/constants'
import { clipboardRead } from '@/helper/clipboard'
import { countNonWhitespaceCharacters } from '@/helper/editorCounter'
import bus from '@/helper/eventBus'
import {
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
import { FileTypeConfig } from '@/helper/fileTypeHandler'
import { getExportableImageSrc } from '@/helper/image'
import { logger } from '@/helper/logger'
import {
  comparePathRelation,
  findPathCollisions,
  memoizePathRelationResolver,
  type PathRelationResolver,
} from '@/helper/physicalPathIdentity'
import { useEditorKeybindingStore } from '@/hooks/useKeyboard'
import { useTranslation } from '@/i18n'
import { captureException } from '@/services/error-reporting'
import { useEditorStateStore, useEditorStore } from '@/stores'
import useAppSettingStore from '@/stores/useAppSettingStore'
import useEditorCounterStore from '@/stores/useEditorCounterStore'
import useEditorViewTypeStore from '@/stores/useEditorViewTypeStore'
import useExternalFileChangeStore, {
  isExternalFileSaveBlocked,
} from '@/stores/useExternalFileChangeStore'
import { invoke } from '@tauri-apps/api/core'
import { save } from '@tauri-apps/plugin-dialog'
import classNames from 'classnames'
import { debounce, DebouncedFunc, throttle } from 'lodash'
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { flushSync } from 'react-dom'
import { useUnmount } from 'react-use'
import type { CreateWysiwygDelegateOptions, EditorDelegate } from 'rme'
import {
  createSourceCodeDelegate,
  createWysiwygDelegate,
  EditorChangeEventParams,
  EditorChangeHandler,
  EditorContext,
  EditorRef,
  EditorViewType,
  MfCodemirrorView,
  Editor as MfEditor,
  EditorProps as MfEditorProps,
} from 'rme'
import { toast } from 'zens'
import {
  createWysiwygDelegateOptions,
  getCurrentEditorInsertDateFormat,
  normalizeLivePreviewBlockBehavior,
} from './createWysiwygDelegateOptions'
import { closeCleanPhysicalAliases } from './closeCleanPhysicalAliases'
import { createDeferredLatestPublisher } from './deferredLatestPublisher'
import {
  measureEditorSnapshot,
  recordEditorInteractionMeasurement,
  shouldCoalesceEditorSnapshots,
  startEditorInteractionMeasurement,
} from './editorPerformanceDiagnostics'
import { EditorWrapper } from './EditorWrapper'
import {
  conditionalWriteExpectedIfAllowed,
  getFileWriteRevision,
} from './conditionalFileWrite'
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
import { PdfPrintController } from './pdf-print/PdfPrintController'
import { PandocExportController } from './pandoc-export/PandocExportController'
import { EditorSkeleton, WarningHeader } from './styles'

const delegateOptionsCache = new Map<string, CreateWysiwygDelegateOptions>()
const LARGE_MARKDOWN_SOURCE_MODE_THRESHOLD = 200_000
const TEXT_EDITOR_CONTENT_SYNC_EVENT = 'editor_content_sync'
const EXPORT_RESOURCE_TIMEOUT_MS = 15_000
const EDITOR_SNAPSHOT_DEBOUNCE_MS = 50
const EDITOR_SNAPSHOT_MAX_WAIT_MS = 250
const editorInstanceLifecycle = new EditorInstanceLifecycle()
let textEditorInstanceSeq = 0
type Html2Canvas = (typeof import('html2canvas'))['default']
let html2canvasPromise: Promise<Html2Canvas> | undefined

interface TextEditorContentSyncPayload {
  fileId: string
  sourceInstanceId: string
  content: string
}

interface PendingEditorSnapshot {
  delegate: EditorDelegate
  doc: EditorChangeEventParams['state']['doc']
  mode: 'coalesced' | 'immediate'
}

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

export const sourceCodeCodemirrorViewMap: Map<string, MfCodemirrorView> = new Map()

const editorDelegateRegistry = new InstanceResourceRegistry<EditorDelegate<any>>()
const editorContextRegistry = new InstanceResourceRegistry<EditorContext>()
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

function registerEditorContextResource(
  fileId: string,
  instanceId: string,
  context: EditorContext,
  shouldPromote: boolean,
) {
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
    (current) => sourceCodeCodemirrorViewMap.set(fileId, current),
  )
}

function promoteEditorInstanceResources(fileId: string, instanceId: string) {
  const store = useEditorStore.getState()
  const delegate = editorDelegateRegistry.promote(fileId, instanceId)
  const context = editorContextRegistry.promote(fileId, instanceId)
  const sourceCodeView = sourceCodeViewRegistry.promote(fileId, instanceId)

  if (delegate === undefined) store.clearEditorDelegate(fileId)
  else store.setEditorDelegate(fileId, delegate)

  if (context === undefined) store.clearEditorCtx(fileId)
  else store.setEditorCtx(fileId, context)

  if (sourceCodeView === undefined) sourceCodeCodemirrorViewMap.delete(fileId)
  else sourceCodeCodemirrorViewMap.set(fileId, sourceCodeView)

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
    (current) => sourceCodeCodemirrorViewMap.set(fileId, current),
    () => sourceCodeCodemirrorViewMap.delete(fileId),
  )
}

function clearSwitchingEditorContextResource(fileId: string, instanceId: string) {
  const switchingContext = editorContextRegistry.get(fileId, instanceId)
  const store = useEditorStore.getState()

  if (switchingContext && store.getEditorCtx(fileId) === switchingContext) {
    store.clearEditorCtx(fileId)
  }
}

function unregisterEditorInstanceResources(fileId: string, instanceId: string) {
  const delegateRemoval = editorDelegateRegistry.remove(fileId, instanceId)
  const contextRemoval = editorContextRegistry.remove(fileId, instanceId)
  const sourceCodeViewRemoval = sourceCodeViewRegistry.remove(fileId, instanceId)

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
    (current) => sourceCodeCodemirrorViewMap.set(fileId, current),
    () => sourceCodeCodemirrorViewMap.delete(fileId),
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

async function renderElementToImageDataUrl(element: HTMLElement) {
  const html2canvas = await loadHtml2Canvas()
  const html2canvasOptions: Parameters<Html2Canvas>[1] = {
    allowTaint: false,
    foreignObjectRendering: false,
    imageTimeout: EXPORT_RESOURCE_TIMEOUT_MS,
    logging: false,
    useCORS: true,
    ignoreElements: (candidate: Element) => candidate.tagName.toLowerCase() === 'iframe',
  }

  try {
    const canvas = await html2canvas(element, html2canvasOptions)
    return canvasToExportDataUrl(canvas)
  } catch (error) {
    if (!isSecurityError(error)) {
      throw error
    }
  }

  logger.warn('Canvas was tainted during image export, retrying without media resources.')

  try {
    const fallbackCanvas = await html2canvas(element, {
      ...html2canvasOptions,
      ignoreElements: ignoreRiskyExportElement,
      onclone: sanitizeClonedExportDocument,
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

function TextEditor(props: TextEditorProps) {
  const { id, active, visible = active, fileTypeConfig } = props
  const cachedFile = getFileObject(id)
  const lastKnownFileRef = useRef<IFile | undefined>(cachedFile)
  if (cachedFile) {
    lastKnownFileRef.current = cachedFile
  }
  const curFile = cachedFile ?? lastKnownFileRef.current!
  const instanceIdRef = useRef<string | undefined>(undefined)
  if (!instanceIdRef.current) {
    textEditorInstanceSeq += 1
    instanceIdRef.current = `text-editor-${textEditorInstanceSeq}`
  }
  const activeRef = useRef(active)
  activeRef.current = active
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
    (editorViewType = EditorViewType.WYSIWYG, sourceCodeLanguage?: string) => {
      const currentSettingData = useAppSettingStore.getState().settingData
      if (editorViewType === 'sourceCode') {
        return createSourceCodeDelegate({
          language: sourceCodeLanguage,
          disableAllBuildInShortcuts: true,
          overrideShortcutMap: useEditorKeybindingStore.getState().editorKeybingMap,
          clipboardReadFunction: clipboardRead,
          currentDateFormat: getCurrentEditorInsertDateFormat,
          onCodemirrorViewLoad: (cmView) => {
            registerSourceCodeViewResource(id, instanceIdRef.current!, cmView, activeRef.current)
          },
          typewriterScroll: {
            enabled: currentSettingData.editor_typewriter_scroll,
          },
        })
      } else {
        return createWysiwygDelegate(getOrCreateDelegateOptions(id))
      }
    },
    [id],
  )
  const [status, setStatus] = useState(TextEditorStatus.LOADING)

  const insertNodeToFolderData = useEditorStore((state) => state.insertNodeToFolderData)
  const { t } = useTranslation()
  const autosave = useAppSettingStore((state) => state.settingData.autosave)
  const autosaveInterval = useAppSettingStore((state) => state.settingData.autosave_interval)
  const editorFullWidth = useAppSettingStore((state) => state.settingData.editor_full_width)
  const editorPlaceholder = useAppSettingStore((state) => state.settingData.editor_placeholder)
  const editorRootFontSize = useAppSettingStore((state) => state.settingData.editor_root_font_size)
  const editorRootLineHeight = useAppSettingStore(
    (state) => state.settingData.editor_root_line_height,
  )
  const editorTypewriterScroll = useAppSettingStore(
    (state) => state.settingData.editor_typewriter_scroll,
  )
  const livePreviewBlockBehavior = useAppSettingStore((state) =>
    normalizeLivePreviewBlockBehavior(
      state.settingData.wysiwyg_editor_live_preview_block_behavior,
    ),
  )
  const sourceCodeEditorSpellcheck = useAppSettingStore(
    (state) => state.settingData.source_code_editor_spellcheck,
  )
  const wysiwygEditorSpellcheck = useAppSettingStore(
    (state) => state.settingData.wysiwyg_editor_spellcheck,
  )
  const externalChangeState = useExternalFileChangeStore((state) => {
    const notice = state.notices[id]
    if (notice?.kind !== 'conflict') return 'none'
    return notice.resolving ?? 'pending'
  })
  const externalChangeResolving =
    externalChangeState === 'reload' || externalChangeState === 'overwrite'
  const [currentViewType, setCurrentViewType] = useState<EditorViewType>(fileTypeConfig.defaultMode)
  const [content, setContent] = useState<string | undefined>()
  const [delegate, setDelegate] = useState<ReturnType<typeof createDelegate> | null>(null)
  const effectiveDefaultViewType = useMemo(() => {
    if (
      fileTypeConfig.type === 'markdown' &&
      fileTypeConfig.defaultMode === EditorViewType.WYSIWYG &&
      typeof content === 'string' &&
      content.length > LARGE_MARKDOWN_SOURCE_MODE_THRESHOLD &&
      fileTypeConfig.supportedModes.includes(EditorViewType.SOURCECODE)
    ) {
      return EditorViewType.SOURCECODE
    }

    return fileTypeConfig.defaultMode
  }, [content, fileTypeConfig])

  const debounceSaveHandlerCacheRef = useRef<DebouncedFunc<() => Promise<boolean>>>(null)
  const noFileSaveingRef = useRef(false)
  const editorRef = useRef<TextEditorRef>(null)
  const editorContextRef = useRef<EditorChangeEventParams>(null)
  const counterIdleHandleRef = useRef<number | null>(null)
  const isApplyingRemoteContentRef = useRef(false)
  const latestContentRef = useRef<string | undefined>(undefined)
  const remoteContentResetHandleRef = useRef<number | null>(null)
  const rejectedReservedChangeRef = useRef(false)
  const wasSavePathReservedRef = useRef(false)
  const interactionStartedAtRef = useRef<number | undefined>(undefined)
  const isUnmountingRef = useRef(false)
  const publishEditorSnapshotRef = useRef<(snapshot: PendingEditorSnapshot) => boolean>(
    () => false,
  )
  const snapshotPublisher = useMemo(
    () =>
      createDeferredLatestPublisher(
        (snapshot: PendingEditorSnapshot) => publishEditorSnapshotRef.current(snapshot),
        {
          wait: EDITOR_SNAPSHOT_DEBOUNCE_MS,
          maxWait: EDITOR_SNAPSHOT_MAX_WAIT_MS,
        },
      ),
    [],
  )

  useEffect(() => {
    isUnmountingRef.current = false
    return () => {
      isUnmountingRef.current = true
      snapshotPublisher.flush()
      snapshotPublisher.cancel()
    }
  }, [snapshotPublisher])

  useUnmount(() => {
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
        void fileSaveCoordinator.releaseWhenIdle(
          id,
          () => !editorInstanceLifecycle.hasInstances(id),
          () => {
            useEditorCounterStore.getState().deleteEditorCounter({ id })
            useEditorStateStore.getState().delIdStateMap(id)
            useEditorStore.getState().clearEditorResources(id)
            sourceCodeCodemirrorViewMap.delete(id)
            delegateOptionsCache.delete(id)
            releaseExternalFileChange(id)
          },
        )
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
      if (latestContentRef.current === nextContent) return
      // A newer local edit wins this race. Its pending publication will bring
      // the sibling instance back to the same content.
      if (!force && snapshotPublisher.hasPending()) return

      snapshotPublisher.cancel()
      if (remoteContentResetHandleRef.current !== null) {
        window.clearTimeout(remoteContentResetHandleRef.current)
      }

      isApplyingRemoteContentRef.current = true
      latestContentRef.current = nextContent
      editorRef.current?.setContent(nextContent)
      setContent(nextContent)
      updateCachedFileContent(nextContent)

      remoteContentResetHandleRef.current = window.setTimeout(() => {
        isApplyingRemoteContentRef.current = false
        remoteContentResetHandleRef.current = null
      }, 0)
    },
    [snapshotPublisher, updateCachedFileContent],
  )

  useEffect(() => {
    latestContentRef.current = content
  }, [content])

  useEffect(() => {
    if (!active) {
      snapshotPublisher.flush()
    }
  }, [active, snapshotPublisher])

  useEffect(() => {
    const wasReserved = wasSavePathReservedRef.current
    wasSavePathReservedRef.current = savePathReserved
    if (savePathReserved) {
      snapshotPublisher.flush()
      return
    }
    if (!wasReserved) return
    if (!rejectedReservedChangeRef.current) return
    rejectedReservedChangeRef.current = false

    const cachedContent = getFileObject(id)?.content
    if (typeof cachedContent !== 'string') return

    latestContentRef.current = cachedContent
    editorRef.current?.setContent(cachedContent)
    setContent(cachedContent)
  }, [id, savePathReserved, snapshotPublisher])

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
    }

    bus.on(EXTERNAL_FILE_CONTENT_SYNC_EVENT, handleExternalContentSync)

    return () => {
      bus.detach(EXTERNAL_FILE_CONTENT_SYNC_EVENT, handleExternalContentSync)
    }
  }, [applySyncedContent, id])

  useEffect(() => {
    let canceled = false

    const init = async () => {
      const file = curFile
      const editorState = useEditorStateStore.getState().idStateMap.get(file.id)

      if (editorState?.hasUnsavedChanges && typeof file.content === 'string') {
        fileSaveCoordinator.recordContent(id, file.content)
        setContent(file.content)
        return setStatus(TextEditorStatus.SUCCESS)
      }

      if (file.path) {
        const snapshot = await readStableFileSnapshot(file.path)
        if (canceled) return
        if (snapshot.status === 'unstable') {
          toast.error(t('external_file_change.read_failed'))
          return setStatus(TextEditorStatus.READERROR)
        }
        if (snapshot.status === 'success') {
          fileSaveCoordinator.setDiskRevision(id, snapshot.revision)
          setContent(snapshot.content)
          updateCachedFileContent(snapshot.content)
          return setStatus(TextEditorStatus.SUCCESS)
        }

        const res = snapshot.result
        if (res.code === FileResultCode.NotFound) {
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
        setContent(file.content)
      }

      return setStatus(TextEditorStatus.SUCCESS)
    }
    init()

    return () => {
      canceled = true
    }
  }, [curFile, id, t, updateCachedFileContent])

  useEffect(() => {
    if (status !== TextEditorStatus.SUCCESS || delegate) return
    setCurrentViewType(effectiveDefaultViewType)
    useEditorViewTypeStore.getState().setEditorViewType(id, effectiveDefaultViewType)

    if (effectiveDefaultViewType === EditorViewType.PREVIEW) {
      return
    }

    const newDelegate = createDelegate(effectiveDefaultViewType, fileTypeConfig.type)
    setDelegate(newDelegate)
    registerEditorDelegateResource(id, instanceIdRef.current!, newDelegate, activeRef.current)
  }, [status, delegate, id, fileTypeConfig, effectiveDefaultViewType, createDelegate])

  const saveHandler = useCallback(
    async (params: SaveHandlerParams = {}) => {
      return runSaveOperation(async () => {
        if (!active && !params.active) return false

        const fileBeforeFlush = getFileObject(id) ?? curFile
        if (!fileBeforeFlush) return false

        const curEditorState = useEditorStateStore.getState().idStateMap.get(fileBeforeFlush.id)

        if (!curEditorState?.hasUnsavedChanges) return true
        if (isExternalFileSaveBlocked(id)) return false

        if (!snapshotPublisher.flush()) return false
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
          async ({ content: fileContent }) => {
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
                      title: 'Save File',
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
                      aliasIds: aliasIds.filter((aliasId) =>
                        editorStore.opened.includes(aliasId),
                      ),
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
                      () => !isExternalFileSaveBlocked(id),
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
                  fileSaveCoordinator.setDiskRevision(id, writtenRevision)
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
                      () => !isExternalFileSaveBlocked(id),
                    ),
                })
                if (queuedWrite.status === 'missing-path') return false
                if (queuedWrite.value.status === 'blocked') return false
                if (queuedWrite.value.status === 'conflict') {
                  markExternalFileConflict(id, queuedWrite.value.revision)
                  return false
                }
                fileSaveCoordinator.setDiskRevision(id, queuedWrite.value.revision)
              }

              return true
            } catch (error) {
              toast.error(String(error))
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
          },
          {
            canAttempt: () => !isExternalFileSaveBlocked(id),
          },
        )
      }, params)
    },
    [active, id, delegate, t, insertNodeToFolderData, snapshotPublisher],
  )

  const debounceSave = useMemo(() => {
    return debounce(() => saveHandler({ active: true }), autosaveInterval)
  }, [autosaveInterval, saveHandler])

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
      debounceSave.cancel()
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
      debounceSaveHandlerCacheRef.current?.cancel()

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
      editorRef.current?.setContent(newContent)
      setContent(newContent)
      latestContentRef.current = newContent
      updateCachedFileContent(newContent)

      // Set save state to unsaved after content change
      const { setIdStateMap } = useEditorStateStore.getState()
      setIdStateMap(id, {
        hasUnsavedChanges: true,
      })
      emitContentSync(newContent)
    },
    [
      active,
      emitContentSync,
      externalChangeResolving,
      id,
      savePathReserved,
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
  }, [editorPlaceholder, editorTypewriterScroll, livePreviewBlockBehavior])

  useEffect(() => {
    const cb = throttle(
      (payload: EditorViewType) => {
        if (active) {
          if (editorTypeSwitchingRef.current) {
            return
          }

          if (editorRef.current?.getType() === payload) {
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

              if (payload === EditorViewType.SOURCECODE) {
                const currentSettingData = useAppSettingStore.getState().settingData
                const sourceCodeDelegate = createSourceCodeDelegate({
                  disableAllBuildInShortcuts: true,
                  overrideShortcutMap: useEditorKeybindingStore.getState().editorKeybingMap,
                  clipboardReadFunction: clipboardRead,
                  currentDateFormat: getCurrentEditorInsertDateFormat,
                  onCodemirrorViewLoad: (cmView) => {
                    registerSourceCodeViewResource(
                      curFile.id,
                      instanceIdRef.current!,
                      cmView,
                      activeRef.current,
                    )
                    debounceRefreshToc()
                  },
                  typewriterScroll: {
                    enabled: currentSettingData.editor_typewriter_scroll,
                  },
                })
                registerEditorDelegateResource(
                  curFile.id,
                  instanceIdRef.current!,
                  sourceCodeDelegate,
                  activeRef.current,
                )
                setDelegate(sourceCodeDelegate)
              } else if (payload === EditorViewType.PREVIEW) {
                debounceRefreshToc()
              } else {
                const wysiwygDelegate = createWysiwygDelegate(
                  getOrCreateDelegateOptions(curFile.id),
                )
                registerEditorDelegateResource(
                  curFile.id,
                  instanceIdRef.current!,
                  wysiwygDelegate,
                  activeRef.current,
                )
                setDelegate(wysiwygDelegate)
                debounceRefreshToc()
              }
              useEditorViewTypeStore.getState().setEditorViewType(curFile.id, payload)
              setCurrentViewType(payload)
              editorRef.current?.toggleType(payload)
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
  }, [active, curFile, debounceRefreshToc])

  useEffect(() => {
    const exportImageHandler = async () => {
      if (!active) {
        return
      }

      const file = getFileObject(id)
      if (!file) return

      try {
        const path = await save({
          title: t('contextmenu.editor_tab.export_image'),
          defaultPath: file.name.split('.')?.[0] + '.jpg',
        })
        if (!path) return

        const n = toast.loading(t('contextmenu.editor_tab.export_image') + '...')
        let restoreExportResources: (() => void) | undefined

        try {
          await waitForEditorResourcesForExport(editorRef.current)
          const exportElement = document.getElementById(id)
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
          restoreExportResources?.()
          toast.dismiss(n)
        }
      } catch (error) {
        toast.error(String(error))
      }
    }

    const exportHtmlHandler = async () => {
      if (!active) {
        return
      }

      const file = getFileObject(id)
      if (!file) return

      save({
        title: t('contextmenu.editor_tab.export_html'),
        defaultPath: file.name.split('.')?.[0] + '.html',
      })
        .then(async (path) => {
          if (!path) return

          const n = toast.loading(t('contextmenu.editor_tab.export_html') + '...')
          const res = await editorRef.current?.exportHtml()
          const scStyled = document.head.querySelectorAll('style[data-styled]')

          const html = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Document</title>
  <style>
  ${scStyled[0].innerHTML}
  </style>
  </head>
  <body style="height: 100vh; overflow: auto;">
  <div class="${document.getElementById(id)?.className}">
  ${res}
  </div>
  </body>
  </html>
          `

          invoke('export_html_to_path', { str: html, path }).then(() => {
            toast.dismiss(n)
            toast.success('Exported to ' + path)
          })
        })
        .catch((error) => {
          toast.error(String(error))
        })
    }

    bus.on('editor_export_html', exportHtmlHandler)
    bus.on('editor_export_image', exportImageHandler)
    bus.on('editor_set_content', setContentHandler)

    return () => {
      bus.detach('editor_export_html', exportHtmlHandler)
      bus.detach('editor_export_image', exportImageHandler)
      bus.detach('editor_set_content', setContentHandler)
    }
  }, [active, id, setContentHandler, t])

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
      if (
        currentViewType === EditorViewType.PREVIEW ||
        !delegate ||
        !delegate.manager.mounted
      ) {
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

  const rootFontSize = !editorRootFontSize || editorRootFontSize === 15 ? 16 : editorRootFontSize
  const rootLineHeight =
    !editorRootLineHeight || editorRootLineHeight === '1.6' ? '1.65' : editorRootLineHeight
  const wysiwygRootLineHeight =
    !editorRootLineHeight || editorRootLineHeight === '1.6' ? '1.7' : editorRootLineHeight

  const editorProps: MfEditorProps = useMemo(
    () => ({
      initialType: effectiveDefaultViewType,
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
        rootFontSize: `${rootFontSize}px`,
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
      effectiveDefaultViewType,
      rootFontSize,
      rootLineHeight,
      savePathReserved,
      externalChangeResolving,
    ],
  )
  publishEditorSnapshotRef.current = (snapshot) => {
    try {
      const serialize = () => snapshot.delegate.docToString(snapshot.doc)
      const nextContent =
        snapshot.delegate.view === 'Wysiwyg'
          ? measureEditorSnapshot(id, snapshot.doc.content.size, snapshot.mode, serialize)
          : serialize()

      latestContentRef.current = nextContent
      if (!isUnmountingRef.current) {
        setContent(nextContent)
      }
      updateCachedFileContent(nextContent)
      emitContentSync(nextContent)

      if (!isUnmountingRef.current) {
        if (activeRef.current) {
          debounceRefreshToc()
        }

        const latestFile = getFileObject(id)
        if (autosave && latestFile?.path) {
          debounceSaveHandler()
        }
      }
      return true
    } catch (error) {
      captureException(error)
      return false
    }
  }

  const handleBeforeInputCapture = useCallback(() => {
    interactionStartedAtRef.current = startEditorInteractionMeasurement()
  }, [])

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
            editorRef.current?.setContent(cachedContent)
            setContent(cachedContent)
            rejectedReservedChangeRef.current = false
          })
        }
        interactionStartedAtRef.current = undefined
        return
      }

      if (active && counterIdleHandleRef.current !== null) {
        cancelIdle(counterIdleHandleRef.current)
      }

      if (active) {
        counterIdleHandleRef.current = requestIdle(() => {
          counterIdleHandleRef.current = null
          useEditorCounterStore.getState().addEditorCounter({
            id,
            data: {
              characterCount: helpers.getCharacterCount(),
              nonWhitespaceCharacterCount: countNonWhitespaceCharacters(
                params.state.doc.textContent,
              ),
              wordCount: helpers.getWordCount(),
            },
          })
        })
      }

      if (tr?.docChanged && !tr.getMeta('APPLY_MARKS')) {
        if (isApplyingRemoteContentRef.current || !delegate) {
          interactionStartedAtRef.current = undefined
          return
        }

        useEditorStateStore.getState().setIdStateMap(id, {
          hasUnsavedChanges: true,
          undoDepth: helpers.undoDepth(),
        })

        const coalesce = delegate.view === 'Wysiwyg' && shouldCoalesceEditorSnapshots()
        const snapshot: PendingEditorSnapshot = {
          delegate,
          doc: params.state.doc,
          mode: coalesce ? 'coalesced' : 'immediate',
        }

        snapshotPublisher.schedule(snapshot)
        if (!coalesce) {
          snapshotPublisher.flush()
        }

        recordEditorInteractionMeasurement(id, interactionStartedAtRef.current)
        interactionStartedAtRef.current = undefined
      }
    },
    [id, delegate, active, savePathReserved, snapshotPublisher],
  )

  const getExportContent = useCallback(() => {
    snapshotPublisher.flush()
    return latestContentRef.current ?? content ?? ''
  }, [content, snapshotPublisher])

  if (status === TextEditorStatus.NOTEXIST) {
    return <WarningHeader>File is not exist</WarningHeader>
  }

  if (status === TextEditorStatus.READERROR) {
    return <WarningHeader>Failed to read file content</WarningHeader>
  }

  if (status === TextEditorStatus.BINARY) {
    return <WarningHeader>Binary file cannot be opened as text</WarningHeader>
  }

  if (
    typeof content !== 'string' ||
    (!delegate && effectiveDefaultViewType !== EditorViewType.PREVIEW)
  ) {
    return (
      <EditorSkeleton>
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className='skeleton-line' />
        ))}
      </EditorSkeleton>
    )
  }

  const cls = classNames('markdown-body', {
    'editor-active': active,
  })

  return (
    <>
      <EditorWrapper
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
          <MfEditor ref={editorRef} onChange={handleChange} {...editorProps} />
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
  id: string
  active: boolean
  visible?: boolean
  fileTypeConfig: FileTypeConfig
  onSave?: () => void
}

export default memo(TextEditor)
