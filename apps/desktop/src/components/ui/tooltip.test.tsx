import type { PropsWithChildren } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from './tooltip'

vi.mock('radix-ui', () => ({
  Tooltip: {
    Provider: ({
      children,
      delayDuration,
      skipDelayDuration,
    }: PropsWithChildren<{ delayDuration?: number; skipDelayDuration?: number }>) => (
      <div data-delay={delayDuration} data-skip-delay={skipDelayDuration}>
        {children}
      </div>
    ),
  },
}))

describe('TooltipProvider', () => {
  it('shows tooltips immediately by default', () => {
    const markup = renderToStaticMarkup(
      <TooltipProvider>
        <span>Trigger</span>
      </TooltipProvider>,
    )

    expect(markup).toContain('data-delay="0"')
    expect(markup).toContain('data-skip-delay="0"')
  })
})
