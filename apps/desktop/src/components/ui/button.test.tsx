import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Button } from './button'

describe('Button', () => {
  it('uses a legible neutral style for a disabled primary action', () => {
    const container = document.createElement('div')
    container.innerHTML = renderToStaticMarkup(<Button disabled>Insert</Button>)

    const button = container.querySelector('button')
    expect(button?.disabled).toBe(true)
    expect(button?.className).toContain('disabled:bg-secondary')
    expect(button?.className).toContain('disabled:text-foreground-secondary')
    expect(button?.className).toContain('disabled:opacity-100')
  })
})
