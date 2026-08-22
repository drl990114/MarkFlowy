import { describe, expect, it } from 'vitest'
import { getDockViewportMode } from './useDockViewportMode'

describe('getDockViewportMode', () => {
  it.each([
    [400, 'compact'],
    [719, 'compact'],
    [720, 'medium'],
    [959, 'medium'],
    [960, 'wide'],
    [1200, 'wide'],
  ] as const)('maps %dpx to %s mode', (width, expected) => {
    expect(getDockViewportMode(width)).toBe(expected)
  })
})
