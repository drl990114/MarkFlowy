import { resolveAppThemeTokens } from '@/appThemeTokens'
import { editorLightTheme } from '@markflowy/theme'
import { emitTo } from '@tauri-apps/api/event'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { useEffect, useMemo, useRef, useState } from 'react'
import { WysiwygThemeWrapper } from 'rme'
import { ThemeProvider } from 'styled-components'
import {
  createPrintDialogCompletionObserver,
  type PrintDialogCompletionObserver,
} from './printDialogCompletion'
import {
  PDF_PRINT_WINDOW_DATA_EVENT,
  PDF_PRINT_WINDOW_READY_EVENT,
  PDF_PRINT_WINDOW_RESULT_EVENT,
  type PdfPrintWindowPayload,
  type PdfPrintWindowRequest,
  type PdfPrintWindowResult,
} from './pdfPrintWindow'
import { invokeSystemPrint, preparePrintDocument } from './printDocument'
import './pdf-print.css'

export interface PdfPrintWindowAppProps {
  request: PdfPrintWindowRequest
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function PdfPrintWindowApp({ request }: PdfPrintWindowAppProps) {
  const [payload, setPayload] = useState<PdfPrintWindowPayload | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const startedRef = useRef(false)
  const currentWindow = useMemo(() => getCurrentWebviewWindow(), [])
  const printTheme = useMemo(() => {
    if (!payload) return editorLightTheme

    return resolveAppThemeTokens({
      accentColor: editorLightTheme.accentColor,
      fontSettings: {
        editorCodeFontFamily: payload.editorCodeFontFamily,
        editorRootFontFamily: payload.editorRootFontFamily,
      },
      hasAccentColorOverride: false,
      mode: 'light',
      theme: editorLightTheme,
    }).editorTheme
  }, [payload])

  useEffect(() => {
    let active = true
    let unlisten: (() => void) | undefined

    void currentWindow
      .listen<PdfPrintWindowPayload>(PDF_PRINT_WINDOW_DATA_EVENT, ({ payload: nextPayload }) => {
        if (
          !active ||
          nextPayload.jobId !== request.jobId ||
          nextPayload.sourceLabel !== request.sourceLabel
        ) {
          return
        }
        setPayload(nextPayload)
      })
      .then((nextUnlisten) => {
        if (!active) {
          nextUnlisten()
          return
        }

        unlisten = nextUnlisten
        return emitTo(request.sourceLabel, PDF_PRINT_WINDOW_READY_EVENT, {
          jobId: request.jobId,
          sourceLabel: request.sourceLabel,
          windowLabel: currentWindow.label,
        })
      })
      .catch(() => currentWindow.destroy())

    return () => {
      active = false
      unlisten?.()
    }
  }, [currentWindow, request])

  useEffect(() => {
    const root = rootRef.current
    if (!payload || !root || startedRef.current) return

    startedRef.current = true
    const abortController = new AbortController()
    let printDialogObserver: PrintDialogCompletionObserver | undefined

    void (async () => {
      let result: PdfPrintWindowResult

      try {
        document.title = payload.fileName
        await currentWindow.show()
        await currentWindow.setFocus()
        const preparation = await preparePrintDocument({
          root,
          hydration: { settled: Promise.resolve() },
          interactiveMediaLabel: payload.interactiveMediaLabel,
          signal: abortController.signal,
        })
        printDialogObserver = await createPrintDialogCompletionObserver(abortController.signal)
        await invokeSystemPrint(window, {
          nativeCompletion: printDialogObserver.settled,
        })
        result = {
          failedImageCount: Math.max(
            payload.failedImageCount,
            preparation.failedImageCount,
          ),
          jobId: payload.jobId,
          status: 'complete',
        }
      } catch (error) {
        if (abortController.signal.aborted) return
        result = {
          error: getErrorMessage(error),
          failedImageCount: payload.failedImageCount,
          jobId: payload.jobId,
          status: 'error',
        }
      }

      try {
        await emitTo(payload.sourceLabel, PDF_PRINT_WINDOW_RESULT_EVENT, result)
      } finally {
        await currentWindow.destroy()
      }
    })().catch(() => undefined)

    return () => {
      abortController.abort()
      printDialogObserver?.dispose()
    }
  }, [currentWindow, payload])

  if (!payload) return null

  return (
    <ThemeProvider theme={printTheme}>
      <div ref={rootRef} className='mf-pdf-print-root mf-pdf-window-root'>
        <WysiwygThemeWrapper
          rootFontSize={payload.rootFontSize}
          rootLineHeight={payload.rootLineHeight}
        >
          <div
            className='mf-preview-content'
            dangerouslySetInnerHTML={{ __html: payload.html }}
          />
        </WysiwygThemeWrapper>
      </div>
    </ThemeProvider>
  )
}
