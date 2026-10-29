import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MfCodemirrorView } from 'rme'
import {
  getSourceCodeEditor,
  getSourceCodeFind,
  setSourceCodeEditor,
  sourceCodeViewRegistry,
  subscribeSourceCodeEditors,
} from './sourceCodeEditorRegistry'

const mocks = vi.hoisted(() => ({ createFind: vi.fn(), destroyFind: vi.fn() }))
vi.mock('./sourceCodeFind', () => ({
  SourceFind: class {
    constructor() {
      mocks.createFind()
    }
    destroy() {
      mocks.destroyFind()
    }
  },
}))

const fileId = 'source-registry-file'
const left = { cm: {}, setSearchState: vi.fn() } as unknown as MfCodemirrorView
const right = { cm: {}, setSearchState: vi.fn() } as unknown as MfCodemirrorView

afterEach(() => {
  setSourceCodeEditor(fileId, undefined)
  sourceCodeViewRegistry.remove(fileId, 'left')
  sourceCodeViewRegistry.remove(fileId, 'right')
  vi.clearAllMocks()
})

describe('sourceCodeEditorRegistry', () => {
  it('reads pane resources without replacing the active source or its find API', () => {
    sourceCodeViewRegistry.register(fileId, 'left', left, 'left-group')
    setSourceCodeEditor(fileId, left)
    const find = getSourceCodeFind(left)
    sourceCodeViewRegistry.register(fileId, 'right', right, 'right-group')

    expect(getSourceCodeEditor(fileId)).toBe(left)
    expect(getSourceCodeEditor(fileId, 'right-group')).toBe(right)
    expect(getSourceCodeEditor(fileId, 'missing-group')).toBeUndefined()
    expect(getSourceCodeFind(left)).toBe(find)
    expect(mocks.createFind).toHaveBeenCalledOnce()
    expect(mocks.destroyFind).not.toHaveBeenCalled()

    setSourceCodeEditor(fileId, undefined)
    expect(getSourceCodeEditor(fileId)).toBeUndefined()
    expect(getSourceCodeEditor(fileId, 'left-group')).toBe(left)
    expect(getSourceCodeEditor(fileId, 'right-group')).toBe(right)
  })

  it('notifies on inactive source registration and cleanup without falling back across groups', () => {
    sourceCodeViewRegistry.register(fileId, 'left', left, 'left-group')
    setSourceCodeEditor(fileId, left)
    const listener = vi.fn()
    const unsubscribe = subscribeSourceCodeEditors(listener)

    sourceCodeViewRegistry.register(fileId, 'right', right, 'right-group')
    expect(listener).toHaveBeenCalledOnce()
    sourceCodeViewRegistry.remove(fileId, 'right')
    expect(listener).toHaveBeenCalledTimes(2)
    expect(getSourceCodeEditor(fileId, 'right-group')).toBeUndefined()
    expect(getSourceCodeEditor(fileId)).toBe(left)

    unsubscribe()
    setSourceCodeEditor(fileId, undefined)
    expect(listener).toHaveBeenCalledTimes(2)
  })
})
