import { afterEach, describe, expect, it, vi } from 'vitest'
import { createCapricornExportSurface } from './capricornExportSurface'
import type { CapricornRuntimeSession } from './capricornRuntimeAdapter'

afterEach(() => {
  document.body.replaceChildren()
  vi.useRealTimers()
})

describe('export surface cleanup', () => {
  it.each(['mount', 'resources', 'timeout'])(
    'removes its surface after a %s failure',
    async (failure) => {
      vi.useFakeTimers()
      const source = document.createElement('div')
      document.body.append(source)
      const destroy = vi.fn()
      const promise = createCapricornExportSurface({
        source,
        markdown: 'Snapshot',
        options: {},
        loadRuntime: async () => () => {
          if (failure === 'mount') throw new Error('Mount failed')
          return {
            destroy,
            waitForResources: () =>
              failure === 'resources'
                ? Promise.reject(new Error('Resource failed'))
                : new Promise(() => {}),
          } as unknown as CapricornRuntimeSession
        },
      })
      const rejected = expect(promise).rejects.toThrow()
      await vi.runAllTimersAsync()
      await rejected
      expect(destroy).toHaveBeenCalledTimes(failure === 'mount' ? 0 : 1)
      expect(document.querySelector('[data-mf-capricorn-export]')).toBeNull()
      expect(source.isConnected).toBe(true)
    },
  )
})
