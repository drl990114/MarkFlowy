import { invoke } from '@tauri-apps/api/core'
import { createGlobalStore } from 'hox'
import { useEffect, useState } from 'react'
// @ts-ignore
import { createKeybindingsHandler } from 'tinykeys'
import { useCommandStore } from '@/stores'

/**
 * A map of keybinding strings to event handlers.
 */
export type KeyBindingMap = Record<string, (event: KeyboardEvent) => void>;

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

function useKeyboard() {
  const [keyboardInfos, setKeyboardInfos] = useState<KeyboardInfo[]>([])
  const { execute } = useCommandStore()

  useEffect(() => {
    invoke<{ cmds: Record<string, KeyboardInfo> }>('get_keyboard_infos').then((res) => {
      const cmds: KeyboardInfo[] = []

      Object.keys(res.cmds).forEach((v) => {
        cmds.push(res.cmds[v])
      })

      setKeyboardInfos(cmds)
    })
  }, [])

  useEffect(() => {
    const keybindingMap: KeyBindingMap = {}

    keyboardInfos.forEach((keyboardInfo) => {
      if (keyboardInfo.key_map.length > 0) {
        const keybind = getTinyKeyBinding(keyboardInfo.key_map)
        keybindingMap[keybind] = (event) => {
          if (!keyboardInfo.use_default_event) {
            event.preventDefault()
          }
          execute(keyboardInfo.id)
        }
      }
    })

    const handler = createKeybindingsHandler(keybindingMap)

    window.addEventListener('keydown', handler)

    return () => {
      window.removeEventListener('keydown', handler)
    }
  }, [execute, keyboardInfos])

  return {
    keyboardInfos,
  }
}

const [useGlobalKeyboard] = createGlobalStore(useKeyboard)

export default useGlobalKeyboard

interface KeyboardInfo {
  id: string
  desc: string
  key_map: string[]
  use_default_event: boolean
}
