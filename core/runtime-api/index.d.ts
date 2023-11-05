import type { MF_CONTEXT } from '@markflowy/types'

declare global {
  interface Window {
    __MF__: MF_CONTEXT
  }
}

export {}
