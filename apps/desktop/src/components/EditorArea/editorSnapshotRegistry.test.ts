import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDeferredLatestPublisher } from './deferredLatestPublisher'
import { EditorSnapshotRegistry } from './editorSnapshotRegistry'

function createHarness() {
  const registry = new EditorSnapshotRegistry()
  const state = { content: 'initial' }
  const writes: string[] = []
  function add(id: string, visible = false, wait = 100) {
    const source = { visible, composing: false, fail: false, afterWrite: () => {} }
    const read = vi.fn((content: string) => registry.publish('file', id, () => {
      if (source.fail) return false
      state.content = content
      writes.push(content)
      source.afterWrite()
      return true
    }))
    const publisher = createDeferredLatestPublisher(read, { wait, maxWait: 1000 })
    const demand = vi.fn((needed: boolean) => {
      if (needed && registry.canRead('file')) publisher.resume()
      else publisher.pause()
    })
    const unregister = registry.register('file', id, {
      canRead: () => !source.composing,
      flush: publisher.flush,
      hasPending: publisher.hasPending,
      isVisible: () => source.visible,
      onSyncDemandChanged: demand,
    })
    return {
      source, publisher, read, demand, unregister,
      change(content: string) {
        registry.changed('file', id)
        publisher.stage(content)
      },
    }
  }
  return { registry, state, writes, add }
}

afterEach(() => vi.useRealTimers())

describe('EditorSnapshotRegistry', () => {
  it('reads pending authors by local change order, independent of registration or active order', () => {
    const { add, registry, state, writes } = createHarness()
    const latestRegisteredFirst = add('latest')
    const olderRegisteredLast = add('older')
    olderRegisteredLast.change('older edit')
    latestRegisteredFirst.change('latest edit')
    registry.flushForRead('file')
    expect(writes).toEqual(['older edit', 'latest edit'])
    expect(state.content).toBe('latest edit')
    expect(registry.hasPending('file')).toBe(false)
  })

  it('consumes older pending timers before a newer timer can publish', () => {
    vi.useFakeTimers()
    const { add, registry, state, writes } = createHarness()
    const older = add('older', false, 500)
    const newer = add('newer', false, 50)
    older.change('older')
    newer.change('newer')
    older.publisher.resume()
    newer.publisher.resume()
    vi.advanceTimersByTime(1000)
    expect(writes).toEqual(['older', 'newer'])
    expect(state.content).toBe('newer')
    expect(registry.hasPending('file')).toBe(false)
  })

  it('rejects reentrant reads throughout timer publication without recursing', () => {
    vi.useFakeTimers()
    const { add, registry } = createHarness()
    const source = add('source')
    source.source.afterWrite = () => {
      expect(() => registry.flushForRead('file')).toThrow('Could not read the latest editor content')
    }
    source.change('latest')
    source.publisher.resume()
    vi.advanceTimersByTime(100)
    expect(source.read).toHaveBeenCalledOnce()
    expect(registry.hasPending('file')).toBe(false)
  })

  it('retains all unread content after a failed older read and succeeds on retry', () => {
    const { add, registry, state, writes } = createHarness()
    const older = add('older')
    const newer = add('newer')
    older.change('older')
    newer.change('newer')
    older.source.fail = true
    expect(() => registry.flushForRead('file')).toThrow('Could not read the latest editor content')
    expect(state.content).toBe('initial')
    expect(newer.read).not.toHaveBeenCalled()
    expect(older.publisher.hasPending()).toBe(true)
    expect(newer.publisher.hasPending()).toBe(true)
    older.source.fail = false
    registry.flushForRead('file')
    expect(writes).toEqual(['older', 'newer'])
  })

  it('does not claim a complete read when publication stages another edit', () => {
    const { add, registry, state } = createHarness()
    const source = add('source')
    source.change('first')
    source.source.afterWrite = () => {
      source.source.afterWrite = () => {}
      source.change('new edit during publication')
    }
    expect(() => registry.flushForRead('file')).toThrow('Could not read the latest editor content')
    expect(source.publisher.hasPending()).toBe(true)
    registry.flushForRead('file')
    expect(state.content).toBe('new edit during publication')
  })

  it('only schedules snapshots for visible sibling demand and pauses removed demand', () => {
    vi.useFakeTimers()
    const { add, registry, state } = createHarness()
    const source = add('source', true)
    const sibling = add('sibling')
    source.change('latest')
    vi.advanceTimersByTime(10_000)
    expect(source.read).not.toHaveBeenCalled()
    sibling.source.visible = true
    registry.updateVisibility('file')
    vi.advanceTimersByTime(0)
    expect(source.read).toHaveBeenCalledOnce()
    expect(state.content).toBe('latest')
    source.change('next')
    registry.updateVisibility('file')
    sibling.source.visible = false
    registry.updateVisibility('file')
    vi.advanceTimersByTime(10_000)
    expect(source.read).toHaveBeenCalledOnce()
    registry.flushForRead('file')
    expect(state.content).toBe('next')
    sibling.unregister()
    expect(source.demand).toHaveBeenLastCalledWith(false)
  })

  it('blocks every author while a sibling composes and resumes after it becomes readable', () => {
    vi.useFakeTimers()
    const { add, registry, state } = createHarness()
    const source = add('source', true)
    const sibling = add('sibling', true)
    source.change('committed edit')
    sibling.source.composing = true
    registry.updateVisibility('file')
    expect(() => registry.flushForRead('file')).toThrow('Finish composing')
    vi.advanceTimersByTime(2000)
    expect(source.read).not.toHaveBeenCalled()
    expect(source.publisher.hasPending()).toBe(true)
    sibling.source.composing = false
    registry.updateVisibility('file')
    vi.advanceTimersByTime(0)
    expect(state.content).toBe('committed edit')
  })
})
