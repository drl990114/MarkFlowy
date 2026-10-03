import React, { Suspense } from 'react';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import Img from './Img';

describe('Img', () => {
  it('keeps the built-in loader stable across initial Suspense retries', async () => {
    const source = 'https://example.com/suspense-image.png';
    const preload = jest.spyOn(window, 'Image').mockImplementation(() => {
      const image = document.createElement('img');
      Object.defineProperty(image, 'src', {
        set() { queueMicrotask(() => image.dispatchEvent(new Event('load'))); },
      });
      return image;
    });
    try {
      render(
        <Suspense fallback={<span>loading image</span>}>
          <Img src={source} useSuspense alt='suspense' />
        </Suspense>,
      );
      await waitFor(() => {
        expect(screen.getByAltText('suspense').getAttribute('src')).toBe(source);
      });
      expect(preload).toHaveBeenCalledTimes(1);
    } finally {
      preload.mockRestore();
    }
  });

  it('acquires the same source through each owner and reloads it after reopening', async () => {
    const source = 'https://example.com/shared-owned.png';
    const firstLoader = jest.fn(async () => 'blob:first-owner');
    const secondLoader = jest.fn(async () => 'blob:second-owner');
    const first = render(<Img src={source} imgPromise={firstLoader} alt='first' />);
    render(<Img src={source} imgPromise={secondLoader} alt='second' />);

    await waitFor(() => {
      expect(screen.getByAltText('first').getAttribute('src')).toBe('blob:first-owner');
      expect(screen.getByAltText('second').getAttribute('src')).toBe('blob:second-owner');
    });
    expect(firstLoader).toHaveBeenCalledTimes(1);
    expect(secondLoader).toHaveBeenCalledTimes(1);
    first.unmount();

    const reopenedLoader = jest.fn(async () => 'blob:reopened-owner');
    render(<Img src={source} imgPromise={reopenedLoader} alt='reopened' />);
    await waitFor(() => {
      expect(screen.getByAltText('reopened').getAttribute('src')).toBe('blob:reopened-owner');
    });
    expect(reopenedLoader).toHaveBeenCalledTimes(1);
    expect(screen.getByAltText('second').getAttribute('src')).toBe('blob:second-owner');
  });

  it('shows the configured error state when the rendered image request fails', async () => {
    const onError = jest.fn();
    const source = 'https://example.com/rendered-image-error.jpg';
    const ErrorState = () => <span>image unavailable</span>;

    render(
      <Img
        src={source}
        imgPromise={async () => source}
        onError={onError}
        unloader={<ErrorState />}
        useSuspense={false}
      />,
    );

    const image = await screen.findByRole('img');
    fireEvent.error(image);

    expect(await screen.findByText('image unavailable')).not.toBeNull();
    expect(screen.queryByRole('img')).toBeNull();
    expect(onError).toHaveBeenCalledTimes(1);
  });
});
