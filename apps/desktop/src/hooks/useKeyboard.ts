import { useCommandStore } from '@/stores'
import { invoke } from '@tauri-apps/api/core'
import { createGlobalStore } from 'hox'
import { t } from 'i18next'
import { useEffect, useState } from 'react'
// @ts-ignore
import { createKeybindingsHandler } from 'tinykeys'
import { toast } from 'zens'
import { create } from 'zustand'

/**
 * A map of keybinding strings to event handlers.
 */
export type KeyBindingMap = Record<string, (event: KeyboardEvent) => void>

interface EditorKeybindingStore {
  editorKeybingMap: Record<string, string>
  setEditorKeybingMap: (keymap: Record<string, string>) => void
}
export const useEditorKeybindingStore = create<EditorKeybindingStore>((set) => {
  return {
    editorKeybingMap: {},
    setEditorKeybingMap: (keymap) => {
      set(() => {
        return {
          editorKeybingMap: keymap,
        }
      })
    },
  }
})

const getTinyKeyBinding = (keyMap: string[]) => {
  let keyBinding = ''
  keyMap.forEach((key, index) => {
    if (key === 'CommandOrCtrl') {
      keyBinding += '$mod'
    } else {
      keyBinding += key
    }

    if (index < keyMap.length - 1) {
      keyBinding += '+'
    }
  })
  return keyBinding
}

const getRmeKeyBinding = (keyMap: string[]) => {
  let keyBinding = ''
  keyMap.forEach((key, index) => {
    if (key === 'CommandOrCtrl') {
      keyBinding += 'mod'
    } else {
      keyBinding += key
    }

    if (index < keyMap.length - 1) {
      keyBinding += '-'
    }
  })
  return keyBinding
}

function useKeyboard() {
  const [keyboardInfos, setKeyboardInfos] = useState<KeyboardInfo[]>([])
  const { setEditorKeybingMap } = useEditorKeybindingStore()

  useEffect(() => {
    invoke<{ cmds: KeyboardInfo[] }>('get_keyboard_infos').then((res) => {
      console.log('KeyboardInfo', res)
      const cmds: KeyboardInfo[] = res.cmds || []

      setKeyboardInfos(cmds)
    })
  }, [])

  useEffect(() => {
    const keybindingMap: KeyBindingMap = {}
    const editorKeybingMap: Record<string, string> = {}

    keyboardInfos.forEach((keyboardInfo) => {
      if (keyboardInfo.key_map.length > 0) {
        if (keyboardInfo.id.startsWith('editor_')) {
          const keybind = getRmeKeyBinding(keyboardInfo.key_map)
          const key = keyboardInfo.id.replace('editor_', '')

          editorKeybingMap[key] = keybind
        } else {
          const keybind = getTinyKeyBinding(keyboardInfo.key_map)
          keybindingMap[keybind] = () => {
            useCommandStore.getState().execute(keyboardInfo.id)
          }
        }
      }
    })

    setEditorKeybingMap(editorKeybingMap)

    const handler = createKeybindingsHandler(keybindingMap)

    window.addEventListener('keydown', handler)

    return () => {
      window.removeEventListener('keydown', handler)
    }
  }, [keyboardInfos])

  const checkKeyConflict = (commandId: string, newKeyMap: string[]) => {
    const curCommand = keyboardInfos.find(info => info.id === commandId)
    if (!curCommand) {
      return false
    }
    return keyboardInfos.filter(info => info.when === curCommand.when).some((cmd) => {
      if (cmd.key_map.length > 0) {
        const existingKeybinding = getTinyKeyBinding(cmd.key_map)
        const newKeybinding = getTinyKeyBinding(newKeyMap)
        return existingKeybinding === newKeybinding
      }
      return false
    })
  }

  const updateKeyBinding = async (commandId: string, newKeyMap: string[]) => {
    if (checkKeyConflict(commandId, newKeyMap)) {
      toast.error(t('settings.keyboard.shortcut_conflict'))
      return false
    }

    const success = await invoke('update_keybinding', {
      id: commandId,
      newKeyMap,
    })

    if (success) {
      setKeyboardInfos((prev) =>
        prev.map((cmd) => (cmd.id === commandId ? { ...cmd, key_map: [...newKeyMap] } : cmd)),
      )
    }
  }

  return {
    keyboardInfos,
    updateKeyBinding,
  }
}

const [useGlobalKeyboard] = createGlobalStore(useKeyboard)

export default useGlobalKeyboard

export interface KeyboardInfo {
  id: string
  key_map: string[]
  when: string
}
