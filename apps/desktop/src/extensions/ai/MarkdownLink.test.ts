import { beforeEach, describe, expect, it, vi } from 'vitest'

const openUrl = vi.hoisted(() => vi.fn<() => Promise<void>>())
const getRootPath = vi.hoisted(() => vi.fn(() => '/workspace'))

vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl }))
vi.mock('@/helper/files', () => ({ getFileObjectByPath: vi.fn() }))
vi.mock('@/helper/filesys', () => ({
  getFileNameFromPath: (path: string) => path.split('/').at(-1) ?? path,
  isMdFile: (path: string) => path.endsWith('.md'),
}))
vi.mock('@/services/editor-file', () => ({ addExistingMarkdownFileEdit: vi.fn() }))
vi.mock('@/services/file-info', () => ({ getFileContent: vi.fn(async () => null) }))
vi.mock('@/stores/useEditorStore', () => ({
  default: { getState: () => ({ getRootPath, addOpenedFile: vi.fn(), setActiveId: vi.fn() }) },
}))

import { isOpenableAiLink, openAiLink, resolveWorkspaceMarkdownPath } from './MarkdownLink'

describe('AI links', () => {
  beforeEach(() => openUrl.mockReset().mockResolvedValue())

  it('opens only allowlisted external protocols through Tauri', async () => {
    await expect(openAiLink('https://example.com/source')).resolves.toBe(true)
    expect(openUrl).toHaveBeenCalledWith('https://example.com/source')
    expect(isOpenableAiLink('mailto:hello@example.com')).toBe(true)
    expect(isOpenableAiLink('javascript:alert(1)')).toBe(false)
  })

  it('resolves relative Markdown links only inside the current workspace', () => {
    expect(resolveWorkspaceMarkdownPath('docs/readme.md', '/workspace')).toBe(
      '/workspace/docs/readme.md',
    )
    expect(resolveWorkspaceMarkdownPath('../outside.md', '/workspace')).toBeUndefined()
    expect(resolveWorkspaceMarkdownPath('/outside/readme.md', '/workspace')).toBeUndefined()
    expect(resolveWorkspaceMarkdownPath('file://remote/workspace/readme.md', '/workspace')).toBeUndefined()
    expect(resolveWorkspaceMarkdownPath('image.png', '/workspace')).toBeUndefined()
  })

  it('handles opener failures without rejecting the UI action', async () => {
    openUrl.mockRejectedValueOnce(new Error('opener unavailable'))
    await expect(openAiLink('https://example.com')).resolves.toBe(false)
  })
})
