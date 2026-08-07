import type { Node } from '@rme-sdk/sdk/pm/model'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EditorDelegate } from '../../types'
import SourceEditor from '.'

const remirrorSpy = vi.hoisted(() => vi.fn())

vi.mock('@rme-sdk/sdk/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@rme-sdk/sdk/react')>()

  return {
    ...actual,
    Remirror: (props: { children?: React.ReactNode; editable?: boolean }) => {
      remirrorSpy(props)
      return <>{props.children}</>
    },
  }
})

vi.mock('../EditorDevTools', () => ({
  EditorDevTools: () => null,
}))

vi.mock('../Editor', () => ({
  defaultStyleToken: {},
}))

vi.mock('./Text', () => ({
  default: () => null,
}))

vi.mock('./delegate', () => ({
  createSourceCodeDelegate: vi.fn(),
}))

const delegate = {
  manager: {},
  stringToDoc: vi.fn(() => ({}) as Node),
  docToString: vi.fn(),
  view: 'SourceCode',
} as unknown as EditorDelegate

describe('SourceEditor editable state', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    root = createRoot(container)
    remirrorSpy.mockClear()
  })

  afterEach(() => {
    act(() => root.unmount())
  })

  it('forwards editable=false to Remirror', () => {
    act(() => root.render(<SourceEditor content='content' delegate={delegate} editable={false} />))

    expect(remirrorSpy).toHaveBeenLastCalledWith(expect.objectContaining({ editable: false }))
  })

  it('keeps source editing enabled by default', () => {
    act(() => root.render(<SourceEditor content='content' delegate={delegate} />))

    expect(remirrorSpy).toHaveBeenLastCalledWith(expect.objectContaining({ editable: true }))
  })
})
