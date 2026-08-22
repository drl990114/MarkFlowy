import { describe, expect, it } from 'vitest'
import { cn } from './cn'

describe('cn', () => {
  it('keeps semantic type sizes alongside text colors', () => {
    expect(cn('text-ui-control', 'text-primary-foreground')).toBe(
      'text-ui-control text-primary-foreground',
    )
    expect(cn('text-ui-caption', 'text-content-muted')).toBe(
      'text-ui-caption text-content-muted',
    )
  })

  it('merges semantic type sizes with standard and semantic sizes', () => {
    expect(cn('text-sm', 'text-ui-control', 'text-foreground')).toBe(
      'text-ui-control text-foreground',
    )
    expect(cn('text-ui-control', 'text-ui-body', 'text-foreground')).toBe(
      'text-ui-body text-foreground',
    )
  })
})
