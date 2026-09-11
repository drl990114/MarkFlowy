import { createJSONStorage, type StateStorage } from 'zustand/middleware'

/** Storage denial or a full disk must not prevent editing or changing the layout. */
export const localStateStorage: StateStorage = {
  getItem: (name) => {
    try {
      return localStorage.getItem(name)
    } catch {
      return null
    }
  },
  setItem: (name, value) => {
    try {
      if (localStorage.getItem(name) !== value) localStorage.setItem(name, value)
    } catch {
      // Keep the live Zustand state usable when persistence is unavailable.
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name)
    } catch {
      // Storage can be disabled by the host.
    }
  },
}

export const jsonStateStorage = <T>() => createJSONStorage<T>(() => localStateStorage)

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
