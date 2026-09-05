// Vite enables this only when the private package manifest and entry are valid.
// Keep the capability flag independent of editor/UI imports for startup checks.
export const isCapricornRuntimeAvailable =
  typeof __MARKFLOWY_CAPRICORN_RUNTIME_AVAILABLE__ !== 'undefined' &&
  __MARKFLOWY_CAPRICORN_RUNTIME_AVAILABLE__

export const capricornRuntimeVersion =
  typeof __MARKFLOWY_CAPRICORN_RUNTIME_VERSION__ === 'string'
    ? __MARKFLOWY_CAPRICORN_RUNTIME_VERSION__
    : undefined

// Identity of the actually resolved entry, not a newly published package pin.
export const capricornRuntimeEntrySha256 =
  typeof __MARKFLOWY_CAPRICORN_RUNTIME_ENTRY_SHA256__ === 'string'
    ? __MARKFLOWY_CAPRICORN_RUNTIME_ENTRY_SHA256__
    : undefined
