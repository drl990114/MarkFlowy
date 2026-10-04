import { cn } from './cn'

describe('shared utility overrides', () => {
  it('resolves variants within the shared prefix and semantic typography groups', () => {
    expect(cn('mfc:px-2 mfc:text-ui-control', 'mfc:px-4 mfc:text-ui-caption')).toBe(
      'mfc:px-4 mfc:text-ui-caption',
    )
  })

  it('retains host utilities for the higher-priority host layer', () => {
    expect(cn('mfc:px-2', 'px-6 mf-custom-control')).toBe('mfc:px-2 px-6 mf-custom-control')
  })
})
