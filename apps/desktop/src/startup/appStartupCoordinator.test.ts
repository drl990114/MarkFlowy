import { expect, it, vi } from 'vitest'
import { createAppStartupCoordinator } from './appStartupCoordinator'

const preload = vi.hoisted(() => vi.fn())
vi.mock('@/components/EditorArea/capricornRuntimeAdapter', () => ({
  preloadCapricornRuntimeFactory: preload,
}))

it('leaves engine preparation to the requested editor instead of shell or workspace setup', async () => {
  const coordinator = createAppStartupCoordinator({
    loadShell: async () => 'settings',
    loadWorkspace: async () => 'workspace',
  })
  await coordinator.start()
  expect(coordinator.getSnapshot()).toMatchObject({
    shell: { status: 'ready', data: 'settings' },
    workspace: { status: 'ready', data: 'workspace' },
  })
  expect(preload).not.toHaveBeenCalled()
})
