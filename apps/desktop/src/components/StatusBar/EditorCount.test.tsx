import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { EditorCount } from './EditorCount'

const radioGroupState = vi.hoisted(() => ({
  onValueChange: undefined as ((value: string) => void) | undefined,
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
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'statusBar.chars': 'chars',
        'statusBar.displaySettings': 'Display Settings',
        'statusBar.pureChars': 'pure chars',
        'statusBar.pureCharsOption': 'pure chars (no spaces or line breaks)',
        'statusBar.words': 'words',
      })[key] ?? key,
  }),
}))

vi.mock('@/stores', () => ({
  useEditorStore: () => ({ activeId: 'document-1' }),
}))

vi.mock('@/stores/useEditorCounterStore', () => ({
  default: () => ({
    editorCounterMap: {
      'document-1': {
        characterCount: 15,
        nonWhitespaceCharacterCount: 12,
        wordCount: 3,
      },
    },
  }),
}))

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
})
