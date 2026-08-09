import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import Img from './Img';

describe('Img', () => {
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
