import { describe, expect, it } from 'vitest'
import { resolveAskModelSurfaceStatus } from './askModelSurfaceState'

describe('resolveAskModelSurfaceStatus', () => {
  it('keeps the thread and model selector available when any provider has a ready model', () => {
    expect(
      resolveAskModelSurfaceStatus({
        hasReadyModel: true,
        ollamaStatus: 'error',
      }),
    ).toBe('ready')
  })

  it('shows Ollama discovery progress when no alternative model is ready', () => {
    expect(
      resolveAskModelSurfaceStatus({
        hasReadyModel: false,
        ollamaStatus: 'loading',
      }),
    ).toBe('loading')
  })

  it('shows retryable Ollama failure when discovery fails without an alternative', () => {
    expect(
      resolveAskModelSurfaceStatus({
        hasReadyModel: false,
        ollamaStatus: 'error',
      }),
    ).toBe('error')
  })

  it('shows the configuration state only after discovery succeeds without models', () => {
    expect(
      resolveAskModelSurfaceStatus({
        hasReadyModel: false,
        ollamaStatus: 'success',
      }),
    ).toBe('blocked')
  })
})
