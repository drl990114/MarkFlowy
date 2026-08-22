import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RenderErrorBoundary } from './RenderErrorBoundary'

const { captureException } = vi.hoisted(() => ({ captureException: vi.fn() }))

vi.mock('@/services/error-reporting', () => ({ captureException }))

describe('RenderErrorBoundary', () => {
  beforeEach(() => {
    captureException.mockClear()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  it('keeps a render failure local and supports an explicit retry', () => {
    let shouldThrow = true
    const Content = () => {
      if (shouldThrow) throw new Error('render failed')
      return <div>Recovered content</div>
    }

    render(
      <RenderErrorBoundary
        fallback={({ error, reset }) => (
          <button
            onClick={() => {
              shouldThrow = false
              reset()
            }}
          >
            Retry {error instanceof Error ? error.message : ''}
          </button>
        )}
      >
        <Content />
      </RenderErrorBoundary>,
    )

    expect(screen.getByRole('button', { name: 'Retry render failed' })).not.toBeNull()
    expect(captureException).toHaveBeenCalledWith(expect.any(Error))

    fireEvent.click(screen.getByRole('button', { name: 'Retry render failed' }))
    expect(screen.getByText('Recovered content')).not.toBeNull()
  })
})
