import { describe, expect, it, vi } from 'vitest'
import {
  IMAGE_REFERRER_POLICY,
  normalizeImageSourceForBrowser,
  preloadImageSource,
} from './image-source'

describe('normalizeImageSourceForBrowser', () => {
  it('converts legacy public Google Drive links to an embeddable image source', () => {
    expect(
      normalizeImageSourceForBrowser(
        'https://drive.google.com/uc?export=view&id=1NFrn9RSWhYNzUbIUtk4maKMpaVj_E1Mb',
      ),
    ).toBe('https://lh3.googleusercontent.com/d/1NFrn9RSWhYNzUbIUtk4maKMpaVj_E1Mb')
  })

  it('preserves unrelated and invalid image sources', () => {
    expect(normalizeImageSourceForBrowser('https://example.com/image.png')).toBe(
      'https://example.com/image.png',
    )
    expect(normalizeImageSourceForBrowser('./image.png')).toBe('./image.png')
  })
})

describe('preloadImageSource', () => {
  it('sets the referrer policy before starting the request', async () => {
    const assignments: string[] = []
    const image = document.createElement('img')
    Object.defineProperties(image, {
      referrerPolicy: {
        set(value: string) {
          assignments.push(`referrer:${value}`)
        },
      },
      src: {
        set(value: string) {
          assignments.push(`src:${value}`)
          queueMicrotask(() => image.onload?.(new Event('load')))
        },
      },
    })
    const createImage = vi.fn(() => image)

    await expect(preloadImageSource('https://example.com/image.png', createImage)).resolves.toBe(
      'https://example.com/image.png',
    )
    expect(assignments).toEqual([
      `referrer:${IMAGE_REFERRER_POLICY}`,
      'src:https://example.com/image.png',
    ])
  })
})
