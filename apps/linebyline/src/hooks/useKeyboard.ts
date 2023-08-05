import { invoke } from '@tauri-apps/api'
import { createGlobalStore } from 'hox'
import { useEffect, useState } from 'react'
import type { KeyBindingMap } from 'tinykeys'
import { createKeybindingsHandler } from 'tinykeys'
import { useCommandStore } from '@/stores'

const getTinyKeyBinding = (keyMap: string[]) => {
  let keyBinding = ''
  keyMap.forEach((key, index) => {
    if (key === 'mod') {
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
    invoke<{ cmds: KeyboardInfo[] }>('get_keyboard_infos').then((res) => {
      setKeyboardInfos(res.cmds)
    })
  }, [])

  useEffect(() => {
    const keybindingMap: KeyBindingMap = {}

    keyboardInfos.forEach((keyboardInfo) => {
      if (keyboardInfo.key_map.length > 0) {
        const keybind = getTinyKeyBinding(keyboardInfo.key_map)
        keybindingMap[keybind] = () => {
          execute(keyboardInfo.id)
        }
      }
    })
    console.log('keybindingMap', keybindingMap)
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
}
