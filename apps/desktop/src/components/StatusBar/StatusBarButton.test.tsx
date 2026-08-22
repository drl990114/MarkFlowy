import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { StatusBarButton } from './StatusBarButton'

describe('StatusBarButton', () => {
  it('uses the desktop chrome button and icon sizing with semantic interaction colors', () => {
    const markup = renderToStaticMarkup(
      <StatusBarButton aria-label='Files' format='icon'>
        <svg aria-hidden='true' />
      </StatusBarButton>,
    )

    expect(markup).toContain('h-[22px]')
    expect(markup).toContain('min-w-[22px]')
    expect(markup).toContain('w-[22px]')
    expect(markup).toContain('[&amp;_svg]:size-3.5')
    expect(markup).toContain('text-content-secondary')
    expect(markup).toContain('hover:bg-control-ghost-hover')
    expect(markup).toContain('hover:text-content-primary')
    expect(markup).toContain('active:bg-control-ghost-pressed')
    expect(markup).toContain('active:text-content-primary')
    expect(markup).toContain('data-mf-status-bar-format="icon"')
  })
})
