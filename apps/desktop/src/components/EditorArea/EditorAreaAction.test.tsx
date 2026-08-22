import { TooltipProvider } from '@/components/ui/tooltip'
import { PlusIcon } from 'lucide-react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { EditorAreaActionButton } from './EditorAreaAction'

describe('EditorAreaActionButton', () => {
  it('renders an accessible native button with a decorative icon', () => {
    const markup = renderToStaticMarkup(
      <TooltipProvider>
        <EditorAreaActionButton icon={PlusIcon} label='New tab' />
      </TooltipProvider>,
    )

    expect(markup).toContain('<button')
    expect(markup).toContain('type="button"')
    expect(markup).toContain('aria-label="New tab"')
    expect(markup).toContain('aria-hidden="true"')
    expect(markup).toContain('data-mf-chrome-icon-button=""')
    expect(markup).toContain('size-[22px]')
    expect(markup).toContain('text-content-secondary')
    expect(markup).toContain('hover:text-content-primary')
    expect(markup).toContain('active:scale-100')
    expect(markup).toContain('<svg')
    expect(markup).toContain('width="14"')
    expect(markup).not.toContain('<i')
    expect(markup).not.toContain('aria-pressed="')
  })

  it('uses the semantic selected color only for an explicitly pressed toggle', () => {
    const markup = renderToStaticMarkup(
      <TooltipProvider>
        <EditorAreaActionButton aria-pressed icon={PlusIcon} label='Toggle panel' />
      </TooltipProvider>,
    )

    expect(markup).toContain('aria-pressed="true"')
    expect(markup).toContain('aria-pressed:text-primary')
  })
})
