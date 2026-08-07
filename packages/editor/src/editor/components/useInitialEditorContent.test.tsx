import type { Node } from '@rme-sdk/sdk/pm/model'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EditorDelegate } from '../types'
import { useInitialEditorContent } from './useInitialEditorContent'

type Delegate = Pick<EditorDelegate, 'stringToDoc'>

const getLabel = (doc: Node) => (doc as unknown as { label: string }).label

function Harness({ content, delegate }: { content: string; delegate: Delegate }) {
  const initialContent = useInitialEditorContent(delegate, content)

  return <span>{initialContent.ok ? getLabel(initialContent.doc) : 'parse-error'}</span>
}

describe('useInitialEditorContent', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
  })

  it('does not reparse live content updates for the same delegate', () => {
    const firstDoc = { label: 'first' } as unknown as Node
    const stringToDoc = vi.fn(() => firstDoc)
    const delegate = { stringToDoc }

    act(() => root.render(<Harness content='first' delegate={delegate} />))
    act(() => root.render(<Harness content='second' delegate={delegate} />))

    expect(stringToDoc).toHaveBeenCalledOnce()
    expect(stringToDoc).toHaveBeenCalledWith('first')
    expect(container.textContent).toBe('first')
  })

  it('parses again when the delegate changes', () => {
    const firstStringToDoc = vi.fn(() => ({ label: 'first' }) as unknown as Node)
    const secondStringToDoc = vi.fn(() => ({ label: 'second' }) as unknown as Node)

    act(() => root.render(<Harness content='first' delegate={{ stringToDoc: firstStringToDoc }} />))
    act(() =>
      root.render(<Harness content='second' delegate={{ stringToDoc: secondStringToDoc }} />),
    )

    expect(firstStringToDoc).toHaveBeenCalledOnce()
    expect(secondStringToDoc).toHaveBeenCalledOnce()
    expect(secondStringToDoc).toHaveBeenCalledWith('second')
    expect(container.textContent).toBe('second')
  })
})
