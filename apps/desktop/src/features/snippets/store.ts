import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { useEffect } from 'react'
import { create } from 'zustand'
import type { SnippetLibrary, SnippetMutation } from './types'

interface SnippetState {
  library: SnippetLibrary
  loaded: boolean
  error: string | null
}

export const useSnippetStore = create<SnippetState>(() => ({
  library: { version: 1, revision: 0, items: [], hiddenBuiltinIds: [] },
  loaded: false,
  error: null,
}))

function publish(library: SnippetLibrary) {
  if (library.revision < useSnippetStore.getState().library.revision) return
  useSnippetStore.setState({ library, loaded: true, error: null })
}

let loadSequence = 0
let committedWrites = 0
export async function loadSnippets(): Promise<void> {
  const sequence = ++loadSequence
  const writesAtStart = committedWrites
  try {
    const library = await invoke<SnippetLibrary>('get_snippets')
    if (sequence === loadSequence) publish(library)
  } catch (error) {
    if (sequence === loadSequence && writesAtStart === committedWrites)
      useSnippetStore.setState({ error: String(error) })
  }
}

export async function mutateSnippet(
  mutation: SnippetMutation,
  expectedRevision: number,
): Promise<SnippetLibrary> {
  try {
    const library = await invoke<SnippetLibrary>('mutate_snippets', { mutation, expectedRevision })
    // A broadcast read can already contain a newer write from another window.
    // Keep it alive; publish's revision check rejects older snapshots.
    ++committedWrites
    publish(library)
    return library
  } catch (error) {
    // Keep the current draft with its original revision. Never silently rebase an edit.
    if (String(error).includes('snippets_conflict')) await loadSnippets()
    throw error
  }
}

let subscribers = 0
let cleanup: (() => void) | undefined
let listenerGeneration = 0

/** Share one native listener across tabs, split editors and the settings page. */
export function subscribeSnippetLibrary() {
  subscribers += 1
  if (subscribers === 1) {
    const generation = ++listenerGeneration
    void listen('snippets-changed', () => {
      void loadSnippets()
    })
      .then((unlisten) => {
        if (generation !== listenerGeneration || !subscribers) unlisten()
        else cleanup = unlisten
        // Listen before reading so a write cannot fall between the initial read and subscription.
        if (generation === listenerGeneration && subscribers) void loadSnippets()
      })
      .catch(() => {
        if (generation === listenerGeneration && subscribers) void loadSnippets()
      })
  }
  return () => {
    subscribers -= 1
    if (!subscribers) {
      ++listenerGeneration
      cleanup?.()
      cleanup = undefined
    }
  }
}

export function useSnippetLibrary() {
  useEffect(subscribeSnippetLibrary, [])
  return useSnippetStore()
}
