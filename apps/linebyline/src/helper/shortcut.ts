import type { ShortcutHandler } from '@tauri-apps/api/globalShortcut'
import {
  register,
  registerAll,
  unregister,
} from '@tauri-apps/api/globalShortcut'

class ShortCutManager {
  shorcuts = new Map()

  register: RegisterFc = async ({ shorcut, desc, handler }) => {
    this.shorcuts.set(shorcut, desc)
    await register(shorcut, handler)
  }

  registerAll: RegisterFc<RegisterParams<string[]>> = async ({
    shorcut,
    desc,
    handler,
  }) => {
    shorcut.forEach((c, index) => this.shorcuts.set(c, desc[index]))
    await registerAll(shorcut, handler)
  }

  unregister: RegisterFc = async ({ shorcut }) => {
    this.shorcuts.delete(shorcut)
    await unregister(shorcut)
  }
}

const ShortCutManagerInstance = new ShortCutManager()
export { ShortCutManagerInstance as ShortCutManager }

type RegisterFc<P = RegisterParams> = (params: P) => Promise<void>
interface RegisterParams<T = string> {
  shorcut: T
  desc: string
  handler: ShortcutHandler
}
