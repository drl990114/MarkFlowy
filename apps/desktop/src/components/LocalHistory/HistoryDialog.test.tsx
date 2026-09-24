import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { HistoryEntry } from '@/services/local-history'
import HistoryDialog from './HistoryDialog'
import HistoryDiff from './HistoryDiff'
import { useHistoryDialog } from './historyDialogStore'

const mocks = vi.hoisted(() => ({
  historyCall: vi.fn(),
  loadHistoryDiff: vi.fn(),
  restoreHistory: vi.fn(),
  captureException: vi.fn(),
}))

vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('@/helper/files', () => ({ getFileObjectByPath: () => ({ id: 'file' }) }))
vi.mock('@/stores/useEditorStore', () => ({
  default: { getState: () => ({ opened: ['file'], getEditorContent: () => 'Current draft' }) },
}))
vi.mock('@/services/local-history', () => ({
  historyCall: mocks.historyCall,
  historyDocument: async () => ({ id: 'document' }),
  historyWorkspace: () => '/workspace',
  useHistoryProtection: () => 0,
}))
vi.mock('@/services/restore-history', () => ({ restoreHistory: mocks.restoreHistory }))
vi.mock('@/services/error-reporting', () => ({ captureException: mocks.captureException }))
vi.mock('./historyDiffLoader', () => ({ loadHistoryDiff: mocks.loadHistoryDiff }))

const entry: HistoryEntry = {
  id: 'version',
  documentId: 'document',
  name: 'Document.md',
  path: '/workspace/Document.md',
  kind: 'save',
  message: 'Saved version',
  createdAt: 1,
  updatedAt: 1,
  active: false,
  beforeHash: 'before',
  afterHash: 'after',
}

beforeEach(() => {
  vi.clearAllMocks()
  useHistoryDialog.setState({ open: true, fileId: 'file' })
  mocks.loadHistoryDiff.mockResolvedValue({ default: HistoryDiff })
  mocks.restoreHistory.mockResolvedValue(undefined)
  mocks.historyCall.mockImplementation(async (operation: string, payload: { before?: boolean }) => {
    if (operation === 'list') return [entry]
    if (operation === 'exists') return true
    if (operation === 'read') return { content: payload.before ? 'Original text' : 'Saved text' }
    throw new Error(`Unexpected history operation: ${operation}`)
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

async function selectVersion() {
  fireEvent.click(await screen.findByRole('button', { name: /Saved version/ }))
}

async function expectDiff(before: string, after: string) {
  await waitFor(() => {
    const panes = document.querySelectorAll('.cm-content')
    expect(panes).toHaveLength(2)
    expect(panes[0].textContent).toBe(before)
    expect(panes[1].textContent).toBe(after)
  })
}

describe('local history selection', () => {
  it('loads the diff only after selecting a version and compares it with the current draft', async () => {
    render(<HistoryDialog />)
    await screen.findByRole('button', { name: /Saved version/ })
    expect(mocks.loadHistoryDiff).not.toHaveBeenCalled()

    await selectVersion()
    await expectDiff('Saved text', 'Current draft')
    expect(mocks.historyCall).toHaveBeenCalledWith('read', { entryId: 'version', before: false })
    expect(mocks.loadHistoryDiff).toHaveBeenCalledOnce()
  })

  it('keeps a failed module import inside history, shows readable snapshots, and retries the import', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const failure = new TypeError('Importing a module script failed.')
    mocks.loadHistoryDiff.mockRejectedValueOnce(failure)
    render(
      <>
        <textarea aria-label='Open document draft' defaultValue='Unsaved writing' />
        <HistoryDialog />
      </>,
    )

    await selectVersion()
    expect((await screen.findByRole('alert')).textContent).toContain('history.compare_failed')
    expect(screen.getByRole('dialog')).not.toBeNull()
    expect(mocks.captureException).toHaveBeenCalledWith(failure)
    const before = screen.getByRole('textbox', { name: 'history.before' }) as HTMLTextAreaElement
    const after = screen.getByRole('textbox', { name: 'history.after' }) as HTMLTextAreaElement
    expect(before.value).toBe('Saved text')
    expect(after.value).toBe('Current draft')
    expect(before.readOnly && after.readOnly).toBe(true)
    expect(
      (screen.getByRole('button', { name: 'history.restore' }) as HTMLButtonElement).disabled,
    ).toBe(false)
    expect((screen.getByLabelText('Open document draft') as HTMLTextAreaElement).value).toBe(
      'Unsaved writing',
    )

    fireEvent.click(screen.getByRole('button', { name: 'common.retry' }))
    await expectDiff('Saved text', 'Current draft')
    expect(mocks.loadHistoryDiff).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('alert')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'history.restore' }))
    await waitFor(() => expect(mocks.restoreHistory).toHaveBeenCalledWith('version', false))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('can restore the original snapshot while the diff module is unavailable', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    mocks.loadHistoryDiff.mockRejectedValueOnce(new TypeError('Importing a module script failed.'))
    useHistoryDialog.setState({ fileId: undefined })
    render(<HistoryDialog />)

    await selectVersion()
    await screen.findByRole('alert')
    expect(
      (screen.getByRole('textbox', { name: 'history.before' }) as HTMLTextAreaElement).value,
    ).toBe('Original text')
    expect(
      (screen.getByRole('textbox', { name: 'history.after' }) as HTMLTextAreaElement).value,
    ).toBe('Saved text')

    fireEvent.click(screen.getByRole('button', { name: 'history.restore_before' }))
    await waitFor(() => expect(mocks.restoreHistory).toHaveBeenCalledWith('version', true))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })
})
