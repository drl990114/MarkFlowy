import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ZenModeButton } from './ZenModeButton'
import {
  HOVER_PLAYBACK_RATE,
  interpolateRotationRate,
  syncZenIconRotation,
  ZenModeIcon,
} from './ZenModeIcon'

const zenModeButtonState = vi.hoisted(() => ({
  activeId: undefined as string | undefined,
  keyMap: ['CommandOrCtrl', 'Shift', 'f'] as string[],
}))

vi.mock('@/commands', () => ({
  commandRegistry: { execute: vi.fn() },
  keybindingRegistry: {
    formatKeyMap: (keyMap: string[]) => (keyMap.includes('k') ? '⌥K' : '⌘⇧F'),
  },
}))

vi.mock('@/hooks', () => ({
  useGlobalKeyboard: () => ({
    keyboardInfos: [
      { id: 'app_toggleZenMode', key_map: zenModeButtonState.keyMap, when: 'always' },
    ],
  }),
}))

vi.mock('@/i18n', () => ({
  useTranslation: () => ({
    t: () => 'Toggle Zen Mode',
  }),
}))

vi.mock('@/stores', () => ({
  useEditorStore: (selector: (state: { activeId?: string }) => unknown) =>
    selector({ activeId: zenModeButtonState.activeId }),
}))

beforeEach(() => {
  zenModeButtonState.activeId = undefined
  zenModeButtonState.keyMap = ['CommandOrCtrl', 'Shift', 'f']
})

describe('ZenModeButton', () => {
  it('stays hidden when no document is active', () => {
    expect(renderToStaticMarkup(<ZenModeButton />)).toBe('')
  })

  it('renders an accessible status-bar action for the active document', () => {
    zenModeButtonState.activeId = 'document-1'
    const markup = renderToStaticMarkup(<ZenModeButton />)

    expect(markup).toContain('<button')
    expect(markup).toContain('type="button"')
    expect(markup).toContain('aria-label="Toggle Zen Mode (⌘⇧F)"')
    expect(markup).toContain('data-zen-mode-toggle=""')
    expect(markup).toContain('data-mf-zen-mode-icon=""')
    expect(markup).toContain('data-mf-zen-mode-icon-rotor=""')
    expect(markup).toContain('data-mf-zen-mode-triad=""')
    expect(markup).toContain('data-mf-zen-mode-still-point=""')
    expect(markup).toContain('transform-box:view-box')
    expect(markup).toContain('transform-origin:center')
    expect(markup).not.toContain('transform-box:fill-box')
    expect(markup).toContain('transform="rotate(120 10 10)"')
    expect(markup).toContain('transform="rotate(240 10 10)"')
    expect(markup).not.toContain('<rect')
    expect(markup).toContain('aria-hidden="true"')
  })

  it('uses the current editable shortcut in its accessible label', () => {
    zenModeButtonState.activeId = 'document-1'
    zenModeButtonState.keyMap = ['Alt', 'k']

    expect(renderToStaticMarkup(<ZenModeButton />)).toContain(
      'aria-label="Toggle Zen Mode (⌥K)"',
    )
  })
})

describe('ZenModeIcon', () => {
  it('pauses at rest and plays only while hovered', () => {
    const animation = { pause: vi.fn(), play: vi.fn() }

    syncZenIconRotation(animation, false)
    expect(animation.pause).toHaveBeenCalledOnce()
    expect(animation.play).not.toHaveBeenCalled()

    syncZenIconRotation(animation, true)
    expect(animation.play).toHaveBeenCalledOnce()
  })

  it('uses an ease-out ramp when hover rotation begins', () => {
    expect(interpolateRotationRate(0, HOVER_PLAYBACK_RATE, 0)).toBe(0)
    expect(interpolateRotationRate(0, HOVER_PLAYBACK_RATE, 0.5)).toBeGreaterThan(0.8)
    expect(interpolateRotationRate(0, HOVER_PLAYBACK_RATE, 1)).toBe(HOVER_PLAYBACK_RATE)
  })

  it('exposes the rotating state for reduced-motion feedback', () => {
    expect(renderToStaticMarkup(<ZenModeIcon rotating />)).toContain(
      'motion-reduce:rotate-45',
    )
  })
})
