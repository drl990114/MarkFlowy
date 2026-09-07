import { defineConfig } from 'vitest/config'
import desktopConfig from './vite.config'

/** Run the same integration suite through Desktop's verified package resolver. */
export default defineConfig(async (environment) => {
  const base = await (typeof desktopConfig === 'function'
    ? desktopConfig(environment)
    : desktopConfig)
  if (base.define?.__MARKFLOWY_CAPRICORN_RUNTIME_AVAILABLE__ !== 'true') {
    throw new Error(
      'Install the pinned Capricorn runtime before running package integration tests.',
    )
  }
  return {
    ...base,
    test: { ...base.test, include: ['tests/capricorn-search.integration.tsx'] },
  }
})
