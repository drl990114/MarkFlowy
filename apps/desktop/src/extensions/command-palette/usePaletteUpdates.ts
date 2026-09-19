import { commandRegistry } from '@/commands'
import { subscribeCapricornEditors } from '@/components/EditorArea/capricornEditorRegistry'
import { subscribeSourceCodeEditors } from '@/components/EditorArea/sourceCodeEditorRegistry'
import useEditorStore from '@/stores/useEditorStore'
import useEditorViewTypeStore from '@/stores/useEditorViewTypeStore'
import useFileTypeConfigStore from '@/stores/useFileTypeConfigStore'
import useLayoutStore from '@/stores/useLayoutStore'
import { Compartment, StateEffect } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { useEffect, useReducer } from 'react'
import type { EditorCommandTarget } from './editorCommands'

/** Subscribe only while the palette is open; no background editor work. */
export function usePaletteUpdates(target: EditorCommandTarget | null) {
  const [, update] = useReducer((revision: number) => revision + 1, 0)
  useEffect(() => {
    const subscriptions = [
      useEditorStore.subscribe(update),
      useEditorViewTypeStore.subscribe(update),
      useFileTypeConfigStore.subscribe(update),
      useLayoutStore.subscribe(update),
      subscribeCapricornEditors(update),
      subscribeSourceCodeEditors(update),
      commandRegistry.onDidChangeCommands(update).dispose,
      target?.rich?.subscribeUiState(update),
    ]
    const compartment = new Compartment()
    const source = target?.source
    if (source)
      source.dispatch({
        effects: StateEffect.appendConfig.of(compartment.of(EditorView.updateListener.of(update))),
      })
    return () => {
      subscriptions.forEach((unsubscribe) => unsubscribe?.())
      if (source?.dom.isConnected) source.dispatch({ effects: compartment.reconfigure([]) })
    }
  }, [target])
}
