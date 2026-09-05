import { resolveAppThemeTokens } from '@/appThemeTokens'
import bus from '@/helper/eventBus'
import { logger } from '@/helper/logger'
import { useTranslation } from '@/i18n'
import useAppSettingStore from '@/stores/useAppSettingStore'
import { editorLightTheme } from '@markflowy/theme'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CreateWysiwygDelegateOptions, EditorProps, PreviewImageHydration } from 'rme'
import { Preview } from 'rme'
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

interface PdfPrintJob {
  id: number
  content: string
  fileName: string
  windowJobId: string
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
  getContent: () => string
  delegateOptions: CreateWysiwygDelegateOptions
  styleToken: EditorProps['styleToken']
}

export function PdfPrintController({
  active,
  enabled,
  fileName,
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
  const [hydration, setHydration] = useState<PreviewImageHydration | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const releaseTaskRef = useRef<(() => void) | null>(null)
  const taskAbortControllerRef = useRef<AbortController | null>(null)
  const mountedRef = useRef(true)
  const rendererErrorRef = useRef<Error | null>(null)
  const startedJobRef = useRef<number | null>(null)
  const jobSequenceRef = useRef(0)

  const finishTask = useCallback(() => {
    taskAbortControllerRef.current?.abort()
    taskAbortControllerRef.current = null
    releaseTaskRef.current?.()
    releaseTaskRef.current = null
    startedJobRef.current = null
    rendererErrorRef.current = null
    if (mountedRef.current) {
      setHydration(null)
      setJob(null)
    }
  }, [])

  useEffect(() => {
    const handlePrintRequest = () => {
      if (!active || !enabled) return

      const releaseTask = acquirePrintTask()
      if (!releaseTask) return

      releaseTaskRef.current = releaseTask
      try {
        const content = getContent()
        taskAbortControllerRef.current = new AbortController()
        rendererErrorRef.current = null
        jobSequenceRef.current += 1
        setJob({
          id: jobSequenceRef.current,
          content,
          fileName,
          windowJobId: `${Date.now().toString(36)}-${jobSequenceRef.current}`,
        })
      } catch (error) {
        finishTask()
        logger.error('Failed to read PDF print content:', error)
        toast.error(error instanceof Error ? error.message : String(error))
      }
    }

    bus.on(PDF_PRINT_EVENT, handlePrintRequest)
    return () => {
      bus.detach(PDF_PRINT_EVENT, handlePrintRequest)
    }
  }, [active, enabled, fileName, finishTask, getContent])

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
    if (!hydration || !job || startedJobRef.current === job.id) return

    const root = rootRef.current
    if (!root) return
    const taskAbortController = taskAbortControllerRef.current
    if (!taskAbortController) return

    startedJobRef.current = job.id
    const loadingToast = toast.loading(t('contextmenu.editor_tab.export_pdf') + '...')

    void (async () => {
      try {
        const interactiveMediaLabel = t('contextmenu.editor_tab.export_pdf_embedded_media')
        const { failedImageCount } = await preparePrintDocument({
          root,
          hydration,
          interactiveMediaLabel,
          signal: taskAbortController.signal,
        })

        if (taskAbortController.signal.aborted) throw new DOMException('', 'AbortError')
        if (rendererErrorRef.current) throw rendererErrorRef.current
        await makePrintDocumentTransferable(root, taskAbortController.signal)

        const result = await openPdfPrintWindow(
          {
            editorCodeFontFamily,
            editorRootFontFamily,
            failedImageCount,
            fileName: job.fileName,
            html: getPreparedPreviewHtml(root),
            interactiveMediaLabel,
            jobId: job.windowJobId,
            rootFontSize: styleToken?.rootFontSize,
            rootLineHeight: styleToken?.rootLineHeight,
          },
          taskAbortController.signal,
        )

        if (result && result.failedImageCount > 0) {
          toast.warning(
            t('contextmenu.editor_tab.export_pdf_image_warning', {
              count: result.failedImageCount,
            }),
          )
        }
      } catch (error) {
        if (!taskAbortController.signal.aborted) {
          logger.error('Failed to prepare PDF print document:', error)
          toast.error(t('contextmenu.editor_tab.export_pdf_failed'))
        }
      } finally {
        toast.dismiss(loadingToast)
        finishTask()
      }
    })()
  }, [editorCodeFontFamily, editorRootFontFamily, finishTask, hydration, job, styleToken, t])

  if (!job) return null

  return createPortal(
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
          onImageHydrationChange={setHydration}
        />
      </div>
    </ThemeProvider>,
    document.body,
  )
}
