import { describe, expect, it, vi } from 'vitest'
import { writeText } from '@tauri-apps/plugin-clipboard-manager'
import { toast } from 'zens'
import { capricornClipboard, handleCapricornClipboardResult } from './capricornClipboard'

vi.mock('@tauri-apps/plugin-clipboard-manager', () => ({ writeText: vi.fn() }))
vi.mock('zens', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }))
vi.mock('@/i18n', () => ({ i18n: { t: (key: string) => key } }))

describe('Capricorn clipboard host adapter', () => {
  it('uses the existing native writer and propagates failures', async () => {
    const failure = new Error('Native clipboard unavailable')
    vi.mocked(writeText).mockRejectedValueOnce(failure)
    await expect(capricornClipboard.writeText('**complete Markdown**')).rejects.toBe(failure)
    expect(writeText).toHaveBeenCalledWith('**complete Markdown**')
  })

  it('distinguishes completed cuts, copies and retained originals', () => {
    handleCapricornClipboardResult({ action: 'cut', status: 'markdown' })
    expect(toast.success).toHaveBeenLastCalledWith('capricorn.clipboard.cut_markdown')
    handleCapricornClipboardResult({ action: 'copy', status: 'markdown' })
    expect(toast.success).toHaveBeenLastCalledWith('capricorn.clipboard.copied_markdown')
    handleCapricornClipboardResult({ action: 'cut', status: 'retained' })
    expect(toast).toHaveBeenLastCalledWith('capricorn.clipboard.retained')
    handleCapricornClipboardResult({ action: 'cut', status: 'failed' })
    expect(toast.error).toHaveBeenLastCalledWith('capricorn.clipboard.failed')
  })
})
