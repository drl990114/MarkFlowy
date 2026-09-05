import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { useEditorStore } from '@/stores'
import useEditorCounterStore from '@/stores/useEditorCounterStore'
import { EditorCount } from './EditorCount'

const radioGroupState = vi.hoisted(() => ({
  onValueChange: undefined as ((value: string) => void) | undefined,
  render: vi.fn(),
}))

vi.mock('@/components/ui/popover', () => {
  const Passthrough = ({ children }: { children: ReactNode }) => <>{children}</>

  return {
    Popover: {
      Content: Passthrough,
      Root: Passthrough,
      Trigger: Passthrough,
    },
  }
})

vi.mock('@/components/ui/radio-group', () => ({
  RadioGroup: {
    Item: ({ value }: { value: string }) => <input readOnly type='radio' value={value} />,
    Root: ({
      children,
      onValueChange,
    }: {
      children: ReactNode
      onValueChange: (value: string) => void
    }) => {
      radioGroupState.onValueChange = onValueChange
      return <div>{children}</div>
    },
  },
}))

vi.mock('@/i18n', () => ({
  useTranslation: () => {
    radioGroupState.render()
    return {
      t: (key: string) =>
        ({
          'statusBar.chars': 'chars',
          'statusBar.displaySettings': 'Display Settings',
          'statusBar.pureChars': 'pure chars',
          'statusBar.pureCharsOption': 'pure chars (no spaces or line breaks)',
          'statusBar.words': 'words',
        })[key] ?? key,
    }
  },
}))

vi.mock('@/stores', async () => {
  const { create } = await import('zustand')
  return {
    useEditorStore: create(() => ({ activeId: 'document-1', opened: [] as string[] })),
  }
})

const reactActEnvironment = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }

beforeAll(() => {
  reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true
})

afterAll(() => {
  delete reactActEnvironment.IS_REACT_ACT_ENVIRONMENT
})

describe('EditorCount', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    useEditorStore.setState({ activeId: 'document-1', opened: [] })
    useEditorCounterStore.setState({
      editorCounterMap: {
        'document-1': {
          characterCount: 15,
          nonWhitespaceCharacterCount: 12,
          wordCount: 3,
        },
      },
    })
    radioGroupState.render.mockClear()
    container = document.createElement('div')
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    radioGroupState.onValueChange = undefined
  })

  it('uses a detailed panel label and a compact pure-character status label', () => {
    act(() => root.render(<EditorCount />))

    expect(container.querySelector('button')?.textContent).toBe('15 chars')
    expect(container.textContent).toContain('pure chars (no spaces or line breaks)')

    act(() => radioGroupState.onValueChange?.('pureChars'))

    expect(container.querySelector('button')?.textContent).toBe('12 pure chars')
  })

  it('ignores unrelated publications and follows counts for the active document', () => {
    act(() => root.render(<EditorCount />))
    radioGroupState.render.mockClear()

    act(() => {
      useEditorCounterStore.getState().addEditorCounter({
        id: 'document-2',
        data: { characterCount: 80, nonWhitespaceCharacterCount: 70, wordCount: 10 },
      })
      useEditorStore.setState({ opened: ['document-1', 'document-2'] })
    })
    expect(radioGroupState.render).not.toHaveBeenCalled()
    expect(container.querySelector('button')?.textContent).toBe('15 chars')

    act(() => {
      useEditorCounterStore.getState().addEditorCounter({
        id: 'document-1',
        data: { characterCount: 16, nonWhitespaceCharacterCount: 13, wordCount: 4 },
      })
    })
    expect(radioGroupState.render).toHaveBeenCalledOnce()
    expect(container.querySelector('button')?.textContent).toBe('16 chars')

    act(() => useEditorStore.setState({ activeId: 'document-2' }))
    expect(container.querySelector('button')?.textContent).toBe('80 chars')
    act(() => radioGroupState.onValueChange?.('words'))
    expect(container.querySelector('button')?.textContent).toBe('10 words')
    act(() => useEditorCounterStore.getState().deleteEditorCounter({ id: 'document-2' }))
    expect(container.querySelector('button')).toBeNull()
  })
})
