import { createAppShortcutHandler, createFindShortcutHandler } from '@/helper/findShortcut'
import { EVENT } from '@/constants'
import { openDocumentSearch } from '@/components/EditorArea/editorSearchStore'
import { getCapricornEditor } from '@/components/EditorArea/capricornEditorRegistry'
import useEditorStore from '@/stores/useEditorStore'
import { commandRegistry, keybindingRegistry } from '@/commands'
import { sameKeyMap, normalizeKeyMap, validateKeyMap } from '@/commands/keybindingKeys'
import { editorKeymap, keybindingProblem } from '@/commands/keybindingValidation'
import type {
  EditorShortcutMap,
  KeyboardBinding,
  KeybindingSnapshot,
} from '@/commands/keybindingCatalog'
import { createCapricornKeybindingConfiguration } from '@/components/EditorArea/capricornKeybindings'
import { listen } from '@tauri-apps/api/event'
import { logger } from '@/helper/logger'
import { invoke } from '@tauri-apps/api/core'
import { createGlobalStore } from 'hox'
import { t } from '@/i18n'
import { useCallback, useEffect, useRef, useState } from 'react'
import { create } from 'zustand'

export type KeyBindingMap = Record<string, (event: KeyboardEvent) => void>

interface EditorKeybindingStore {
  editorKeybindingsLoaded: boolean
  editorKeybingMap: EditorShortcutMap
  setEditorKeybingMap: (keymap: EditorShortcutMap) => void
}
export const useEditorKeybindingStore = create<EditorKeybindingStore>((set) => {
  return {
    editorKeybindingsLoaded: false,
    editorKeybingMap: {},
    setEditorKeybingMap: (keymap) => {
      set(() => {
        return {
          editorKeybindingsLoaded: true,
          editorKeybingMap: keymap,
        }
      })
    },
  }
})

function isEditorTarget(target: EventTarget | null) {
  return (
    target instanceof Element &&
    Boolean(target.closest('.ProseMirror, .cm-editor, [data-cap-input], [data-cap-content]'))
  )
}

function useKeyboard() {
  const [keyboardInfos, setKeyboardInfos] = useState<KeyboardInfo[]>([])
  const [loadError, setLoadError] = useState<string>()
  const bindingsRef = useRef(keyboardInfos)
  const savingRef = useRef(false)
  const reloadRevision = useRef(0)
  const appliedRevision = useRef(0)
  const applyBindings = useCallback((snapshot: KeybindingSnapshot) => {
    if (snapshot.revision <= appliedRevision.current) return
    appliedRevision.current = snapshot.revision
    const normalized = snapshot.rules.map((cmd) => ({
      ...cmd,
      keys: normalizeKeyMap(cmd.keys) ?? cmd.keys,
    }))
    bindingsRef.current = normalized
    keybindingRegistry.setKeybindings(normalized)
    useEditorKeybindingStore.getState().setEditorKeybingMap(editorKeymap(normalized))
    setKeyboardInfos(normalized)
    setLoadError(undefined)
  }, [])
  const reload = useCallback(async () => {
    const revision = ++reloadRevision.current
    const previousSnapshot = appliedRevision.current
    try {
      const res = await invoke<KeybindingSnapshot>('get_keyboard_infos')
      if (revision === reloadRevision.current) applyBindings(res)
    } catch (error) {
      if (revision !== reloadRevision.current || previousSnapshot !== appliedRevision.current)
        return
      logger.error('Failed to load keyboard bindings', error)
      setLoadError(t('settings.keyboard.load_failed'))
    }
  }, [applyBindings])
  useEffect(() => {
    let disposed = false
    let unlisten: (() => void) | undefined
    // Register before reading so another window cannot leave this one with a stale snapshot.
    void listen('keyboard-bindings-changed', () => {
      if (!disposed) void reload()
    })
      .then((dispose) => {
        if (disposed) dispose()
        else unlisten = dispose
      })
      .catch((error) => logger.warn('Keyboard change listener unavailable', error))
      .finally(() => {
        if (!disposed) void reload()
      })
    return () => {
      disposed = true
      reloadRevision.current += 1
      unlisten?.()
    }
  }, [reload])

  useEffect(() => {
    const composing = () => {
      const { activeId } = useEditorStore.getState()
      return Boolean(activeId && getCapricornEditor(activeId)?.isComposing())
    }
    const ordinary = keyboardInfos
      .filter(
        (binding) =>
          binding.target === 'app' &&
          binding.command !== 'app_findReplaceEditor' &&
          binding.command !== EVENT.app_quickOpen &&
          !validateKeyMap(binding.keys, binding.command),
      )
      .map((binding) =>
        createAppShortcutHandler(keybindingRegistry.getKeyBindingString(binding.keys), (event) => {
          if (composing() || event.repeat || !commandRegistry.hasCommand(binding.command))
            return false
          if (binding.when === 'editor_focus' && !isEditorTarget(event.target)) return false
          void commandRegistry
            .execute(binding.command)
            .catch((error) => logger.error('Keyboard command failed', error))
          return true
        }),
      )
    const handler = (event: KeyboardEvent) => {
      for (const handle of ordinary) {
        handle(event)
        if (event.defaultPrevented) break
      }
    }
    // Explicit host bindings own their keys in an editor, including keys reclaimed
    // from its default keymap. Other inputs can still consume keys before bubbling.
    const editorHandler = (event: KeyboardEvent) => {
      if (isEditorTarget(event.target)) handler(event)
    }
    const shortcutsFor = (commandId: string, fallback: string): string[] => {
      const bindings = keyboardInfos.filter((item) => item.command === commandId)
      if (!bindings.length) return keyboardInfos.length ? [] : [fallback]
      return bindings.flatMap((binding) =>
        validateKeyMap(binding.keys, binding.command) || !binding.keys.length
          ? []
          : [keybindingRegistry.getKeyBindingString(binding.keys)],
      )
    }
    const findHandlers = shortcutsFor('app_findReplaceEditor', 'mod-f').map((keys) =>
      createFindShortcutHandler(keys, () => !composing() && openDocumentSearch()),
    )
    const quickOpenHandlers = shortcutsFor(EVENT.app_quickOpen, 'mod-p').map((keys) =>
      createAppShortcutHandler(
        keys,
        () => {
          if (composing() || !commandRegistry.hasCommand(EVENT.app_quickOpen)) return false
          void commandRegistry
            .execute(EVENT.app_quickOpen)
            .catch((error) => logger.error('Quick Open failed', error))
          return true
        },
        '[data-mf-quick-open]',
      ),
    )
    const specializedHandlers = [...findHandlers, ...quickOpenHandlers]
    specializedHandlers.forEach((handle) => window.addEventListener('keydown', handle, true))
    window.addEventListener('keydown', editorHandler, true)
    window.addEventListener('keydown', handler)
    return () => {
      specializedHandlers.forEach((handle) => window.removeEventListener('keydown', handle, true))
      window.removeEventListener('keydown', editorHandler, true)
      window.removeEventListener('keydown', handler)
    }
  }, [keyboardInfos])

  const validateKeyBinding = (ruleId: string, keys: string[]): string | undefined => {
    const problem = keybindingProblem(bindingsRef.current, ruleId, keys)
    if (problem?.type === 'conflict')
      return t('settings.keyboard.conflict_with', {
        command: t(`command.id_descriptions.${problem.command}`),
      })
    if (problem) return t(`settings.keyboard.${problem.type}_binding`)
    const selected = bindingsRef.current.find((binding) => binding.id === ruleId)
    if (selected?.target === 'editor') {
      const { activeId } = useEditorStore.getState()
      const editor = activeId ? getCapricornEditor(activeId) : undefined
      const next = bindingsRef.current.map((binding) =>
        binding.id === ruleId ? { ...binding, keys: normalizeKeyMap(keys)! } : binding,
      )
      const result = editor?.validateKeybindings(
        createCapricornKeybindingConfiguration(editorKeymap(next), true),
      )
      if (result && !result.ok) return t('settings.keyboard.unsupported_binding')
    }
    return undefined
  }
  const updateKeyBinding = async (ruleId: string, newKeys: string[]): Promise<boolean> => {
    if (savingRef.current) throw new Error(t('settings.keyboard.saving'))
    const problem = validateKeyBinding(ruleId, newKeys)
    if (problem) throw new Error(problem)
    const keys = normalizeKeyMap(newKeys)!
    const current = bindingsRef.current.find((binding) => binding.id === ruleId)
    if (current && sameKeyMap(current.keys, keys)) return true
    savingRef.current = true
    try {
      const snapshot = await invoke<KeybindingSnapshot>('update_keybinding', { ruleId, keys })
      applyBindings(snapshot)
      return true
    } catch (error) {
      logger.error('Failed to save keyboard binding', error)
      throw new Error(t('settings.keyboard.save_failed'))
    } finally {
      savingRef.current = false
    }
  }
  return { keyboardInfos, loadError, reload, validateKeyBinding, updateKeyBinding }
}

const [useGlobalKeyboard] = createGlobalStore(useKeyboard)
export default useGlobalKeyboard
export type KeyboardInfo = KeyboardBinding
