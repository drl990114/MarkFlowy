import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { SnippetSetting } from '.'
import { useSnippetStore } from '@/features/snippets/store'
import type { SnippetLibrary, SnippetMutation } from '@/features/snippets/types'
import type { SettingLeaveGuard } from '../types'

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  listen: vi.fn(),
  confirm: vi.fn(),
  preview: vi.fn(),
  t: (key: string) => key,
}))
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }))
vi.mock('@tauri-apps/api/event', () => ({ listen: mocks.listen }))
vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: mocks.t }) }))
vi.mock('@/services/dialog', () => ({ dialog: { confirm: mocks.confirm } }))
vi.mock('./SnippetPreview', () => ({
  default: (props: unknown) => {
    mocks.preview(props)
    return <div>Preview instance</div>
  },
}))
let disk: SnippetLibrary
let guard: SettingLeaveGuard
const registerLeaveGuard = (next: SettingLeaveGuard) => {
  guard = next
  return () => {}
}
beforeEach(() => {
  vi.clearAllMocks()
  disk = {
    version: 1,
    revision: 1,
    items: [{ id: 'user:one', kind: 'math', title: 'Mine', source: 'original' }],
    hiddenBuiltinIds: [],
  }
  useSnippetStore.setState({ library: disk, loaded: true, error: null })
  mocks.listen.mockResolvedValue(() => {})
  mocks.invoke.mockImplementation(
    async (command: string, payload?: { mutation: SnippetMutation; expectedRevision: number }) => {
      if (command === 'get_snippets') return disk
      if (payload!.expectedRevision !== disk.revision) throw new Error('snippets_conflict')
      const { mutation } = payload!
      let { items, hiddenBuiltinIds } = disk
      if (mutation.type === 'upsert')
        items = [...items.filter((item) => item.id !== mutation.item.id), mutation.item]
      else if (mutation.type === 'delete') items = items.filter((item) => item.id !== mutation.id)
      else
        hiddenBuiltinIds = mutation.hidden
          ? [...hiddenBuiltinIds, mutation.id]
          : hiddenBuiltinIds.filter((id) => id !== mutation.id)
      disk = { ...disk, revision: disk.revision + 1, items, hiddenBuiltinIds }
      return disk
    },
  )
})
afterEach(cleanup)
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }))
const source = () => screen.getByLabelText('snippets.source') as HTMLTextAreaElement
const writes = () => mocks.invoke.mock.calls.filter(([command]) => command === 'mutate_snippets')
const mount = () => render(<SnippetSetting registerLeaveGuard={registerLeaveGuard} />)

describe('snippet management', () => {
  it('uses the committed revision when a leave dialog saves before copying or deleting', async () => {
    mount()
    click('Mine')
    await waitFor(() => expect(source().value).toBe('original'))
    fireEvent.change(source(), { target: { value: 'saved before copy' } })
    mocks.confirm.mockResolvedValueOnce('save')
    click('snippets.copy')
    await waitFor(() =>
      expect((screen.getByLabelText('snippets.name') as HTMLInputElement).value).toContain(
        'copySuffix',
      ),
    )
    click('snippets.save')
    await waitFor(() => expect(disk.items).toHaveLength(2))
    fireEvent.change(source(), { target: { value: 'saved before delete' } })
    mocks.confirm.mockResolvedValueOnce('save').mockResolvedValueOnce('delete')
    click('snippets.delete')
    await waitFor(() => expect(disk.items).toHaveLength(1))
    expect(screen.queryByRole('alert')).toBeNull()
  })
  it('copies a read-only builtin to an explicit-save draft, preserves whitespace and deletes a custom entry', async () => {
    mount()
    expect(source().readOnly).toBe(true)
    click('snippets.copyCustom')
    await waitFor(() => expect(source().readOnly).toBe(false))
    fireEvent.change(source(), { target: { value: '\n  ${value}\n\t```\n' } })
    expect(writes()).toHaveLength(0)
    click('snippets.save')
    await waitFor(() => expect(disk.items).toHaveLength(2))
    expect(disk.items[1].source).toBe('\n  ${value}\n\t```\n')
    expect(disk.items[1].id.startsWith('user:')).toBe(true)
    mocks.confirm.mockResolvedValueOnce('delete')
    click('snippets.delete')
    await waitFor(() => expect(disk.items).toHaveLength(1))
  })

  it('hides and restores builtins, searches names and only mounts preview on demand', async () => {
    mount()
    expect(mocks.preview).not.toHaveBeenCalled()
    click('snippets.hide')
    await waitFor(() => expect(disk.hiddenBuiltinIds).toEqual(['builtin:math-fraction']))
    click('snippets.show')
    await waitFor(() => expect(disk.hiddenBuiltinIds).toEqual([]))
    fireEvent.change(screen.getByLabelText('snippets.search'), { target: { value: 'Mine' } })
    expect(screen.queryByRole('button', { name: 'snippets.builtins.math-fraction' })).toBeNull()
    click('Mine')
    await waitFor(() => expect(source().value).toBe('original'))
    click('snippets.preview')
    await screen.findByText('Preview instance')
    fireEvent.change(source(), { target: { value: 'changed' } })
    expect(screen.getByText('snippets.previewStale')).toBeTruthy()
    expect(writes()).toHaveLength(2)
  })

  it('guards selection and closing with cancel, save and discard', async () => {
    mount()
    click('Mine')
    await waitFor(() => expect(source().value).toBe('original'))
    fireEvent.change(source(), { target: { value: 'draft' } })
    mocks.confirm.mockResolvedValueOnce('cancel')
    click('snippets.builtins.math-fraction')
    await waitFor(() => expect(mocks.confirm).toHaveBeenCalledTimes(1))
    expect(source().value).toBe('draft')
    mocks.confirm.mockResolvedValueOnce('save')
    let allowed = false
    await act(async () => {
      allowed = await guard()
    })
    expect(allowed).toBe(true)
    expect(disk.items[0].source).toBe('draft')
    fireEvent.change(source(), { target: { value: 'abandoned' } })
    mocks.confirm.mockResolvedValueOnce('discard')
    click('snippets.builtins.math-fraction')
    await waitFor(() => expect(source().readOnly).toBe(true))
    expect(disk.items[0].source).toBe('draft')
  })

  it('keeps a draft after disk failure and rejects a stale multi-window edit without an automatic retry', async () => {
    mount()
    click('Mine')
    await waitFor(() => expect(source().value).toBe('original'))
    fireEvent.change(source(), { target: { value: 'local unsaved' } })
    mocks.invoke.mockRejectedValueOnce('disk full')
    click('snippets.save')
    await screen.findByRole('alert')
    expect(source().value).toBe('local unsaved')
    expect(disk.items[0].source).toBe('original')
    disk = { ...disk, revision: 2, items: [{ ...disk.items[0], source: 'other window' }] }
    await act(async () => useSnippetStore.setState({ library: disk }))
    click('snippets.save')
    await screen.findByText('snippets.conflict')
    expect(source().value).toBe('local unsaved')
    expect(disk.items[0].source).toBe('other window')
    expect(writes()).toHaveLength(2)
  })
})
