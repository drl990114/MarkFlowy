import { TooltipProvider } from '@/components/ui/tooltip'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { SideBarModeButton } from './SideBarModeButton'

describe('SideBarModeButton', () => {
  it('exposes the selected mode without exposing its decorative icon', () => {
    const markup = renderToStaticMarkup(
      <TooltipProvider>
        <SideBarModeButton
          active
          icon={<i aria-hidden='true' className='ri-file-list-3-line' />}
          label='Explorer'
          onClick={vi.fn()}
        />
      </TooltipProvider>,
    )

    expect(markup).toContain('aria-label="Explorer"')
    expect(markup).toContain('aria-pressed="true"')
    expect(markup).toContain('aria-hidden="true"')
    expect(markup).toContain('data-slot="tooltip-trigger"')
  })
})
