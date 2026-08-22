import { darkTheme } from '@markflowy/theme'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  discardStaleStartupTheme,
  runWithoutThemeTransitions,
  scheduleStaleStartupThemeFallback,
  STALE_STARTUP_THEME_TIMEOUT_MS,
} from './staleThemeFallback'

const syntheticTheme = { ...darkTheme, name: 'Local Midnight' }

afterEach(() => {
  vi.useRealTimers()
  document.documentElement.removeAttribute('data-mf-startup-theme-fallback')
  document.querySelectorAll('[data-mf-startup-theme-transition-guard]').forEach((node) => {
    node.remove()
  })
})

describe('stale startup theme fallback', () => {
  it('discards only the exact synthetic theme that has not been replaced', () => {
    const registeredTheme = {
      ...syntheticTheme,
      globalStyleText: ':root { --extension-theme-ready: 1; }',
    }

    expect(discardStaleStartupTheme([darkTheme, syntheticTheme], syntheticTheme)).toEqual([
      darkTheme,
    ])
    expect(discardStaleStartupTheme([darkTheme, registeredTheme], syntheticTheme)).toBeUndefined()
  })

  it('waits one second and reports only an actual fallback', () => {
    vi.useFakeTimers()
    const fallback = vi.fn<() => typeof syntheticTheme | undefined>(() => syntheticTheme)
    const onFallback = vi.fn()

    scheduleStaleStartupThemeFallback({ fallback, onFallback })

    vi.advanceTimersByTime(STALE_STARTUP_THEME_TIMEOUT_MS - 1)
    expect(fallback).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(fallback).toHaveBeenCalledTimes(1)
    expect(onFallback).toHaveBeenCalledWith(syntheticTheme)

    fallback.mockReturnValue(undefined)
    scheduleStaleStartupThemeFallback({ fallback, onFallback })
    vi.advanceTimersByTime(STALE_STARTUP_THEME_TIMEOUT_MS)
    expect(onFallback).toHaveBeenCalledTimes(1)
  })

  it('suppresses transitions through the fallback commit and two frames', () => {
    const frames: FrameRequestCallback[] = []
    const scheduleFrame = (callback: FrameRequestCallback) => {
      frames.push(callback)
      return frames.length
    }
    const apply = vi.fn(() => {
      expect(document.documentElement.hasAttribute('data-mf-startup-theme-fallback')).toBe(true)
      expect(document.querySelector('[data-mf-startup-theme-transition-guard]')).not.toBeNull()
    })

    runWithoutThemeTransitions(apply, document, scheduleFrame)

    expect(apply).toHaveBeenCalledTimes(1)
    expect(document.documentElement.hasAttribute('data-mf-startup-theme-fallback')).toBe(true)
    frames.shift()?.(0)
    expect(document.documentElement.hasAttribute('data-mf-startup-theme-fallback')).toBe(true)
    frames.shift()?.(16)
    expect(document.documentElement.hasAttribute('data-mf-startup-theme-fallback')).toBe(false)
    expect(document.querySelector('[data-mf-startup-theme-transition-guard]')).toBeNull()
  })
})
