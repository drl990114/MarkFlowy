import { getCurrentWindow } from '@tauri-apps/api/window'

interface FocusChangeEvent {
  payload: boolean
}

interface NativeWindowFocusSource {
  onFocusChanged: (
    handler: (event: FocusChangeEvent) => void,
  ) => Promise<() => void>
}

export interface PrintDialogCompletionObserver {
  dispose: () => void
  settled: Promise<void>
}

export async function createPrintDialogCompletionObserver(
  signal: AbortSignal,
  browserWindow: Window = window,
  nativeWindow?: NativeWindowFocusSource,
): Promise<PrintDialogCompletionObserver> {
  let disposed = false
  let unlistenNative: (() => void) | undefined
  let sawBrowserBlur = false
  let sawNativeBlur = false
  let sawPrintMedia = false
  let resolveSettled!: () => void
  const settled = new Promise<void>((resolve) => {
    resolveSettled = resolve
  })
  const printMedia = browserWindow.matchMedia?.('print')

  const dispose = () => {
    if (disposed) return
    disposed = true
    browserWindow.removeEventListener('blur', handleBrowserBlur)
    browserWindow.removeEventListener('focus', handleBrowserFocus)
    browserWindow.removeEventListener('pointerdown', handleUserReturn)
    browserWindow.removeEventListener('keydown', handleUserReturn)
    printMedia?.removeEventListener('change', handlePrintMediaChange)
    signal.removeEventListener('abort', settle)
    unlistenNative?.()
    unlistenNative = undefined
  }
  const settle = () => {
    if (disposed) return
    resolveSettled()
    dispose()
  }
  const handleBrowserBlur = () => {
    sawBrowserBlur = true
  }
  const handleBrowserFocus = () => {
    if (sawBrowserBlur) settle()
  }
  const handleUserReturn = () => settle()
  const handlePrintMediaChange = (event: MediaQueryListEvent) => {
    if (event.matches) {
      sawPrintMedia = true
    } else if (sawPrintMedia) {
      settle()
    }
  }
  const handleNativeFocus = ({ payload: focused }: FocusChangeEvent) => {
    if (!focused) {
      sawNativeBlur = true
    } else if (sawNativeBlur) {
      settle()
    }
  }

  browserWindow.addEventListener('blur', handleBrowserBlur)
  browserWindow.addEventListener('focus', handleBrowserFocus)
  browserWindow.addEventListener('pointerdown', handleUserReturn)
  browserWindow.addEventListener('keydown', handleUserReturn)
  printMedia?.addEventListener('change', handlePrintMediaChange)
  signal.addEventListener('abort', settle, { once: true })

  try {
    const unlisten = await (nativeWindow ?? getCurrentWindow()).onFocusChanged(handleNativeFocus)
    if (disposed) {
      unlisten()
    } else {
      unlistenNative = unlisten
    }
  } catch {
    // Browser focus, print-media, and user-return signals remain available.
  }

  if (signal.aborted) settle()

  return { dispose, settled }
}
