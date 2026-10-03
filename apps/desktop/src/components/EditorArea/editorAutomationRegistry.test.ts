import { expect, it, vi } from 'vitest'
import { EditorAutomationRegistry, type EditorAutomationHandle } from './editorAutomationRegistry'

const handle = (active: boolean, visible: boolean): EditorAutomationHandle => ({
  inspect: () => ({ active, visible, ready: true, mode: 'preview' }),
  readContent: () => 'live document',
  preview: vi.fn(),
  render: vi.fn(),
})

it('selects the active instance and keeps sibling cleanup scoped to its registration', () => {
  const registry = new EditorAutomationRegistry()
  const hidden = handle(false, false)
  const visible = handle(false, true)
  const active = handle(true, true)
  registry.register('file', 'hidden', hidden)
  const stopOld = registry.register('file', 'pane', visible)
  const stopActive = registry.register('file', 'pane', active)
  stopOld()
  expect(registry.get('file')).toBe(active)
  stopActive()
  expect(registry.get('file')).toBe(hidden)
  expect(registry.get('another-file')).toBeUndefined()
})
