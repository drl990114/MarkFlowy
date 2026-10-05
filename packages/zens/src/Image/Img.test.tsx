import React, { Suspense, createRef } from 'react'

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

import Img from './Img'

describe('Img', () => {
  it('retains source fallback, custom containers and the loaded image ref', async () => {
    const ref = createRef<HTMLImageElement>()
    const loader = jest.fn(async (source: string) => {
      if (source === 'broken') throw new Error('unavailable')
      return 'blob:working'
    })
    render(
      <Img
        src={['broken', 'working']}
        imgPromise={loader}
        ref={ref}
        alt='fallback'
        container={(children) => <figure>{children}</figure>}
      />,
    )
    const image = await screen.findByAltText('fallback')
    expect(image.getAttribute('src')).toBe('blob:working')
    expect(image.parentElement?.tagName).toBe('FIGURE')
    expect(ref.current).toBe(image)
    expect(loader.mock.calls.map(([source]) => source)).toEqual(['broken', 'working'])
  })

  it('defers lazy acquisition until intersection and disconnects the observer', async () => {
    const previous = window.IntersectionObserver
    const disconnect = jest.fn()
    let notify: IntersectionObserverCallback | undefined
    const observer = {
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect,
      takeRecords: () => [],
      root: null,
      rootMargin: '',
      thresholds: [],
    }
    window.IntersectionObserver = jest.fn((callback: IntersectionObserverCallback) => {
      notify = callback
      return observer
    }) as unknown as typeof IntersectionObserver
    const loader = jest.fn(async () => 'blob:lazy')
    try {
      render(
        <Img
          src='lazy-source'
          imgPromise={loader}
          lazy
          lazyPlaceholder={<span>Waiting</span>}
          alt='lazy'
        />,
      )
      expect(screen.getByText('Waiting')).not.toBeNull()
      expect(loader).not.toHaveBeenCalled()
      act(() => notify?.([{ isIntersecting: true } as IntersectionObserverEntry], observer))
      expect((await screen.findByAltText('lazy')).getAttribute('src')).toBe('blob:lazy')
      expect(disconnect).toHaveBeenCalled()
    } finally {
      window.IntersectionObserver = previous
    }
  })

  it('keeps the built-in loader stable across initial Suspense retries', async () => {
    const source = 'https://example.com/suspense-image.png'
    const preload = jest.spyOn(window, 'Image').mockImplementation(() => {
      const image = document.createElement('img')
      Object.defineProperty(image, 'src', {
        set() {
          queueMicrotask(() => image.dispatchEvent(new Event('load')))
        },
      })
      return image
    })
    try {
      render(
        <Suspense fallback={<span>loading image</span>}>
          <Img src={source} useSuspense alt='suspense' />
        </Suspense>,
      )
      await waitFor(() => {
        expect(screen.getByAltText('suspense').getAttribute('src')).toBe(source)
      })
      expect(preload).toHaveBeenCalledTimes(1)
    } finally {
      preload.mockRestore()
    }
  })

  it('acquires the same source through each owner and reloads it after reopening', async () => {
    const source = 'https://example.com/shared-owned.png'
    const firstLoader = jest.fn(async () => 'blob:first-owner')
    const secondLoader = jest.fn(async () => 'blob:second-owner')
    const first = render(<Img src={source} imgPromise={firstLoader} alt='first' />)
    render(<Img src={source} imgPromise={secondLoader} alt='second' />)

    await waitFor(() => {
      expect(screen.getByAltText('first').getAttribute('src')).toBe('blob:first-owner')
      expect(screen.getByAltText('second').getAttribute('src')).toBe('blob:second-owner')
    })
    expect(firstLoader).toHaveBeenCalledTimes(1)
    expect(secondLoader).toHaveBeenCalledTimes(1)
    first.unmount()

    const reopenedLoader = jest.fn(async () => 'blob:reopened-owner')
    render(<Img src={source} imgPromise={reopenedLoader} alt='reopened' />)
    await waitFor(() => {
      expect(screen.getByAltText('reopened').getAttribute('src')).toBe('blob:reopened-owner')
    })
    expect(reopenedLoader).toHaveBeenCalledTimes(1)
    expect(screen.getByAltText('second').getAttribute('src')).toBe('blob:second-owner')
  })

  it('shows the configured error state when the rendered image request fails', async () => {
    const onError = jest.fn()
    const source = 'https://example.com/rendered-image-error.jpg'
    const ErrorState = () => <span>image unavailable</span>

    render(
      <Img
        src={source}
        imgPromise={async () => source}
        onError={onError}
        unloader={<ErrorState />}
        useSuspense={false}
      />,
    )

    const image = await screen.findByRole('img')
    fireEvent.error(image)

    expect(await screen.findByText('image unavailable')).not.toBeNull()
    expect(screen.queryByRole('img')).toBeNull()
    expect(onError).toHaveBeenCalledTimes(1)
  })
})
