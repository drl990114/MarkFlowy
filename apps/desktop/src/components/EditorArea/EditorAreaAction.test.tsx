import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { EditorAreaActionButton } from './EditorAreaAction'

describe('EditorAreaActionButton', () => {
  it('renders an accessible native button with a decorative icon', () => {
    const markup = renderToStaticMarkup(
      <EditorAreaActionButton icon='ri-add-line' label='New tab' />,
    )

    expect(markup).toContain('<button')
    expect(markup).toContain('type="button"')
    expect(markup).toContain('aria-label="New tab"')
    expect(markup).toContain('aria-hidden="true"')
  })
})
