import type { Node } from '@rme-sdk/pm/model'
import { act, createRef } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EditorViewType, type EditorDelegate } from '../types'
import { Editor, type EditorRef } from './Editor'

const harness = vi.hoisted(() => ({
  context: undefined as unknown,
  previewHydrationChange: undefined as
    | ((hydration: { settled: Promise<void> } | null) => void)
    | undefined,
}))

vi.mock('../..', () => ({
  EditorViewType: {
    WYSIWYG: 'wysiwyg',
    SOURCECODE: 'sourceCode',
    PREVIEW: 'preview',
  },
  Preview: (props: {
    onImageHydrationChange?: (
      hydration: { settled: Promise<void> } | null,
    ) => void
  }) => {
    harness.previewHydrationChange = props.onImageHydrationChange
    return null
  },
}))

vi.mock('./useContextMounted', () => ({
  useContextMounted: (onContextMounted?: (context: unknown) => void) => {
    onContextMounted?.(harness.context)
  },
}))

vi.mock('./SourceEditor', () => ({
  createSourceCodeDelegate: vi.fn(),
  default: ({ hooks = [] }: { hooks?: (() => void)[] }) => {
    hooks.forEach((useHook) => useHook())
    return null
  },
}))

vi.mock('./WysiwygEditor', () => ({
  createWysiwygDelegate: vi.fn(),
  default: ({ hooks = [] }: { hooks?: (() => void)[] }) => {
    hooks.forEach((useHook) => useHook())
    return null
  },
}))

describe('EditorRef.setContent', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    harness.context = undefined
    harness.previewHydrationChange = undefined
    container = document.createElement('div')
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
  })

  it('restores a divergent view even when the requested content equals the React prop', () => {
    const nextDoc = { content: {} } as unknown as Node
    const currentDoc = {
      content: { size: 7 },
      eq: vi.fn(() => false),
    }
    const transaction = {}
    const replace = vi.fn(() => transaction)
    const dispatch = vi.fn()
    const stringToDoc = vi.fn(() => nextDoc)
    const delegate = {
      manager: {},
      stringToDoc,
      docToString: vi.fn(),
      view: 'Wysiwyg',
    } as unknown as EditorDelegate

    harness.context = {
      view: {
        state: { doc: currentDoc, tr: { replace } },
        dispatch,
      },
    }

    const editorRef = createRef<EditorRef>()
    act(() => root.render(<Editor ref={editorRef} content='persisted' delegate={delegate} />))
    act(() => editorRef.current?.setContent('persisted'))

    expect(stringToDoc).toHaveBeenCalledWith('persisted')
    expect(currentDoc.eq).toHaveBeenCalledWith(nextDoc)
    expect(replace).toHaveBeenCalledOnce()
    expect(dispatch).toHaveBeenCalledWith(transaction)
  })

  it('does not dispatch when the actual view already matches', () => {
    const nextDoc = { content: {} } as unknown as Node
    const currentDoc = {
      content: { size: 7 },
      eq: vi.fn(() => true),
    }
    const replace = vi.fn()
    const dispatch = vi.fn()
    const delegate = {
      manager: {},
      stringToDoc: vi.fn(() => nextDoc),
      docToString: vi.fn(),
      view: 'Wysiwyg',
    } as unknown as EditorDelegate

    harness.context = {
      view: {
        state: { doc: currentDoc, tr: { replace } },
        dispatch,
      },
    }

    const editorRef = createRef<EditorRef>()
    act(() => root.render(<Editor ref={editorRef} content='persisted' delegate={delegate} />))
    act(() => editorRef.current?.setContent('persisted'))

    expect(currentDoc.eq).toHaveBeenCalledWith(nextDoc)
    expect(replace).not.toHaveBeenCalled()
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('waits for the latest Preview image hydration generation', async () => {
    let resolveFirst!: () => void
    let resolveSecond!: () => void
    const firstSettled = new Promise<void>((resolve) => {
      resolveFirst = resolve
    })
    const secondSettled = new Promise<void>((resolve) => {
      resolveSecond = resolve
    })
    const editorRef = createRef<EditorRef>()

    act(() =>
      root.render(
        <Editor
          ref={editorRef}
          content='preview'
          initialType={EditorViewType.PREVIEW}
        />,
      ),
    )
    act(() => {
      harness.previewHydrationChange?.({ settled: firstSettled })
    })

    let waitFinished = false
    const waitForResources = editorRef.current!.waitForPendingResources().then(() => {
      waitFinished = true
    })

    act(() => {
      harness.previewHydrationChange?.({ settled: secondSettled })
      resolveFirst()
    })
    await act(async () => Promise.resolve())
    expect(waitFinished).toBe(false)

    await act(async () => {
      resolveSecond()
      await waitForResources
    })
    expect(waitFinished).toBe(true)
  })
})
