import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  addOpenedFile: vi.fn(),
  createFile: vi.fn(),
  dirname: vi.fn(),
  getFileNodeByPath: vi.fn(),
  getFileObject: vi.fn(),
  getFileObjectByPath: vi.fn(),
  getRootPath: vi.fn(),
  invoke: vi.fn(),
  isAbsolute: vi.fn(),
  openUrl: vi.fn(),
  resolve: vi.fn(),
  setActiveId: vi.fn(),
}))

vi.mock('@/helper/files', () => ({
  getFileObject: mocks.getFileObject,
  getFileObjectByPath: mocks.getFileObjectByPath,
}))
vi.mock('@/helper/filesys', () => ({
  createFile: mocks.createFile,
  getFileNameFromPath: (path: string) => path.split(/[\\/]/).at(-1) ?? path,
}))
vi.mock('@/helper/logger', () => ({
  logger: { warn: vi.fn() },
}))
vi.mock('@/stores/useEditorStore', () => ({
  default: {
    getState: () => ({
      addOpenedFile: mocks.addOpenedFile,
      getFileNodeByPath: mocks.getFileNodeByPath,
      getRootPath: mocks.getRootPath,
      setActiveId: mocks.setActiveId,
    }),
  },
}))
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }))
vi.mock('@tauri-apps/api/path', () => ({
  dirname: mocks.dirname,
  isAbsolute: mocks.isAbsolute,
  resolve: mocks.resolve,
}))
vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl: mocks.openUrl }))

import { isLocalFileLink, openEditorLink, resolveLocalFileLinkPath } from './openEditorLink'

describe('editor links', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.getRootPath.mockReturnValue('/workspace')
    mocks.getFileObject.mockReturnValue({
      id: 'source',
      name: 'source.md',
      kind: 'file',
      path: '/workspace/notes/source.md',
    })
    mocks.dirname.mockResolvedValue('/workspace/notes')
    mocks.isAbsolute.mockImplementation(async (path: string) => path.startsWith('/'))
    mocks.resolve.mockImplementation(async (...paths: string[]) => paths.join('/'))
    mocks.openUrl.mockResolvedValue(undefined)
  })

  it('distinguishes local file paths from external and document-only links', () => {
    expect(isLocalFileLink('./subfolder/test.md')).toBe(true)
    expect(isLocalFileLink('../test.md')).toBe(true)
    expect(isLocalFileLink('/workspace/test.md')).toBe(true)
    expect(isLocalFileLink('C:\\workspace\\test.md')).toBe(true)
    expect(isLocalFileLink('file:///workspace/test.md')).toBe(true)
    expect(isLocalFileLink('https://example.com/test.md')).toBe(false)
    expect(isLocalFileLink('mailto:hello@example.com')).toBe(false)
    expect(isLocalFileLink('#heading')).toBe(false)
  })

  it('resolves relative links from the current file directory', async () => {
    mocks.isAbsolute.mockResolvedValue(false)
    mocks.resolve.mockResolvedValue('/workspace/notes/subfolder/test.md')

    await expect(
      resolveLocalFileLinkPath(
        './subfolder/test.md#heading',
        '/workspace/notes/source.md',
        '/workspace',
      ),
    ).resolves.toBe('/workspace/notes/subfolder/test.md')

    expect(mocks.dirname).toHaveBeenCalledWith('/workspace/notes/source.md')
    expect(mocks.resolve).toHaveBeenCalledWith('/workspace/notes', './subfolder/test.md')
  })

  it.each(['../关于.md', '../%E5%85%B3%E4%BA%8E.md'])(
    'resolves Chinese document links from %s',
    async (href) => {
      mocks.resolve.mockResolvedValue('/workspace/关于.md')
      await expect(resolveLocalFileLinkPath(href, '/workspace/notes/source.md')).resolves.toBe(
        '/workspace/关于.md',
      )
      expect(mocks.resolve).toHaveBeenCalledWith('/workspace/notes', '../关于.md')
    },
  )

  it('opens an existing relative file in the current editor group', async () => {
    const targetFile = {
      id: 'target',
      name: 'test.md',
      kind: 'file',
      path: '/workspace/notes/subfolder/test.md',
    }
    mocks.isAbsolute.mockResolvedValue(false)
    mocks.resolve.mockResolvedValue(targetFile.path)
    mocks.getFileObjectByPath.mockReturnValue(targetFile)

    await expect(openEditorLink('./subfolder/test.md', 'source')).resolves.toBe(true)

    expect(mocks.addOpenedFile).toHaveBeenCalledWith('target')
    expect(mocks.setActiveId).toHaveBeenCalledWith('target')
    expect(mocks.openUrl).not.toHaveBeenCalled()
    expect(mocks.invoke).not.toHaveBeenCalled()
  })

  it('creates an editor entry for an absolute file that exists', async () => {
    const targetPath = '/workspace/shared/data.json'
    const targetFile = {
      id: 'created',
      name: 'data.json',
      kind: 'file',
      path: targetPath,
      ext: 'json',
    }
    mocks.resolve.mockResolvedValue(targetPath)
    mocks.invoke.mockImplementation(async (command: string) => command === 'file_exists')
    mocks.createFile.mockReturnValue(targetFile)

    await expect(openEditorLink(`${targetPath}?raw=1`, 'source')).resolves.toBe(true)

    expect(mocks.createFile).toHaveBeenCalledWith({
      name: 'data.json',
      ext: 'json',
      path: targetPath,
    })
    expect(mocks.addOpenedFile).toHaveBeenCalledWith('created')
    expect(mocks.setActiveId).toHaveBeenCalledWith('created')
  })

  it('opens external URLs in the browser', async () => {
    await expect(openEditorLink('https://example.com/test.md', 'source')).resolves.toBe(true)

    expect(mocks.openUrl).toHaveBeenCalledWith('https://example.com/test.md')
    expect(mocks.resolve).not.toHaveBeenCalled()
  })

  it('does not send a missing local file to the browser', async () => {
    mocks.isAbsolute.mockResolvedValue(false)
    mocks.resolve.mockResolvedValue('/workspace/notes/missing.md')
    mocks.invoke.mockResolvedValue(false)

    await expect(openEditorLink('./missing.md', 'source')).resolves.toBe(false)

    expect(mocks.openUrl).not.toHaveBeenCalled()
    expect(mocks.createFile).not.toHaveBeenCalled()
  })
})
