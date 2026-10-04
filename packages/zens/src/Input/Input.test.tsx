import { createRef } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import Input from './index'
import Tooltip from '../Tooltip'

describe('legacy Input adapter', () => {
  it('preserves both refs and a controlled error tooltip on the real input', () => {
    const ref = createRef<HTMLInputElement>()
    const inputRef = createRef<HTMLInputElement>()
    render(
      <Tooltip title='File exists' open>
        <Input
          aria-label='File name'
          aria-invalid
          data-error='true'
          ref={ref}
          inputRef={inputRef}
        />
      </Tooltip>,
    )
    const input = screen.getByRole('textbox')
    expect(ref.current).toBe(input)
    expect(inputRef.current).toBe(input)
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByRole('tooltip').textContent).toBe('File exists')
    expect(input.getAttribute('aria-describedby')).toContain(screen.getByRole('tooltip').id)
  })

  it('does not commit Enter during composition and retains native event handlers', () => {
    const enter = jest.fn()
    const keyDown = jest.fn()
    const compositionStart = jest.fn()
    const compositionEnd = jest.fn()
    render(
      <Input
        aria-label='File name'
        onPressEnter={enter}
        onKeyDown={keyDown}
        onCompositionStart={compositionStart}
        onCompositionEnd={compositionEnd}
      />,
    )
    const input = screen.getByRole('textbox')
    fireEvent.compositionStart(input)
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true, keyCode: 229 })
    expect(enter).not.toHaveBeenCalled()
    fireEvent.compositionEnd(input, { data: '中文' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(enter).toHaveBeenCalledTimes(1)
    expect(keyDown).toHaveBeenCalledTimes(2)
    expect(compositionStart).toHaveBeenCalledTimes(1)
    expect(compositionEnd).toHaveBeenCalledTimes(1)
  })
})
