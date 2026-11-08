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
  exportPdfWithNative,
  getPdfExportFileName,
  PDF_BROWSER_EXECUTABLE_PATH_SETTING,
} from '../pdf-export/pdfExport'
import { PDF_EXPORT_EVENT } from '../pdf-export/pdfExportMenuItem'
import type { PdfExportOptions } from '../pdf-export/PdfExportDialog'
import { usePdfBrowserConfiguration } from '../pdf-export/usePdfBrowserConfiguration'
import { paragraphIndentationStyle } from '../paragraphIndentation'

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
  previewContent: string
  exportOptions?: PdfExportOptions & { outputPath: string; executablePath?: string }
}

async function preparePreviewContent(markdown: string): Promise<string> {
  if (!markdown.includes('mermaid')) return markdown
  const { preparePdfExportMarkdown } = await import('../pdf-export/pdfExportMarkdown')
  return preparePdfExportMarkdown(markdown)
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
  const editorFirstLineIndent = useAppSettingStore(
    (state) => state.settingData.editor_first_line_indent === true,
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
  const [browserSelected, setBrowserSelected] = useState(false)
  const browserConfiguration = usePdfBrowserConfiguration(Boolean(pendingExport) && browserSelected)
  const {
    info: browserInfo,
    checking: checkingBrowser,
    checkError: browserCheckError,
  } = browserConfiguration
  const [exportBusy, setExportBusy] = useState(false)
  const [exportError, setExportError] = useState<string>()
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
      setBrowserSelected(false)
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
          setBrowserSelected(false)
          setPendingExport(snapshot)
          setExportError(undefined)
          return
        }
        const [runtime, previewContent] = await Promise.all([
          loadRmeRuntime(), preparePreviewContent(snapshot.content),
        ])
        if (abortController.signal.aborted || !mountedRef.current) return
        rendererErrorRef.current = null
        jobSequenceRef.current += 1
        setJob({
          id: jobSequenceRef.current,
          ...snapshot,
          runtime,
          previewContent,
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

  const startExport = async (options: PdfExportOptions) => {
    const abortController = taskAbortControllerRef.current
    const configuredPath = useAppSettingStore.getState().settingData[PDF_BROWSER_EXECUTABLE_PATH_SETTING]
    const browserPathChanged =
      (typeof configuredPath === 'string' ? configuredPath.trim() : '') !==
      browserConfiguration.configuredPath.trim()
    if (
      !pendingExport ||
      (options.engine === 'browser' &&
        (checkingBrowser ||
          browserConfiguration.configuring ||
          browserPathChanged ||
          !browserInfo?.available ||
          !browserInfo.compatible ||
          !browserInfo.executablePath)) ||
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
      const [runtime, previewContent] = await Promise.all([
        loadRmeRuntime(), preparePreviewContent(pendingExport.content),
      ])
      abortController.signal.throwIfAborted()
      jobSequenceRef.current += 1
      setJob({
        ...pendingExport,
        id: jobSequenceRef.current,
        runtime,
        previewContent,
        exportOptions: {
          ...options,
          outputPath,
          ...(options.engine === 'browser' ? { executablePath: browserInfo?.executablePath } : {}),
        },
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
      const [runtime, previewContent] = await Promise.all([
        loadRmeRuntime(), preparePreviewContent(pendingExport.content),
      ])
      abortController.signal.throwIfAborted()
      jobSequenceRef.current += 1
      setJob({ ...pendingExport, id: jobSequenceRef.current, runtime, previewContent })
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
          let preparedHtml = document.html
          if (job.exportOptions.engine === 'native') {
            const { preparePagedPdfDocument } = await import('../pdf-export/pagedPdfDocument')
            preparationAbortController.signal.throwIfAborted()
            preparedHtml = (await preparePagedPdfDocument(document.html, {
              paperSize: job.exportOptions.paperSize,
              landscape: job.exportOptions.landscape,
              signal: preparationAbortController.signal,
            })).html
          }
          preparationAbortController.signal.throwIfAborted()
          startedJobRef.current = job.id
          printWindowOpened = true
          const request = {
            jobId: job.windowJobId,
            html: preparedHtml,
            outputPath: job.exportOptions.outputPath,
            sourcePath: job.filePath,
            paperSize: job.exportOptions.paperSize,
            landscape: job.exportOptions.landscape,
            includeOutline: job.exportOptions.includeOutline,
          }
          let result
          if (job.exportOptions.engine === 'native') {
            result = await exportPdfWithNative(request, taskAbortController.signal)
          } else {
            const executablePath = job.exportOptions.executablePath
            if (!executablePath) throw new Error(t('pdf_export.browser.not_found'))
            result = await exportPdfWithBrowser(
              {
                ...request,
                executablePath,
              },
              taskAbortController.signal,
            )
          }
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
            firstLineIndent: editorFirstLineIndent,
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
  }, [editorCodeFontFamily, editorRootFontFamily, editorFirstLineIndent, finishTask, hydration, job, styleToken, t])

  const Preview = job?.runtime.Preview
  return (
    <>
      {pendingExport ? (
        <Suspense fallback={null}>
          <PdfExportDialog
            key={pendingExport.windowJobId}
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
            onEngineChange={(engine) => {
              if (!exportStartingRef.current) setBrowserSelected(engine === 'browser')
            }}
            browserInfo={browserInfo}
            checking={checkingBrowser}
            browserCheckError={browserCheckError}
            browserSettings={{
              configuredPath: browserConfiguration.configuredPath,
              busy: browserConfiguration.configuring,
              error: browserConfiguration.saveError
                ? t('settings.export.pdf.status.save_failed')
                : undefined,
              onSelect: () => {
                if (exportStartingRef.current) return
                setExportError(undefined)
                void browserConfiguration.selectExecutable()
              },
              onReset: () => {
                if (exportStartingRef.current) return
                setExportError(undefined)
                void browserConfiguration.resetToAutomatic()
              },
              onCheck: () => {
                if (exportStartingRef.current) return
                setExportError(undefined)
                void browserConfiguration.checkBrowser(true)
              },
            }}
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
                  style={paragraphIndentationStyle(editorFirstLineIndent)}
                  data-mf-pdf-print-root=''
                  aria-hidden='true'
                >
                  <Preview
                    doc={job.previewContent}
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
