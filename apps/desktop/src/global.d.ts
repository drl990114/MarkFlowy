import type { LegacyWindowBootstrap, WindowBootstrap } from './startup/appearance'

declare global {
  interface Window {
    __MARKFLOWY_BOOTSTRAP__?: LegacyWindowBootstrap | WindowBootstrap
    /** Injected only by the native binary compiled with the e2e Cargo feature. */
    __MARKFLOWY_E2E__?: { errors: string[] }
    openedUrls: string[] | string | null
  }
}

export {}
