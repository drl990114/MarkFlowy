import { commandRegistry } from '@/commands'
import { EVENT } from '@/constants'
import { clipboardRead } from '@/helper/clipboard'
import bus from '@/helper/eventBus'
import {
  delSaveOpenedEditorEntries,
  getFileObject,
  setSaveOpenedEditorEntries,
  updateFileObject,
} from '@/helper/files'
import {
  canvasDataToBinary,
  FileResultCode,
  FileSysResult,
  getFileNameFromPath,
  getFolderPathFromPath,
} from '@/helper/filesys'
import { FileTypeConfig } from '@/helper/fileTypeHandler'
import { getExportableImageSrc } from '@/helper/image'
import { logger } from '@/helper/logger'
import { useEditorKeybindingStore } from '@/hooks/useKeyboard'
import { useTranslation } from '@/i18n'
import { useEditorStateStore, useEditorStore } from '@/stores'
import useAppSettingStore from '@/stores/useAppSettingStore'
import useEditorCounterStore from '@/stores/useEditorCounterStore'
import useEditorViewTypeStore from '@/stores/useEditorViewTypeStore'
import * as Sentry from '@sentry/react'
import { invoke } from '@tauri-apps/api/core'
import { save } from '@tauri-apps/plugin-dialog'
import classNames from 'classnames'
import { debounce, DebouncedFunc, throttle } from 'lodash'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useUnmount } from 'react-use'
import type { CreateWysiwygDelegateOptions } from 'rme'
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
} from './createWysiwygDelegateOptions'
import { EditorWrapper } from './EditorWrapper'
import { EditorSkeleton, WarningHeader } from './styles'

const delegateOptionsCache = new Map<string, CreateWysiwygDelegateOptions>()
const LARGE_MARKDOWN_SOURCE_MODE_THRESHOLD = 200_000
const TEXT_EDITOR_CONTENT_SYNC_EVENT = 'editor_content_sync'
const mountedTextEditorCounts = new Map<string, number>()
const textEditorSaveHandlers = new Map<string, Map<string, () => Promise<void>>>()
let textEditorInstanceSeq = 0
type Html2Canvas = typeof import('html2canvas')['default']
let html2canvasPromise: Promise<Html2Canvas> | undefined

interface TextEditorContentSyncPayload {
  fileId: string
  sourceInstanceId: string
  content: string
}

function setTextEditorSaveHandler(
  fileId: string,
  instanceId: string,
  saveHandler: () => Promise<void>,
) {
  const handlers = textEditorSaveHandlers.get(fileId) ?? new Map<string, () => Promise<void>>()
  handlers.set(instanceId, saveHandler)
  textEditorSaveHandlers.set(fileId, handlers)
  setSaveOpenedEditorEntries(fileId, saveHandler)
}

function deleteTextEditorSaveHandler(fileId: string, instanceId: string) {
  const handlers = textEditorSaveHandlers.get(fileId)
  if (!handlers) return

  handlers.delete(instanceId)

  const nextHandler = Array.from(handlers.values()).at(-1)
  if (nextHandler) {
    setSaveOpenedEditorEntries(fileId, nextHandler)
    return
  }

  textEditorSaveHandlers.delete(fileId)
  delSaveOpenedEditorEntries(fileId)
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

async function readFileContent(filePath: string): Promise<FileSysResult> {
  const invokeStartTime = performance.now()
  const res = await invoke<FileSysResult>('get_file_content', {
    filePath,
  })
  console.log(
    'Finished loading file content via get_file_content, time taken:',
    performance.now() - invokeStartTime,
    'ms',
  )
  return res
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
      img.decode().then(finish).catch(() => {
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
    const exportSrc = await getCanvasSafeImageSrc(rawUrl, fileFolderPath, undefined, fallbackElement)

    nextValue += value.slice(lastIndex, matchIndex)
    nextValue += `url("${exportSrc.replace(/"/g, '\\"')}")`
    lastIndex = matchIndex + matchedText.length
  }

  nextValue += value.slice(lastIndex)
  return nextValue
}

async function prepareImagesForExport(root: HTMLElement, fileFolderPath?: string) {
  const restoreFns: Array<() => void> = []
  const images = Array.from(root.querySelectorAll('img'))

  await Promise.all(
    images.map(async (img) => {
      const originalSrc =
        img.getAttribute('data-rme-original-src') ||
        img.getAttribute('src') ||
        img.currentSrc ||
        ''
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
  const restoreFns: Array<() => void> = []
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
  const restoreFns: Array<() => void> = []
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
  const restoreFns: Array<() => void> = []
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
  const height = Math.max(240, Math.min(12000, Math.ceil(element.scrollHeight || rect.height || 600)))
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
  const words = (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim().split(' ')
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
    imageTimeout: 15000,
    logging: false,
    useCORS: true,
    ignoreElements: (element: Element) => element.tagName.toLowerCase() === 'iframe',
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
  const curFile = getFileObject(id)
  const instanceIdRef = useRef<string | undefined>(undefined)
  if (!instanceIdRef.current) {
    textEditorInstanceSeq += 1
    instanceIdRef.current = `text-editor-${textEditorInstanceSeq}`
  }
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
            sourceCodeCodemirrorViewMap.set(id, cmView)
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

  const setEditorDelegate = useEditorStore((state) => state.setEditorDelegate)
  const setEditorCtx = useEditorStore((state) => state.setEditorCtx)
  const insertNodeToFolderData = useEditorStore((state) => state.insertNodeToFolderData)
  const { t } = useTranslation()
  const autosave = useAppSettingStore((state) => state.settingData.autosave)
  const autosaveInterval = useAppSettingStore((state) => state.settingData.autosave_interval)
  const editorFullWidth = useAppSettingStore((state) => state.settingData.editor_full_width)
  const editorPlaceholder = useAppSettingStore((state) => state.settingData.editor_placeholder)
  const editorRootFontSize = useAppSettingStore(
    (state) => state.settingData.editor_root_font_size,
  )
  const editorRootLineHeight = useAppSettingStore(
    (state) => state.settingData.editor_root_line_height,
  )
  const editorTypewriterScroll = useAppSettingStore(
    (state) => state.settingData.editor_typewriter_scroll,
  )
  const sourceCodeEditorSpellcheck = useAppSettingStore(
    (state) => state.settingData.source_code_editor_spellcheck,
  )
  const wysiwygEditorSpellcheck = useAppSettingStore(
    (state) => state.settingData.wysiwyg_editor_spellcheck,
  )
  const [currentViewType, setCurrentViewType] = useState<EditorViewType>(fileTypeConfig.defaultMode)
  const [content, setContent] = useState<string | undefined>()
  const [delegate, setDelegate] = useState<ReturnType<typeof createDelegate> | null>(null)
  const effectiveDefaultViewType = useMemo(() => {
    if (
      fileTypeConfig.type === 'markdown' &&
      typeof content === 'string' &&
      content.length > LARGE_MARKDOWN_SOURCE_MODE_THRESHOLD &&
      fileTypeConfig.supportedModes.includes(EditorViewType.SOURCECODE)
    ) {
      return EditorViewType.SOURCECODE
    }

    return fileTypeConfig.defaultMode
  }, [content, fileTypeConfig])

  const debounceSaveHandlerCacheRef = useRef<DebouncedFunc<() => Promise<void>>>(null)
  const noFileSaveingRef = useRef(false)
  const editorRef = useRef<EditorRef>(null)
  const editorContextRef = useRef<EditorChangeEventParams>(null)
  const counterIdleHandleRef = useRef<number | null>(null)
  const isApplyingRemoteContentRef = useRef(false)
  const latestContentRef = useRef<string | undefined>(undefined)
  const remoteContentResetHandleRef = useRef<number | null>(null)

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
    mountedTextEditorCounts.set(id, (mountedTextEditorCounts.get(id) ?? 0) + 1)

    return () => {
      const nextCount = (mountedTextEditorCounts.get(id) ?? 1) - 1

      if (nextCount > 0) {
        mountedTextEditorCounts.set(id, nextCount)
        return
      }

      mountedTextEditorCounts.delete(id)
      useEditorCounterStore.getState().deleteEditorCounter({ id })
      useEditorStateStore.getState().delIdStateMap(id)
    }
  }, [id])

  const updateCachedFileContent = useCallback((nextContent: string) => {
    const file = getFileObject(id)
    if (!file) return

    updateFileObject(id, {
      ...file,
      content: nextContent,
    })
  }, [id])

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
    (nextContent: string) => {
      if (latestContentRef.current === nextContent) return

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
    [updateCachedFileContent],
  )

  useEffect(() => {
    latestContentRef.current = content
  }, [content])

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
    let canceled = false

    const init = async () => {
      const file = curFile
      const editorState = useEditorStateStore.getState().idStateMap.get(file.id)

      if (editorState?.hasUnsavedChanges && typeof file.content === 'string') {
        setContent(file.content)
        return setStatus(TextEditorStatus.SUCCESS)
      }

      if (file.path) {
        console.log('Loading file content from path:', file.path)
        const startTime = performance.now()
        const res = await readFileContent(file.path)
        console.log('Finished loading file content total, time taken:', performance.now() - startTime, 'ms')
        if (canceled) return
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
        setContent(res.content)
        updateCachedFileContent(res.content)
      } else if (file.content !== undefined) {
        if (canceled) return
        setContent(file.content)
      }

      return setStatus(TextEditorStatus.SUCCESS)
    }
    init()

    return () => {
      canceled = true
    }
  }, [curFile, updateCachedFileContent])

  useEffect(() => {
    if (status !== TextEditorStatus.SUCCESS || delegate) return
    const newDelegate = createDelegate(effectiveDefaultViewType, fileTypeConfig.type)
    setDelegate(newDelegate)
    setEditorDelegate(id, newDelegate)
    setCurrentViewType(effectiveDefaultViewType)
    useEditorViewTypeStore.getState().setEditorViewType(id, effectiveDefaultViewType)
  }, [
    status,
    delegate,
    id,
    fileTypeConfig,
    effectiveDefaultViewType,
    createDelegate,
    setEditorDelegate,
  ])

  const saveHandler = useCallback(
    async (params: SaveHandlerParams = {}) => {
      const { onSuccess, onFinally } = params
      const runFinally = () => {
        onFinally?.()
      }
      const runSuccess = () => {
        try {
          onSuccess?.()
        } finally {
          runFinally()
        }
      }

      if (!active && !params.active) {
        runFinally()
        return
      }
      const curFile = getFileObject(id)
      if (!curFile) {
        runFinally()
        return
      }

      const { idStateMap, setIdStateMap } = useEditorStateStore.getState()

      const curEditorState = idStateMap.get(curFile.id)

      if (!curEditorState?.hasUnsavedChanges) {
        runSuccess()
        return
      }

      if (!editorContextRef.current?.state.doc && !curFile.content) {
        // Unexpected
        runFinally()
        return
      }

      const fileContent = editorContextRef.current?.state.doc && delegate
        ? delegate.docToString(editorContextRef.current.state.doc)
        : curFile.content

      logger.info('editorContent', fileContent)

      try {
        if (!curFile.path) {
          if (noFileSaveingRef.current === true) {
            runFinally()
            return
          }

          noFileSaveingRef.current = true
          save({
            title: 'Save File',
            defaultPath: curFile.name ?? `${t('file.untitled')}.md`,
          })
            .then((path) => {
              noFileSaveingRef.current = false

              if (path === null) {
                runFinally()
                return
              }
              const filename = getFileNameFromPath(path)
              const savedFileContent = typeof fileContent === 'string' ? fileContent : curFile.content
              updateFileObject(curFile.id, {
                ...curFile,
                path,
                name: filename,
                content: savedFileContent,
              })
              insertNodeToFolderData({
                ...curFile,
                name: filename,
                content: savedFileContent,
                path,
              })
              invoke<FileSysResult>('write_file', { filePath: path, content: fileContent }).then(
                (res) => {
                  if (res.code !== FileResultCode.Success) {
                    runFinally()
                    return toast.error(res.content)
                  }
                  runSuccess()
                },
              ).catch((error) => {
                toast.error(String(error))
                runFinally()
              })
              setIdStateMap(curFile.id, {
                hasUnsavedChanges: false,
              })
            })
            .catch((error) => {
              noFileSaveingRef.current = false
              toast.error(String(error))
              runFinally()
            })
        } else {
          invoke<FileSysResult>('write_file', {
            filePath: curFile.path,
            content: fileContent,
          }).then((res) => {
            if (res.code !== FileResultCode.Success) {
              runFinally()
              return toast.error(res.content)
            }
            if (typeof fileContent === 'string') {
              setContent(fileContent)
              updateCachedFileContent(fileContent)
            }
            runSuccess()
          }).catch((error) => {
            toast.error(String(error))
            runFinally()
          })

          setIdStateMap(curFile.id, {
            hasUnsavedChanges: false,
          })
        }
      } catch (error) {
        toast.error(String(error))
        runFinally()
      }
    },
    [active, id, delegate, t, insertNodeToFolderData, updateCachedFileContent],
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

  const debounceSaveHandler = useCallback(() => {
    if (debounceSave) {
      debounceSaveHandlerCacheRef.current?.cancel()

      debounceSaveHandlerCacheRef.current = debounceSave
      debounceSave()
    }
  }, [debounceSave])

  useEffect(() => {
    const instanceId = instanceIdRef.current!
    setTextEditorSaveHandler(id, instanceId, () => saveHandler({ active: true }))

    return () => {
      deleteTextEditorSaveHandler(id, instanceId)
    }
  }, [id, saveHandler])

  const setContentHandler = useCallback(
    (newContent: string) => {
      if (!active) return
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
    [active, emitContentSync, id, updateCachedFileContent],
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
    delegateOptionsCache.clear()
  }, [editorTypewriterScroll, editorPlaceholder])

  useEffect(() => {
    const cb = throttle((payload: EditorViewType) => {
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
            if (payload === EditorViewType.SOURCECODE) {
              const currentSettingData = useAppSettingStore.getState().settingData
              const sourceCodeDelegate = createSourceCodeDelegate({
                disableAllBuildInShortcuts: true,
                overrideShortcutMap: useEditorKeybindingStore.getState().editorKeybingMap,
                clipboardReadFunction: clipboardRead,
                currentDateFormat: getCurrentEditorInsertDateFormat,
                onCodemirrorViewLoad: (cmView) => {
                  sourceCodeCodemirrorViewMap.set(curFile.id, cmView)
                  debounceRefreshToc()
                },
                typewriterScroll: {
                  enabled: currentSettingData.editor_typewriter_scroll,
                },
              })
              setEditorDelegate(curFile.id, sourceCodeDelegate)
              setDelegate(sourceCodeDelegate)
            } else if (payload === EditorViewType.PREVIEW) {
              debounceRefreshToc()
            } else {
              const wysiwygDelegate = createWysiwygDelegate(
                getOrCreateDelegateOptions(curFile.id),
              )
              setEditorDelegate(curFile.id, wysiwygDelegate)
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
    }, 300, { leading: true, trailing: false })

    bus.on('editor_toggle_type', cb)

    return () => {
      cb.cancel()
      bus.detach('editor_toggle_type', cb)
    }
  }, [active, curFile, setEditorDelegate, debounceRefreshToc])

  useEffect(() => {
    const exportImageHandler = async () => {
      if (!active) {
        return
      }

      try {
        const path = await save({
          title: t('contextmenu.editor_tab.export_image'),
          defaultPath: curFile.name.split('.')?.[0] + '.jpg',
        })
        if (!path) return

        const n = toast.loading(t('contextmenu.editor_tab.export_image') + '...')
        let restoreExportResources: (() => void) | undefined

        try {
          const exportElement = document.getElementById(id)
          if (!exportElement) {
            throw new Error('Editor element not found')
          }

          restoreExportResources = await prepareResourcesForExport(
            exportElement,
            getFolderPathFromPath(curFile.path),
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

      save({
        title: t('contextmenu.editor_tab.export_html'),
        defaultPath: curFile.name.split('.')?.[0] + '.html',
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
  }, [active, curFile.name, curFile.path, id, setContentHandler, t])

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
      if (!delegate) return
      if (
        (e.target as HTMLElement)?.id === 'editorarea-wrapper' ||
        (e.target as HTMLElement).parentElement?.id === 'editorarea-wrapper'
      ) {
        delegate.manager.view.focus()
      }
    },
    [delegate],
  )

  const rootFontSize =
    !editorRootFontSize || editorRootFontSize === 15
      ? 16
      : editorRootFontSize
  const rootLineHeight =
    !editorRootLineHeight || editorRootLineHeight === '1.6'
      ? '1.65'
      : editorRootLineHeight

  const editorProps: MfEditorProps = useMemo(
    () => ({
      initialType: effectiveDefaultViewType,
      content: content!,
      delegate: delegate!,
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
        setEditorCtx(id, context)
      },
      delegateOptions: getOrCreateDelegateOptions(curFile.id),
      wysiwygToolBarOptions: {
        enable: false,
      },
      errorHandler: {
        onError(params) {
          if (params.error) {
            Sentry.captureException(params.error)
          }
        },
      },
    }),
    [
      content,
      delegate,
      setEditorCtx,
      id,
      active,
      sourceCodeEditorSpellcheck,
      wysiwygEditorSpellcheck,
      fileTypeConfig,
      effectiveDefaultViewType,
      rootFontSize,
      rootLineHeight,
    ],
  )

  const handleChange: EditorChangeHandler = useCallback(
    (params) => {
      const { tr, helpers } = params
      editorContextRef.current = params

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
              wordCount: helpers.getWordCount(),
            },
          })
        })
      }

      if (tr?.docChanged && !tr.getMeta('APPLY_MARKS')) {
        const nextContent = delegate?.docToString(params.state.doc)
        if (typeof nextContent !== 'string') return

        latestContentRef.current = nextContent
        setContent(nextContent)
        updateCachedFileContent(nextContent)

        if (!isApplyingRemoteContentRef.current) {
          const state = {
            hasUnsavedChanges: true,
            undoDepth: helpers.undoDepth(),
          }
          const { setIdStateMap } = useEditorStateStore.getState()

          setIdStateMap(id, state)
          emitContentSync(nextContent)

          if (active) {
            debounceRefreshToc()
          }

          const curFile = getFileObject(id)
          if (autosave && curFile?.path) {
            debounceSaveHandler()
          }
        }
      }
    },
    [
      id,
      delegate,
      debounceSaveHandler,
      active,
      debounceRefreshToc,
      emitContentSync,
      autosave,
      updateCachedFileContent,
    ],
  )

  if (status === TextEditorStatus.NOTEXIST) {
    return <WarningHeader>File is not exist</WarningHeader>
  }

  if (status === TextEditorStatus.READERROR) {
    return <WarningHeader>Failed to read file content</WarningHeader>
  }

  if (status === TextEditorStatus.BINARY) {
    return <WarningHeader>Binary file cannot be opened as text</WarningHeader>
  }

  if (typeof content !== 'string' || !delegate) {
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
    <EditorWrapper
      id='editorarea-wrapper'
      className={cls}
      fullWidth={editorFullWidth}
      active={active}
      $visible={visible}
      onClick={handleWrapperClick}
      editorViewType={currentViewType}
      fileType={fileTypeConfig.type}
    >
      <MfEditor ref={editorRef} onChange={handleChange} {...editorProps} />
    </EditorWrapper>
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
