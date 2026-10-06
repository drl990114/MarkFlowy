import NiceModal from '@ebay/nice-modal-react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { i18nInit } from '../../../../../packages/i18n/src/desktop'
import { summarizeFolderForDeletion, type FolderDeletionSummary } from '@/services/file-deletion'
import { FileDeletionConfirm, type FileDeletionConfirmProps } from './FileDeletionConfirm'

vi.mock('@/i18n', async () => import('../../../../../packages/i18n/src/desktop'))
vi.mock('@/helper/logger', () => ({ logger: { error: vi.fn() } }))
vi.mock('@/services/file-deletion', () => ({ summarizeFolderForDeletion: vi.fn() }))

const folder = { name: '资料', path: '/workspace/资料', kind: 'dir' as const }
const summary: FolderDeletionSummary = { files: 7, folders: 2, complete: true, isSymlink: false }

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

async function show(mode: 'permanent' | 'trash' = 'permanent', isFolder = true) {
  render(<NiceModal.Provider />)
  let result!: Promise<string | null>
  await act(async () => {
    result = NiceModal.show<string | null, Parameters<typeof FileDeletionConfirm>[0], FileDeletionConfirmProps>(
      FileDeletionConfirm,
      { file: isFolder ? folder : { ...folder, kind: 'file' }, mode },
    )
  })
  return { result }
}

beforeEach(async () => {
  await i18nInit({ lng: 'cn' })
  vi.clearAllMocks()
  vi.mocked(summarizeFolderForDeletion).mockResolvedValue(summary)
})

afterEach(async () => {
  cleanup()
  // Radix completes focus restoration in a timer after unmount.
  await new Promise((resolve) => setTimeout(resolve, 0))
  document.body.replaceChildren()
})

describe('file deletion confirmation', () => {
  it('opens immediately, blocks deletion while counting and focuses cancel', async () => {
    const pending = deferred<FolderDeletionSummary>()
    vi.mocked(summarizeFolderForDeletion).mockReturnValue(pending.promise)
    const { result } = await show()
    const confirm = screen.getByRole('button', { name: '永久删除' }) as HTMLButtonElement
    expect(confirm.disabled).toBe(true)
    expect(screen.getByRole('dialog').getAttribute('aria-describedby')).toBeTruthy()
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: '取消' })))
    expect(summarizeFolderForDeletion).toHaveBeenCalledWith(folder.path)
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    await expect(result).resolves.toBe('cancel')
    await act(async () => pending.resolve(summary))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('shows recursive counts and the permanent consequence before confirming', async () => {
    const { result } = await show()
    await waitFor(() => expect(screen.getByText('7 个文件 · 2 个子文件夹')).toBeTruthy())
    expect(screen.getByText('永久删除，无法撤销。')).toBeTruthy()
    const confirm = screen.getByRole('button', { name: '永久删除' }) as HTMLButtonElement
    expect(confirm.disabled).toBe(false)
    fireEvent.click(confirm)
    await expect(result).resolves.toBe('confirm')
  })

  it('keeps a failed scan blocked until a successful retry', async () => {
    vi.mocked(summarizeFolderForDeletion).mockRejectedValueOnce(new Error('permission denied'))
    const { result } = await show()
    await screen.findByRole('alert')
    expect((screen.getByRole('button', { name: '永久删除' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByText('空文件夹')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '重试' }))
    await waitFor(() => expect(screen.getByText('7 个文件 · 2 个子文件夹')).toBeTruthy())
    expect(summarizeFolderForDeletion).toHaveBeenCalledTimes(2)
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    await result
  })

  it('distinguishes a partial lower bound from an empty folder', async () => {
    vi.mocked(summarizeFolderForDeletion).mockResolvedValue({ ...summary, files: 0, folders: 0, complete: false })
    const { result } = await show()
    await waitFor(() => expect(screen.getByText(/至少/)).toBeTruthy())
    expect(screen.queryByText('空文件夹')).toBeNull()
    expect(screen.getByText('统计不完整，实际数量可能更多。')).toBeTruthy()
    expect((screen.getByRole('button', { name: '永久删除' }) as HTMLButtonElement).disabled).toBe(false)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    await expect(result).resolves.toBeNull()
  })

  it('shows an empty folder only after a complete scan', async () => {
    vi.mocked(summarizeFolderForDeletion).mockResolvedValue({ ...summary, files: 0, folders: 0 })
    const { result } = await show()
    await screen.findByText('空文件夹')
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    await result
  })

  it('explains that a root symbolic link has no scanned target contents', async () => {
    vi.mocked(summarizeFolderForDeletion).mockResolvedValue({ ...summary, files: 0, folders: 0, isSymlink: true })
    const { result } = await show('trash')
    await screen.findByText('仅移除链接，不影响目标内容。')
    expect(screen.queryByText('空文件夹')).toBeNull()
    expect(screen.queryByText('此项目及其内容将被移到系统回收站。')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '移到回收站' }))
    await expect(result).resolves.toBe('confirm')
  })

  it('confirms individual files without scanning a directory', async () => {
    const { result } = await show('trash', false)
    expect(summarizeFolderForDeletion).not.toHaveBeenCalled()
    expect((screen.getByRole('button', { name: '移到回收站' }) as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    await result
  })

  it.each([
    { files: 4, folders: 0, label: '4 个文件' },
    { files: 0, folders: 3, label: '3 个子文件夹' },
  ])('omits empty count categories for $label and keeps the path available', async ({ files, folders, label }) => {
    vi.mocked(summarizeFolderForDeletion).mockResolvedValue({ ...summary, files, folders })
    const { result } = await show('trash')
    await screen.findByText(label)
    expect(screen.getByText(folder.path).getAttribute('title')).toBe(folder.path)
    expect(screen.getByText('含隐藏和排除的项目')).toBeTruthy()
    expect(screen.queryByText(/此项目及其内容/)).toBeNull()
    expect(screen.queryByText(/数量以本次扫描/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    await result
  })
})
