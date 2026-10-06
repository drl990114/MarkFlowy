import { resolveAppThemeTokens } from '@/appThemeTokens'
import bus from '@/helper/eventBus'
import { getFolderPathFromPath } from '@/helper/filesys'
import { logger } from '@/helper/logger'
import { useTranslation } from '@/i18n'
import useAppSettingStore from '@/stores/useAppSettingStore'
import { editorLightTheme } from '@markflowy/theme'
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { save } from '@tauri-apps/plugin-dialog'
import { revealItemInDir } from '@tauri-apps/plugin-opener'
import { createPortal } from 'react-dom'
import type { CreateWysiwygDelegateOptions, EditorProps, PreviewImageHydration } from 'rme'
import { loadRmeRuntime, type RmeRuntime } from '../rmeRuntime'
import { RmeThemeProvider } from '../RmeThemeProvider'
import { ThemeProvider } from 'styled-components'
import { toast } from 'zens'
import { PDF_PRINT_EVENT } from './pdfPrintMenuItem'
import { openPdfPrintWindow } from './pdfPrintWindow'
import {
  acquirePrintTask,
  makePrintDocumentTransferable,
  preparePrintDocument,
} from './printDocument'
import './pdf-print.css'
import {
  exportPdfWithBrowser,
  getPdfExportFileName,
  PDF_BROWSER_EXECUTABLE_PATH_SETTING,
  probePdfBrowser,
  type PdfBrowserInfo,
} from '../pdf-export/pdfExport'
import { PDF_EXPORT_EVENT } from '../pdf-export/pdfExportMenuItem'
import type { PdfExportOptions } from '../pdf-export/PdfExportDialog'

const PdfExportDialog = lazy(() =>
  import('../pdf-export/PdfExportDialog').then((module) => ({ default: module.PdfExportDialog })),
)

interface PdfDocumentSnapshot {
  content: string
  fileName: string
  filePath?: string
  windowJobId: string
}

interface PdfPrintJob extends PdfDocumentSnapshot {
  id: number
  runtime: RmeRuntime
  exportOptions?: PdfExportOptions & { outputPath: string; executablePath: string }
}

function getPreparedPreviewHtml(root: HTMLElement): string {
  const previewContent = root.querySelector<HTMLElement>('.mf-preview-content')
  if (!previewContent) throw new Error('Printable Preview content is unavailable')
  return previewContent.innerHTML
}

export interface PdfPrintControllerProps {
  active: boolean
  enabled: boolean
  fileName: string
  filePath?: string
  getContent: () => string
  delegateOptions: CreateWysiwygDelegateOptions
  styleToken: EditorProps['styleToken']
}

export function PdfPrintController({
  active,
  enabled,
  fileName,
  filePath,
  getContent,
  delegateOptions,
  styleToken,
}: PdfPrintControllerProps) {
  const { t } = useTranslation()
  const editorCodeFontFamily = useAppSettingStore(
    (state) => state.settingData.editor_code_font_family,
  )
  const editorRootFontFamily = useAppSettingStore(
    (state) => state.settingData.editor_root_font_family,
  )
  const printTheme = useMemo(
    () =>
      resolveAppThemeTokens({
        accentColor: editorLightTheme.accentColor,
        fontSettings: { editorCodeFontFamily, editorRootFontFamily },
        hasAccentColorOverride: false,
        mode: 'light',
        theme: editorLightTheme,
      }).editorTheme,
    [editorCodeFontFamily, editorRootFontFamily],
  )
  const [job, setJob] = useState<PdfPrintJob | null>(null)
  const [pendingExport, setPendingExport] = useState<PdfDocumentSnapshot | null>(null)
  const [browserInfo, setBrowserInfo] = useState<PdfBrowserInfo>()
  const [checkingBrowser, setCheckingBrowser] = useState(false)
  const [exportBusy, setExportBusy] = useState(false)
  const [exportError, setExportError] = useState<string>()
  const configuredBrowserPath = useAppSettingStore((state) => {
    const path = state.settingData[PDF_BROWSER_EXECUTABLE_PATH_SETTING]
    return typeof path === 'string' ? path.trim() || undefined : undefined
  })
  const [hydration, setHydration] = useState<PreviewImageHydration | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const releaseTaskRef = useRef<(() => void) | null>(null)
  const taskAbortControllerRef = useRef<AbortController | null>(null)
  const preparationAbortControllerRef = useRef<AbortController | null>(null)
  const hydrationRef = useRef<PreviewImageHydration | null>(null)
  const mountedRef = useRef(true)
  const rendererErrorRef = useRef<Error | null>(null)
  const startedJobRef = useRef<number | null>(null)
  const jobSequenceRef = useRef(0)
  const exportStartingRef = useRef(false)

  const handleHydrationChange = useCallback((nextHydration: PreviewImageHydration | null) => {
    if (hydrationRef.current === nextHydration) return
    // Preview also settles a hydration when a theme change replaces it. That
    // settlement cannot authorize printing the replacement's loading surface.
    hydrationRef.current = nextHydration
    preparationAbortControllerRef.current?.abort()
    setHydration(nextHydration)
  }, [])

  const finishTask = useCallback(() => {
    taskAbortControllerRef.current?.abort()
    taskAbortControllerRef.current = null
    releaseTaskRef.current?.()
    releaseTaskRef.current = null
    startedJobRef.current = null
    rendererErrorRef.current = null
    hydrationRef.current = null
    if (mountedRef.current) {
      setHydration(null)
      setJob(null)
      setPendingExport(null)
      setExportBusy(false)
      setExportError(undefined)
      exportStartingRef.current = false
    }
  }, [])

  useEffect(() => {
    const handleRequest = async (exportPdf: boolean) => {
      if (!active || !enabled) return

      const releaseTask = acquirePrintTask()
      if (!releaseTask) return

      releaseTaskRef.current = releaseTask
      const abortController = new AbortController()
      taskAbortControllerRef.current = abortController
      try {
        const snapshot: PdfDocumentSnapshot = {
          content: getContent(),
          fileName,
          filePath,
          windowJobId: crypto.randomUUID(),
        }
        if (exportPdf) {
          setPendingExport(snapshot)
          setBrowserInfo(undefined)
          setExportError(undefined)
          return
        }
        const runtime = await loadRmeRuntime()
        if (abortController.signal.aborted || !mountedRef.current) return
        rendererErrorRef.current = null
        jobSequenceRef.current += 1
        setJob({
          id: jobSequenceRef.current,
          ...snapshot,
          runtime,
        })
      } catch (error) {
        if (abortController.signal.aborted) return
        finishTask()
        logger.error('Failed to read PDF print content:', error)
        toast.error(error instanceof Error ? error.message : String(error))
      }
    }

    const handlePrintRequest = () => handleRequest(false)
    const handleExportRequest = () => handleRequest(true)
    bus.on(PDF_PRINT_EVENT, handlePrintRequest)
    bus.on(PDF_EXPORT_EVENT, handleExportRequest)
    return () => {
      bus.detach(PDF_PRINT_EVENT, handlePrintRequest)
      bus.detach(PDF_EXPORT_EVENT, handleExportRequest)
    }
  }, [active, enabled, fileName, filePath, finishTask, getContent])

  useEffect(() => {
    if (!pendingExport) return
    let current = true
    setCheckingBrowser(true)
    setBrowserInfo(undefined)
    setExportError(undefined)
    void probePdfBrowser(configuredBrowserPath)
      .then((info) => {
        if (current) setBrowserInfo(info)
      })
      .catch((error: unknown) => {
        if (current)
          setExportError(
            error instanceof Error ? error.message : t('pdf_export.browser_check_failed'),
          )
      })
      .finally(() => {
        if (current) setCheckingBrowser(false)
      })
    return () => {
      current = false
    }
  }, [configuredBrowserPath, pendingExport, t])

  const startExport = async (options: PdfExportOptions) => {
    const abortController = taskAbortControllerRef.current
    if (
      !pendingExport ||
      !browserInfo?.available ||
      !browserInfo.compatible ||
      !browserInfo.executablePath ||
      !abortController ||
      exportStartingRef.current
    )
      return
    exportStartingRef.current = true
    setExportBusy(true)
    setExportError(undefined)
    try {
      const outputPath = await save({
        title: t('pdf_export.title'),
        defaultPath: getPdfExportFileName(pendingExport.fileName),
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      })
      abortController.signal.throwIfAborted()
      if (!outputPath) {
        exportStartingRef.current = false
        setExportBusy(false)
        return
      }
      const runtime = await loadRmeRuntime()
      abortController.signal.throwIfAborted()
      jobSequenceRef.current += 1
      setJob({
        ...pendingExport,
        id: jobSequenceRef.current,
        runtime,
        exportOptions: { ...options, outputPath, executablePath: browserInfo.executablePath },
      })
    } catch (error) {
      if (abortController.signal.aborted) return
      exportStartingRef.current = false
      setExportBusy(false)
      setExportError(error instanceof Error ? error.message : t('pdf_export.failed'))
    }
  }

  const printInstead = async () => {
    const abortController = taskAbortControllerRef.current
    if (!pendingExport || !abortController || exportStartingRef.current) return
    exportStartingRef.current = true
    try {
      const runtime = await loadRmeRuntime()
      abortController.signal.throwIfAborted()
      jobSequenceRef.current += 1
      setJob({ ...pendingExport, id: jobSequenceRef.current, runtime })
      setPendingExport(null)
    } catch (error) {
      if (abortController.signal.aborted) return
      finishTask()
      toast.error(error instanceof Error ? error.message : t('pdf_export.failed'))
    }
  }

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      taskAbortControllerRef.current?.abort()
      taskAbortControllerRef.current = null
      releaseTaskRef.current?.()
      releaseTaskRef.current = null
    }
  }, [])

  useEffect(() => {
    if (
      !hydration ||
      hydrationRef.current !== hydration ||
      !job ||
      startedJobRef.current === job.id
    ) {
      return
    }

    const root = rootRef.current
    if (!root) return
    const taskAbortController = taskAbortControllerRef.current
    if (!taskAbortController) return

    const preparationAbortController = new AbortController()
    preparationAbortControllerRef.current = preparationAbortController
    const cancelPreparation = () => preparationAbortController.abort()
    taskAbortController.signal.addEventListener('abort', cancelPreparation, { once: true })
    if (taskAbortController.signal.aborted) cancelPreparation()
    let printWindowOpened = false
    // The export dialog owns its cancellable progress status. A preparation
    // retry must not create another indefinite notification.
    const loadingToast = job.exportOptions
      ? undefined
      : toast.loading(t('contextmenu.editor_tab.export_pdf') + '...')
    const dismissPrintProgress = () => {
      if (loadingToast !== undefined) toast.dismiss(loadingToast)
    }

    void (async () => {
      try {
        const interactiveMediaLabel = t('contextmenu.editor_tab.export_pdf_embedded_media')
        const { failedImageCount } = await preparePrintDocument({
          root,
          hydration,
          interactiveMediaLabel,
          signal: preparationAbortController.signal,
        })

        if (preparationAbortController.signal.aborted) throw new DOMException('', 'AbortError')
        if (rendererErrorRef.current) throw rendererErrorRef.current
        await makePrintDocumentTransferable(root, preparationAbortController.signal)
        if (preparationAbortController.signal.aborted) throw new DOMException('', 'AbortError')
        const html = getPreparedPreviewHtml(root)

        if (job.exportOptions) {
          const { buildPdfExportDocument } = await import('../pdf-export/pdfExportDocument')
          const document = await buildPdfExportDocument({
            root,
            html,
            title: job.fileName,
            paperSize: job.exportOptions.paperSize,
            landscape: job.exportOptions.landscape,
            fileFolderPath: getFolderPathFromPath(job.filePath),
          })
          if (preparationAbortController.signal.aborted) throw new DOMException('', 'AbortError')
          startedJobRef.current = job.id
          printWindowOpened = true
          const result = await exportPdfWithBrowser(
            {
              ...job.exportOptions,
              jobId: job.windowJobId,
              html: document.html,
              sourcePath: job.filePath,
            },
            taskAbortController.signal,
          )
          toast.success(t('pdf_export.success', { path: result.outputPath }), {
            action: {
              label: t('contextmenu.explorer.show_in_folder'),
              onClick: () => {
                void revealItemInDir(result.outputPath).catch((error: unknown) => {
                  logger.error('Failed to reveal PDF export:', error)
                })
              },
            },
          })
          if (failedImageCount)
            toast.warning(t('pdf_export.image_warning', { count: failedImageCount }))
          return
        }

        // The window owns this immutable snapshot from here on. Later Preview
        // rerenders must neither open another window nor cancel the print dialog.
        startedJobRef.current = job.id
        printWindowOpened = true
        const result = await openPdfPrintWindow(
          {
            editorCodeFontFamily,
            editorRootFontFamily,
            failedImageCount,
            fileName: job.fileName,
            html,
            interactiveMediaLabel,
            jobId: job.windowJobId,
            rootFontSize: styleToken?.rootFontSize,
            rootLineHeight: styleToken?.rootLineHeight,
          },
          taskAbortController.signal,
          { onPrepared: dismissPrintProgress },
        )

        if (result && result.failedImageCount > 0) {
          toast.warning(
            t('contextmenu.editor_tab.export_pdf_image_warning', {
              count: result.failedImageCount,
            }),
          )
        }
      } catch (error) {
        if (
          !taskAbortController.signal.aborted &&
          (printWindowOpened || !preparationAbortController.signal.aborted)
        ) {
          logger.error('Failed to prepare PDF print document:', error)
          const message =
            error instanceof Error
              ? error.message
              : error &&
                  typeof error === 'object' &&
                  'message' in error &&
                  typeof error.message === 'string'
                ? error.message
                : t('contextmenu.editor_tab.export_pdf_failed')
          toast.error(job.exportOptions ? message : t('contextmenu.editor_tab.export_pdf_failed'))
        }
      } finally {
        dismissPrintProgress()
        taskAbortController.signal.removeEventListener('abort', cancelPreparation)
        if (preparationAbortControllerRef.current === preparationAbortController) {
          preparationAbortControllerRef.current = null
        }
        // A replaced preparation must leave the job and lock to its successor.
        if (
          taskAbortControllerRef.current === taskAbortController &&
          (printWindowOpened || !preparationAbortController.signal.aborted)
        )
          finishTask()
      }
    })()

    return cancelPreparation
  }, [editorCodeFontFamily, editorRootFontFamily, finishTask, hydration, job, styleToken, t])

  const Preview = job?.runtime.Preview
  return (
    <>
      {pendingExport ? (
        <Suspense fallback={null}>
          <PdfExportDialog
            open
            onOpenChange={(open) => {
              if (!open) finishTask()
            }}
            onExport={(options) => {
              void startExport(options)
            }}
            onPrint={() => {
              void printInstead()
            }}
            busy={exportBusy}
            browserInfo={browserInfo}
            checking={checkingBrowser}
            error={exportError}
          />
        </Suspense>
      ) : null}
      {job && Preview
        ? createPortal(
            <RmeThemeProvider runtime={job.runtime}>
              <ThemeProvider theme={printTheme}>
                <div
                  ref={rootRef}
                  className='mf-pdf-print-root'
                  data-mf-pdf-print-root=''
                  aria-hidden='true'
                >
                  <Preview
                    doc={job.content}
                    delegateOptions={delegateOptions}
                    styleToken={styleToken}
                    handleLinkClick={() => true}
                    onError={(error) => {
                      rendererErrorRef.current = error
                    }}
                    onImageHydrationChange={handleHydrationChange}
                  />
                </div>
              </ThemeProvider>
            </RmeThemeProvider>,
            document.body,
          )
        : null}
    </>
  )
}
