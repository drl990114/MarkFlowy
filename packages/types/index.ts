import type { MfTheme } from '@markflowy/theme'

export type MF_CONTEXT = {
  theme: {
    registerTheme: (theme: MfTheme) => void
  }
}

export type Extension = {
  name: string
  version: string
  description: string
}
