import type { EditorView } from '@codemirror/view'
import { EditorView as CodeMirrorView } from '@codemirror/view'
import { Compartment, StateEffect } from '@codemirror/state'
import {
  registerEditorResumeSave,
  createEditorResumeStore,
  type EditorResume,
  type ResumeSelection,
} from '@/stores/editorResumeStore'

interface ResumeOptions {
  container: HTMLElement
  path: string
  group: string
  mode: string
  isVisible: () => boolean
  shouldRestore?: () => boolean
  isComposing: () => boolean
  captureSelection: () => ResumeSelection | undefined
  restoreSelection: (selection: ResumeSelection) => void
  subscribeSelection: (listener: () => void) => () => void
  waitForResources?: () => Promise<void>
}

/** Bind once per mounted editor. Only settled view state is written to Zustand. */
export function bindEditorResume(options: ResumeOptions): () => void {
  const { container, isVisible, isComposing } = options
  const store = createEditorResumeStore(options.path, options.group, options.mode)
  const saved = store.getState().resume
  const viewport =
    container
      .closest('[data-editor-id]')
      ?.querySelector<HTMLElement>('[data-overlayscrollbars-viewport]') ??
    container.closest<HTMLElement>('.cm-scroller') ??
    container
  let applyingSelection = false
  let disposed = false
  let restoring = Boolean(saved) && (options.shouldRestore?.() ?? true)
  let timer: ReturnType<typeof setTimeout> | undefined
  let frame = 0
  let lastSelection = saved?.selection
  let pending: EditorResume | undefined

  const capture = () => {
    if (disposed || restoring || !isVisible() || isComposing() || !container.isConnected) return
    lastSelection = options.captureSelection() ?? lastSelection
    pending = {
      scrollTop: Math.max(0, viewport.scrollTop),
      scrollLeft: Math.max(0, viewport.scrollLeft),
      selection: lastSelection,
    }
  }
  const save = () => {
    clearTimeout(timer)
    capture()
    if (pending) {
      store.getState().save(pending)
      pending = undefined
    }
  }
  const scheduleSave = () => {
    if (restoring) return
    capture()
    clearTimeout(timer)
    timer = setTimeout(save, 160)
  }
  const cancelRestore = () => {
    restoring = false
    cancelAnimationFrame(frame)
    scheduleSave()
  }
  const restoreScroll = () => {
    if (!restoring || disposed || !saved || !isVisible()) return
    if (options.shouldRestore?.() === false) {
      cancelRestore()
      return
    }
    viewport.scrollTop = saved.scrollTop
    viewport.scrollLeft = saved.scrollLeft
  }
  frame = requestAnimationFrame(() => {
    if (disposed || !saved || !restoring || !isVisible() || options.shouldRestore?.() === false) {
      restoring = false
      return
    }
    if (saved.selection && !isComposing()) {
      applyingSelection = true
      try {
        options.restoreSelection(saved.selection)
      } finally {
        applyingSelection = false
      }
    }
    restoreScroll()
    // Images, math and virtualization can change geometry after the first commit.
    void Promise.resolve(options.waitForResources?.())
      .catch(() => {})
      .then(() => {
        if (disposed || !restoring) return
        frame = requestAnimationFrame(() => {
          restoreScroll()
          restoring = false
        })
      })
  })
  const unsubscribe = options.subscribeSelection(() => {
    if (restoring && !applyingSelection) cancelRestore()
    scheduleSave()
  })
  viewport.addEventListener('scroll', scheduleSave, { passive: true })
  container.addEventListener('compositionend', scheduleSave)
  for (const event of ['pointerdown', 'keydown', 'beforeinput', 'wheel', 'touchstart']) {
    viewport.addEventListener(event, cancelRestore, { passive: true, capture: true })
  }
  const unregisterSave = registerEditorResumeSave(save)
  window.addEventListener('pagehide', save)
  window.addEventListener('blur', save)
  return () => {
    save()
    disposed = true
    unregisterSave()
    clearTimeout(timer)
    cancelAnimationFrame(frame)
    unsubscribe()
    viewport.removeEventListener('scroll', scheduleSave)
    container.removeEventListener('compositionend', scheduleSave)
    for (const event of ['pointerdown', 'keydown', 'beforeinput', 'wheel', 'touchstart']) {
      viewport.removeEventListener(event, cancelRestore, true)
    }
    window.removeEventListener('pagehide', save)
    window.removeEventListener('blur', save)
  }
}

export function bindSourceEditorResume(
  view: EditorView,
  options: Pick<ResumeOptions, 'path' | 'group' | 'isVisible' | 'shouldRestore'>,
) {
  return bindEditorResume({
    ...options,
    container: view.dom,
    mode: 'source',
    isComposing: () => view.composing,
    captureSelection: () => ({
      kind: 'source',
      anchor: view.state.selection.main.anchor,
      head: view.state.selection.main.head,
    }),
    restoreSelection: (selection) => {
      if (selection.kind !== 'source') return
      view.dispatch({
        selection: {
          anchor: Math.min(selection.anchor, view.state.doc.length),
          head: Math.min(selection.head, view.state.doc.length),
        },
      })
    },
    subscribeSelection: (listener) => {
      const compartment = new Compartment()
      view.dispatch({
        effects: StateEffect.appendConfig.of(
          compartment.of(
            CodeMirrorView.updateListener.of((update) => {
              if (update.selectionSet || update.docChanged) listener()
            }),
          ),
        ),
      })
      return () => {
        if (view.dom.isConnected) view.dispatch({ effects: compartment.reconfigure([]) })
      }
    },
  })
}
