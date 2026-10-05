import { act, cleanup, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import useEditorStore from '@/stores/useEditorStore'
import EditorAreaContent from './EditorAreaContent'

const lifecycle = vi.hoisted(() => ({ mounts: 0 }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn().mockResolvedValue(undefined) }))
vi.mock('zens', () => ({ toast: { error: vi.fn() } }))
vi.mock('./EditorLayoutView', async () => {
  const { useState } = await import('react')
  return {
    default: function EditorSession() {
      const [instance] = useState(() => ++lifecycle.mounts)
      return <div data-testid='editor-session'>{instance}</div>
    },
  }
})
vi.mock('./styles', () => ({
  Container: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  EditorPanel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  OverlayScrollbarStyles: () => null,
}))

afterEach(cleanup)

it('keeps the same editor instance when attaching and closing a folder', () => {
  useEditorStore.getState().setFolderData(null)
  render(<EditorAreaContent />)
  const original = screen.getByTestId('editor-session').textContent
  act(() => useEditorStore.getState().setFolderDataPure([{ id: 'w', name: 'w', path: '/w', kind: 'dir' }]))
  expect(screen.getByTestId('editor-session').textContent).toBe(original)
  act(() => useEditorStore.getState().setFolderDataPure(null))
  expect(screen.getByTestId('editor-session').textContent).toBe(original)
})

it('keeps the editor mounted within a workspace and replaces it on a workspace change', () => {
  const setWorkspace = (path: string) =>
    useEditorStore
      .getState()
      .setFolderData([{ id: path, path, name: path, kind: 'dir', children: [] }])
  setWorkspace('/one')
  render(<EditorAreaContent />)
  const original = screen.getByTestId('editor-session').textContent

  act(() =>
    useEditorStore.getState().setEditorLayout({ type: 'leaf', id: 'updated-group', opened: [] }),
  )
  expect(screen.getByTestId('editor-session').textContent).toBe(original)

  act(() => setWorkspace('/two'))
  expect(screen.getByTestId('editor-session').textContent).not.toBe(original)
})
