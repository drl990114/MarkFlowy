import { create } from 'zustand'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { builtInThemes, type MfTheme } from '@markflowy/theme'
import { parseThemeDocument, type ThemeDocument } from '@markflowy/theme/semantic'
import useThemeStore, { FALLBACK_DARK_THEME, FALLBACK_LIGHT_THEME } from '@/stores/useThemeStore'
import { loadLocalThemeCss } from '@/helper/extensions'
import { toAppTheme } from './runtime'
export interface CssSnippet {
  id: string
  name: string
  css: string
  enabled: boolean
}
export interface ThemeLibrary {
  revision: number
  documents: ThemeDocument[]
  snippets: CssSnippet[]
}
type ThemeLibraryPayload = Omit<ThemeLibrary, 'documents'> & { documents: unknown[] }
export type ThemeMutation =
  | { type: 'save'; document: ThemeDocument; replace: boolean }
  | { type: 'remove'; id: string }
  | { type: 'saveSnippet'; snippet: CssSnippet }
  | { type: 'removeSnippet'; id: string }
  | { type: 'moveSnippet'; id: string; offset: number }
  | { type: 'disableSnippets' }
interface LibraryState extends ThemeLibrary {
  loaded: boolean
  error?: string
  reload: () => Promise<void>
  mutate: (mutation: ThemeMutation) => Promise<void>
}
const documentId = (value: unknown) =>
  value && typeof value === 'object' && 'id' in value && typeof value.id === 'string'
    ? value.id
    : undefined
export const useThemeLibrary = create<LibraryState>((set, get) => {
  let loadSequence = 0
  let acceptanceSequence = 0
  let pendingAcceptance: { revision: number; promise: Promise<void> } | undefined
  let documentErrors: string[] = []
  const libraryError = () => {
    const store = useThemeStore.getState()
    const errors = [...documentErrors]
    for (const [name, mode] of [
      [store.lightThemeName, 'light'],
      [store.darkThemeName, 'dark'],
    ] as const) {
      if (name && !store.themes.some((theme) => theme.name === name && theme.mode === mode)) {
        errors.push(`Unavailable theme: ${name}. Using a temporary ${mode} fallback.`)
      }
    }
    return errors.join('\n') || undefined
  }
  const apply = async (data: ThemeLibraryPayload, sequence: number) => {
    const previous = get()
    // Snippet edits should not rebuild editors, reapply the native theme or rewrite appearance.
    if (previous.loaded && JSON.stringify(data.documents) === JSON.stringify(previous.documents)) {
      loadLocalThemeCss(
        data.snippets.filter((snippet) => snippet.enabled).map((snippet) => snippet.css),
      )
      set({ revision: data.revision, snippets: data.snippets, error: libraryError() })
      return
    }
    const selection = useThemeStore.getState()
    const mode = selection.themeMode === 'system' ? selection.systemTheme : selection.themeMode
    const selectedName = mode === 'dark' ? selection.darkThemeName : selection.lightThemeName
    const selectedId = selectedName?.split('/')[0]
    const ids = new Set<string>()
    const duplicates = new Set<string>()
    data.documents.forEach((document) => {
      const id = documentId(document)
      if (!id) return
      if (ids.has(id)) duplicates.add(id)
      ids.add(id)
    })
    const ordered = data.documents
      .map((document, index) => ({ document, index }))
      .sort(
        (a, b) =>
          Number(documentId(b.document) === selectedId) -
          Number(documentId(a.document) === selectedId),
      )
    const prepared: { document: ThemeDocument; themes: MfTheme[]; index: number }[] = []
    const errors = [...duplicates].map((id) => `Duplicate theme id: ${id}`)
    let processed = 0
    for (const { document, index } of ordered) {
      try {
        if (!duplicates.has(documentId(document) ?? '')) {
          const valid = parseThemeDocument(document)
          const themes = valid.variants.map((variant) => toAppTheme(valid, variant))
          prepared.push({ document: valid, themes, index })
          if (!get().loaded) {
            const active = themes.find(
              (theme) => theme.name === selectedName && theme.mode === mode,
            )
            if (active) {
              const store = useThemeStore.getState()
              useThemeStore.setState({
                themes: [...store.themes.filter((item) => item.name !== selectedName), active],
              })
              useThemeStore.getState().applyTheme(false)
            }
          }
        }
      } catch (error) {
        errors.push(`${documentId(document) ?? 'Theme'}: ${String(error)}`)
      }
      if (++processed % 8 === 0) await new Promise<void>((resolve) => setTimeout(resolve, 0))
      if (sequence !== acceptanceSequence) return
    }
    prepared.sort((a, b) => a.index - b.index)
    const documents = prepared.map((item) => item.document)
    const themes = [...builtInThemes, ...prepared.flatMap((item) => item.themes)]
    useThemeStore.setState({ themes })
    documentErrors = errors
    // A corrupt or temporarily unavailable document must not erase the user's chosen identity.
    const store = useThemeStore.getState()
    const selectedMode = store.themeMode === 'system' ? store.systemTheme : store.themeMode
    const selected = selectedMode === 'dark' ? store.darkThemeName : store.lightThemeName
    const active = themes.find((theme) => theme.name === selected && theme.mode === selectedMode)
    // Persist real changes to the selected palette, including updates from another window.
    // Temporary fallbacks must leave the last known custom-theme appearance intact.
    const persistAppearance = Boolean(
      active &&
        (active.name !== selection.curTheme?.name ||
          active.mode !== selection.curTheme?.mode ||
          JSON.stringify(active.styledConstants) !==
            JSON.stringify(selection.curTheme?.styledConstants)),
    )
    store.applyTheme(persistAppearance)
    loadLocalThemeCss(
      data.snippets.filter((snippet) => snippet.enabled).map((snippet) => snippet.css),
    )
    set({ ...data, documents, loaded: true, error: libraryError() })
  }
  const accept = (data: ThemeLibraryPayload): Promise<void> => {
    if (data.revision < Math.max(get().revision, pendingAcceptance?.revision ?? -1))
      return Promise.resolve()
    if (pendingAcceptance?.revision === data.revision) return pendingAcceptance.promise
    if (get().loaded && data.revision === get().revision) {
      set({ error: libraryError() })
      return Promise.resolve()
    }
    const sequence = ++acceptanceSequence
    const promise = apply(data, sequence).finally(() => {
      if (pendingAcceptance?.promise === promise) pendingAcceptance = undefined
    })
    pendingAcceptance = { revision: data.revision, promise }
    return promise
  }
  return {
    revision: 0,
    documents: [],
    snippets: [],
    loaded: false,
    reload: async () => {
      const sequence = ++loadSequence
      try {
        const data = await invoke<ThemeLibraryPayload>('get_theme_library')
        if (sequence === loadSequence) await accept(data)
      } catch (error) {
        if (sequence === loadSequence) set({ error: String(error) })
        throw error
      }
    },
    mutate: async (mutation) => {
      if (mutation.type === 'save')
        mutation = { ...mutation, document: parseThemeDocument(mutation.document) }
      const data = await invoke<ThemeLibraryPayload>('mutate_theme_library', { mutation })
      await accept(data)
      // The event may have started accepting a newer response before this mutation returned.
      // Callers can safely select the saved variant only after that catalog is installed.
      while (pendingAcceptance) await pendingAcceptance.promise
      if (mutation.type === 'remove') {
        const removedId = mutation.id
        if (get().documents.some((document) => document.id === removedId)) return
        const store = useThemeStore.getState()
        const prefix = `${removedId}/`
        const reset = {
          ...(store.lightThemeName?.startsWith(prefix) && { lightThemeName: FALLBACK_LIGHT_THEME }),
          ...(store.darkThemeName?.startsWith(prefix) && { darkThemeName: FALLBACK_DARK_THEME }),
        }
        if (Object.keys(reset).length) {
          await store.applyThemeSelection(reset)
          set({ error: libraryError() })
        }
      }
    },
  }
})
let syncStarted = false
export async function startThemeLibrary() {
  if (!syncStarted) {
    syncStarted = true
    try {
      await listen('themes-changed', () => {
        void useThemeLibrary
          .getState()
          .reload()
          .catch(() => undefined)
      })
    } catch {
      syncStarted = false
      /* A browser preview does not have native events. */
    }
  }
  await useThemeLibrary.getState().reload()
}
