import type { NodeViewComponentProps } from '@rme-sdk/sdk/react'
import { editorLightTheme } from '@markflowy/theme'
import { act, type ComponentProps, type InputHTMLAttributes, type Ref } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { ThemeProvider } from 'styled-components'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ImageToolTips, formatImageByteLength, getEmbeddedImageSourceInfo } from './image-tool-tips'

vi.mock('@markflowy/i18n', () => ({ t: (key: string) => key }))

vi.mock('zens', () => ({
  Button: ({ btnType: _btnType, size: _size, ...props }: Record<string, unknown>) => (
    <button {...props} />
  ),
  Input: ({
    inputRef,
    size: _size,
    ...props
  }: InputHTMLAttributes<HTMLInputElement> & { inputRef?: Ref<HTMLInputElement> }) => (
    <input ref={inputRef} {...props} />
  ),
}))

function findButton(container: HTMLElement, text: string): HTMLButtonElement {
  const button = [...container.querySelectorAll('button')].find(
    (candidate) => candidate.textContent === text,
  )
  if (!button) throw new Error(`Missing button: ${text}`)
  return button
}

describe('embedded image source metadata', () => {
  it('summarizes base64 payloads without decoding them', () => {
    expect(getEmbeddedImageSourceInfo('data:image/png;base64,QUJDRA==')).toEqual({
      byteLength: 4,
      mediaType: 'image/png',
    })
    expect(formatImageByteLength(1536)).toBe('1.5 KB')
  })
})

describe('ImageToolTips', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it('does not mount an embedded base64 source in an input until replacement is requested', async () => {
    const src = `data:image/png;base64,${'A'.repeat(16 * 1024)}`
    const updateAttributes = vi.fn()
    const onRequestClose = vi.fn()
    const props = {
      node: { attrs: { alt: 'old alt', src } },
      onRequestClose,
      updateAttributes,
    } as unknown as ComponentProps<typeof ImageToolTips>

    act(() => {
      root.render(
        <ThemeProvider theme={editorLightTheme}>
          <ImageToolTips {...props} />
        </ThemeProvider>,
      )
    })

    expect(container.querySelectorAll('input')).toHaveLength(1)
    expect(container.textContent).toContain('image.embeddedSource')
    expect(container.textContent).toContain('image/png')

    act(() => findButton(container, 'image.replaceSource').click())
    const [sourceInput, altInput] = [...container.querySelectorAll('input')]
    expect(sourceInput.value).toBe('')
    sourceInput.value = 'https://example.com/replacement.png'
    altInput.value = 'new alt'

    await act(async () => findButton(container, 'image.apply').click())
    expect(updateAttributes).toHaveBeenCalledWith({
      alt: 'new alt',
      src: 'https://example.com/replacement.png',
    })
    expect(onRequestClose).toHaveBeenCalledOnce()
  })

  it('updates the actual reference attribute instead of creating a stray property', async () => {
    const updateAttributes = vi.fn()
    const node = {
      attrs: { alt: 'old alt', 'data-refer-label': 'old-label', src: null },
    } as unknown as NodeViewComponentProps['node']

    act(() => {
      root.render(
        <ThemeProvider theme={editorLightTheme}>
          <ImageToolTips node={node} updateAttributes={updateAttributes} />
        </ThemeProvider>,
      )
    })

    const [labelInput, altInput] = [...container.querySelectorAll('input')]
    labelInput.value = 'new-label'
    altInput.value = 'new alt'
    await act(async () => findButton(container, 'image.apply').click())

    expect(updateAttributes).toHaveBeenCalledWith({
      'data-refer-label': 'new-label',
      alt: 'new alt',
    })
  })

  it('consumes Escape before it reaches the editor and closes without applying changes', () => {
    const onEditorKeyDown = vi.fn()
    const onRequestClose = vi.fn()
    const updateAttributes = vi.fn()
    const node = {
      attrs: { alt: 'old alt', src: 'https://example.com/image.png' },
    } as unknown as NodeViewComponentProps['node']

    act(() => {
      root.render(
        <ThemeProvider theme={editorLightTheme}>
          <div onKeyDown={onEditorKeyDown}>
            <ImageToolTips
              node={node}
              onRequestClose={onRequestClose}
              updateAttributes={updateAttributes}
            />
          </div>
        </ThemeProvider>,
      )
    })

    const sourceInput = container.querySelector('input')!
    sourceInput.focus()
    sourceInput.value = 'https://example.com/changed.png'
    const escapeEvent = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'Escape',
    })

    act(() => sourceInput.dispatchEvent(escapeEvent))

    expect(escapeEvent.defaultPrevented).toBe(true)
    expect(onEditorKeyDown).not.toHaveBeenCalled()
    expect(onRequestClose).toHaveBeenCalledOnce()
    expect(updateAttributes).not.toHaveBeenCalled()
  })
})
