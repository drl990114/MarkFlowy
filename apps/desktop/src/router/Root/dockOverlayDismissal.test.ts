import { describe, expect, it } from 'vitest'
import { hasOpenInteractiveLayer } from './dockOverlayDismissal'

describe('Dock overlay dismissal ordering', () => {
  it('detects dismissable Radix layers without treating tooltips as blocking layers', () => {
    const root = document.createElement('div')
    root.innerHTML = `
      <div data-mf-portal data-slot="tooltip-content" data-state="delayed-open"></div>
      <div data-mf-portal data-slot="popover-content" data-state="open"></div>
    `

    expect(hasOpenInteractiveLayer(root)).toBe(true)
    root.querySelector('[data-slot="popover-content"]')?.remove()
    expect(hasOpenInteractiveLayer(root)).toBe(false)
  })

  it('detects an open assistant-ui suggestion popover but ignores its closed state', () => {
    const root = document.createElement('div')
    root.innerHTML = '<div class="aui-popover-content" data-state="open"></div>'

    expect(hasOpenInteractiveLayer(root)).toBe(true)
    root.querySelector('.aui-popover-content')?.setAttribute('data-state', 'closed')
    expect(hasOpenInteractiveLayer(root)).toBe(false)
  })
})
