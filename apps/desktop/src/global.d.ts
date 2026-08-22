import type { LegacyWindowBootstrap, WindowBootstrap } from './startup/appearance'

declare global {
  interface Window {
    __MARKFLOWY_BOOTSTRAP__?: LegacyWindowBootstrap | WindowBootstrap
    openedUrls: string[] | string | null
  }
}

export {}
