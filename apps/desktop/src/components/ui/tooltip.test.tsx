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
  it('uses a readable default delay and a short skip window', () => {
    const markup = renderToStaticMarkup(
      <TooltipProvider>
        <span>Trigger</span>
      </TooltipProvider>,
    )

    expect(markup).toContain('data-delay="350"')
    expect(markup).toContain('data-skip-delay="80"')
  })

  it('allows callers to override both delays', () => {
    const markup = renderToStaticMarkup(
      <TooltipProvider delayDuration={500} skipDelayDuration={120}>
        <span>Trigger</span>
      </TooltipProvider>,
    )

    expect(markup).toContain('data-delay="500"')
    expect(markup).toContain('data-skip-delay="120"')
  })
})
