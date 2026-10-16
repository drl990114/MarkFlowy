import { Compartment, StateEffect } from '@codemirror/state'
import { EditorView, type ViewUpdate } from '@codemirror/view'
import type { MfCodemirrorView } from 'rme'

export function subscribeSourceOutline(
  editor: MfCodemirrorView,
  listener: (update: ViewUpdate) => void,
) {
  const compartment = new Compartment()
  editor.cm.dispatch({
    effects: StateEffect.appendConfig.of(compartment.of(EditorView.updateListener.of(listener))),
  })
  return () => {
    if (!editor.isDestroyed) editor.cm.dispatch({ effects: compartment.reconfigure([]) })
  }
}

/** Distinguish reading gestures from scrolling performed to reveal the caret. */
export function subscribeOutlineScrollIntent(viewport: HTMLElement, onScrollIntent: () => void) {
  const pane = viewport.closest<HTMLElement>('[data-editor-id]') ?? viewport
  const onPointerDown = (event: PointerEvent) => {
    const target = event.target
    if (!(target instanceof Element)) return
    if (target.closest('.os-scrollbar') || target === viewport) onScrollIntent()
  }
  const onKeyDown = (event: KeyboardEvent) => {
    if (
      event.target === viewport &&
      ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)
    )
      onScrollIntent()
  }
  viewport.addEventListener('wheel', onScrollIntent, { passive: true })
  viewport.addEventListener('touchmove', onScrollIntent, { passive: true })
  viewport.addEventListener('keydown', onKeyDown)
  pane.addEventListener('pointerdown', onPointerDown, true)
  return () => {
    viewport.removeEventListener('wheel', onScrollIntent)
    viewport.removeEventListener('touchmove', onScrollIntent)
    viewport.removeEventListener('keydown', onKeyDown)
    pane.removeEventListener('pointerdown', onPointerDown, true)
  }
}
