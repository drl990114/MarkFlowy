import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Button } from './button'

describe('Button', () => {
  it('uses a legible neutral style for a disabled primary action', () => {
    const container = document.createElement('div')
    container.innerHTML = renderToStaticMarkup(<Button disabled>Insert</Button>)

    const button = container.querySelector('button')
    expect(button?.disabled).toBe(true)
    expect(button?.className).toContain('disabled:bg-control-surface')
    expect(button?.className).toContain('disabled:text-content-secondary')
    expect(button?.className).toContain('disabled:opacity-100')
  })

  it('adds restrained press feedback and removes it for reduced motion', () => {
    const container = document.createElement('div')
    container.innerHTML = renderToStaticMarkup(<Button>Insert</Button>)

    const className = container.querySelector('button')?.className
    expect(className).toContain('active:scale-[0.97]')
    expect(className).toContain('motion-reduce:active:scale-100')
    expect(className).not.toContain('transition-all')
  })

  it('keeps small actions at the legible control type size', () => {
    const container = document.createElement('div')
    container.innerHTML = renderToStaticMarkup(<Button size='sm'>Insert</Button>)

    const className = container.querySelector('button')?.className
    expect(className).toContain('text-ui-control')
    expect(className).not.toContain('text-xs')
  })

  it('provides the shared desktop chrome density contract for icon buttons', () => {
    const container = document.createElement('div')
    container.innerHTML = renderToStaticMarkup(
      <Button aria-label='Toggle files' aria-pressed size='icon-chrome' variant='chrome'>
        <svg aria-hidden='true' />
      </Button>,
    )

    const className = container.querySelector('button')?.className
    expect(className).toContain('size-[22px]')
    expect(className).toContain('[&_svg]:size-3.5')
    expect(className).toContain('text-content-secondary')
    expect(className).toContain('hover:bg-control-ghost-hover')
    expect(className).toContain('hover:text-content-primary')
    expect(className).toContain('focus-visible:ring-1')
    expect(className).toContain('focus-visible:ring-offset-0')
    expect(className).toContain('active:scale-100')
    expect(className).toContain('active:bg-control-ghost-pressed')
    expect(className).toContain('aria-pressed:text-primary')
  })
})
