/// <reference types="vite/client" />

declare const __MARKFLOWY_CAPRICORN_RUNTIME_AVAILABLE__: boolean
declare const __MARKFLOWY_CAPRICORN_RUNTIME_VERSION__: string | null
declare const __MARKFLOWY_CAPRICORN_RUNTIME_ENTRY_SHA256__: string | null

declare module 'virtual:markflowy-capricorn-runtime' {
  export const createCapricornRuntime: unknown
  export const createCapricornRuntimeAsync: unknown
  export const prewarmCapricornRuntime: unknown
}
