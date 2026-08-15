import { describe, expect, it, vi } from 'vitest'
import { createPrintDialogCompletionObserver } from './printDialogCompletion'

interface FocusChangeEvent {
  payload: boolean
}

function createNativeFocusSource() {
  let handler: ((event: FocusChangeEvent) => void) | undefined
  const unlisten = vi.fn()
  const source = {
    onFocusChanged: vi.fn(async (nextHandler: (event: FocusChangeEvent) => void) => {
      handler = nextHandler
      return unlisten
    }),
  }

  return {
    emit(focused: boolean) {
      handler?.({ payload: focused })
    },
    source,
    unlisten,
  }
}

describe('createPrintDialogCompletionObserver', () => {
  it('settles when the native print sheet returns focus to the app window', async () => {
    const nativeFocus = createNativeFocusSource()
    const abortController = new AbortController()
    const observer = await createPrintDialogCompletionObserver(
      abortController.signal,
      window,
      nativeFocus.source,
    )

    nativeFocus.emit(false)
    nativeFocus.emit(true)

    await expect(observer.settled).resolves.toBeUndefined()
    expect(nativeFocus.unlisten).toHaveBeenCalledOnce()
  })

  it('also recovers on the first app interaction after a native dialog closes', async () => {
    const nativeFocus = createNativeFocusSource()
    const observer = await createPrintDialogCompletionObserver(
      new AbortController().signal,
      window,
      nativeFocus.source,
    )

    window.dispatchEvent(new PointerEvent('pointerdown'))

    await expect(observer.settled).resolves.toBeUndefined()
    expect(nativeFocus.unlisten).toHaveBeenCalledOnce()
  })

  it('disposes listeners when the owning print task is cancelled', async () => {
    const nativeFocus = createNativeFocusSource()
    const abortController = new AbortController()
    const observer = await createPrintDialogCompletionObserver(
      abortController.signal,
      window,
      nativeFocus.source,
    )

    abortController.abort()

    await expect(observer.settled).resolves.toBeUndefined()
    expect(nativeFocus.unlisten).toHaveBeenCalledOnce()
  })
})
