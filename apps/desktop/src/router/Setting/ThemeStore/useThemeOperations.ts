import { useRef, useState } from 'react'
import { logger } from '@/helper/logger'

type ThemeOperationState = { pending: boolean; error?: string }

// Lock before the first await, including confirmation dialogs. Other rows remain usable.
export function useThemeOperations() {
  const locks = useRef(new Set<string>())
  const [operations, setOperations] = useState<Record<string, ThemeOperationState>>({})

  const run = async (
    key: string,
    operation: () => Promise<void>,
    confirm?: () => Promise<boolean>,
  ) => {
    if (locks.current.has(key)) return
    locks.current.add(key)
    // Keep the trigger focusable until the dialog closes, so Radix can restore it.
    setOperations((previous) => ({ ...previous, [key]: { pending: !confirm } }))
    try {
      if (confirm) {
        if (!(await confirm())) return
        setOperations((previous) => ({ ...previous, [key]: { pending: true } }))
      }
      await operation()
      setOperations((previous) => ({ ...previous, [key]: { pending: false } }))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.error('Theme operation failed', { key, error })
      setOperations((previous) => ({ ...previous, [key]: { pending: false, error: message } }))
    } finally {
      locks.current.delete(key)
    }
  }

  return { operations, run }
}
