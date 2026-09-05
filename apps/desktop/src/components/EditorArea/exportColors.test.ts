import { afterEach, describe, expect, it, vi } from 'vitest'
import { normalizeClonedExportColors, normalizeExportCssValue } from './exportColors'

afterEach(() => {
  vi.restoreAllMocks()
  document.body.replaceChildren()
})

describe('export CSS colors', () => {
  it('converts complete nested expressions inside gradients and shadows', () => {
    const convert = vi.fn<(color: string) => string>(() => 'rgba(120, 30, 40, 0.5)')
    expect(
      normalizeExportCssValue(
        'linear-gradient(90deg, color-mix(in srgb, color(display-p3 1 0 0) 40%, transparent), oklch(.6 .1 20))',
        convert,
      ),
    ).toBe('linear-gradient(90deg, rgba(120, 30, 40, 0.5), rgba(120, 30, 40, 0.5))')
    expect(convert.mock.calls.map(([color]) => color)).toEqual([
      'color-mix(in srgb, color(display-p3 1 0 0) 40%, transparent)',
      'oklch(.6 .1 20)',
    ])
    expect(
      normalizeExportCssValue(
        '0 2px 8px color(srgb 1 0 0 / .5), inset 1px 0 oklab(.6 .1 .1)',
        convert,
      ),
    ).toBe('0 2px 8px rgba(120, 30, 40, 0.5), inset 1px 0 rgba(120, 30, 40, 0.5)')
  })

  it.each([
    'url("data:image/svg+xml,<svg fill=\'color(display-p3 1 0 0)\'></svg>")',
    'URL(https://example.com/color(test).png)',
    '"escaped \\" oklch(.5 .2 30)"',
    'rgba(12, 34, 56, .4)',
    'rgb(0, 0, 0)',
    'transparent',
    'color(srgb .1 .2 .3',
  ])('preserves URL/string data, legacy colors and incomplete syntax: %s', (value) => {
    const convert = vi.fn()
    expect(normalizeExportCssValue(value, convert)).toBe(value)
    expect(convert).not.toHaveBeenCalled()
  })

  it('normalizes only the cloned target and its ancestors, including disabled controls, with a color cache', () => {
    const original = document.createElement('div')
    original.innerHTML = '<input type="checkbox" disabled checked>'
    const iframe = document.createElement('iframe')
    document.body.append(original, iframe)
    const clone = iframe.contentDocument!
    const root = original.cloneNode(true) as HTMLElement
    const outside = clone.createElement('aside')
    clone.body.append(root, outside)
    const input = root.querySelector('input')!
    const originalHtml = original.outerHTML
    const color = 'color(srgb .2 .4 .6 / .5)'
    const pixel = new Uint8ClampedArray([51, 102, 153, 128])
    const context = {
      fillStyle: '',
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      getImageData: vi.fn(() => ({ data: pixel })),
    }
    const createElement = clone.createElement.bind(clone)
    vi.spyOn(clone, 'createElement').mockImplementation((tagName: string) => {
      const element = createElement(tagName)
      if (tagName === 'canvas')
        vi.spyOn(element as HTMLCanvasElement, 'getContext').mockReturnValue(
          context as unknown as CanvasRenderingContext2D,
        )
      return element
    })
    const getStyle = vi.spyOn(clone.defaultView!, 'getComputedStyle').mockImplementation(
      (element) =>
        ({
          getPropertyValue: (property: string) => {
            if (element === input && ['color', 'border-top-color'].includes(property)) return color
            if (element === clone.body && property === 'background-color') return color
            if (element === outside && property === 'color') return color
            return ''
          },
        }) as unknown as CSSStyleDeclaration,
    )

    normalizeClonedExportColors(clone, root)

    expect(input.style.color).toBe(`rgba(51, 102, 153, ${128 / 255})`)
    expect(input.style.borderTopColor).toBe(input.style.color)
    expect(clone.body.style.backgroundColor).toBe(input.style.color)
    expect(input.style.getPropertyPriority('color')).toBe('important')
    expect(context.getImageData).toHaveBeenCalledOnce()
    expect(getStyle).not.toHaveBeenCalledWith(outside)
    expect(outside.getAttribute('style')).toBeNull()
    expect(input.disabled).toBe(true)
    expect(input.checked).toBe(true)
    expect(original.outerHTML).toBe(originalHtml)
  })
})
