import { act, fireEvent, render, screen } from '@testing-library/react'
import Button from './index'

describe('legacy Button adapter', () => {
  afterEach(() => jest.useRealTimers())

  it('owns delayed loading and cancels a pending loading state when the operation ends', () => {
    jest.useFakeTimers()
    const onClick = jest.fn()
    const view = render(
      <Button loading={{ delay: 200 }} onClick={onClick}>
        Save
      </Button>,
    )
    const button = screen.getByRole('button') as HTMLButtonElement
    expect(button.type).toBe('button')
    expect(button.disabled).toBe(false)
    act(() => jest.advanceTimersByTime(200))
    expect(button.disabled).toBe(true)
    expect(button.getAttribute('aria-busy')).toBe('true')
    fireEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
    view.rerender(
      <Button loading={false} onClick={onClick}>
        Save
      </Button>,
    )
    expect(button.disabled).toBe(false)
    view.rerender(
      <Button loading={{ delay: 200 }} onClick={onClick}>
        Save
      </Button>,
    )
    view.rerender(
      <Button loading={false} onClick={onClick}>
        Save
      </Button>,
    )
    act(() => jest.advanceTimersByTime(500))
    expect(button.disabled).toBe(false)
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
