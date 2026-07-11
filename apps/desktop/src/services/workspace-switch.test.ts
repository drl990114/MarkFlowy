import { afterEach, describe, expect, it, vi } from 'vitest'
import { setWorkspaceSwitchHandler, switchWorkspaceInCurrentWindow } from './workspace-switch'

describe('workspace switch service', () => {
  afterEach(() => {
    setWorkspaceSwitchHandler()
  })

  it('delegates to the active workspace persistence runtime', async () => {
    const handler = vi.fn().mockResolvedValue(true)
    setWorkspaceSwitchHandler(handler)

    await expect(switchWorkspaceInCurrentWindow('/workspace')).resolves.toBe(true)
    expect(handler).toHaveBeenCalledWith('/workspace')
  })

  it('rejects while workspace persistence is unavailable', async () => {
    await expect(switchWorkspaceInCurrentWindow('/workspace')).rejects.toThrow(
      'Workspace persistence is not ready',
    )
  })

  it('serializes concurrent workspace switches in request order', async () => {
    let finishFirst: (() => void) | undefined
    const calls: string[] = []
    const handler = vi.fn(async (path: string) => {
      calls.push(path)
      if (path === '/first') {
        await new Promise<void>((resolve) => {
          finishFirst = resolve
        })
      }
      return true
    })
    setWorkspaceSwitchHandler(handler)

    const first = switchWorkspaceInCurrentWindow('/first')
    const second = switchWorkspaceInCurrentWindow('/second')
    await vi.waitFor(() => expect(calls).toEqual(['/first']))

    finishFirst?.()
    await expect(Promise.all([first, second])).resolves.toEqual([true, true])
    expect(calls).toEqual(['/first', '/second'])
  })
})
