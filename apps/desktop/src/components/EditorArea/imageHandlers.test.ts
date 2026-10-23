import { posix } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  fileObject: { name: 'note.md', path: '/workspace/note.md' } as {
    name: string
    path: string
  } | null,
  workspaceRoot: '/workspace' as string | undefined,
  getMdRelativePath: vi.fn<(path: string, relativeTo: string) => Promise<string>>(),
  moveImageToLocalFolder: vi.fn<(path: string, targetPath: string) => Promise<string>>(),
  readFileAsBase64: vi.fn<() => Promise<string>>(),
  readImageFileAsDataUrl: vi.fn(async () => 'data:image/png;base64,image'),
  settingData: {
    when_upload_image: 'insert_path',
    upload_image_save_relative_path: 'assets/images',
  } as Record<string, unknown>,
}))

vi.mock('@/helper', () => ({ sleep: vi.fn() }))
vi.mock('@/helper/files', () => ({
  getFileObject: () => mocks.fileObject,
}))
vi.mock('@/helper/filesys', () => ({
  getFolderPathFromPath: (path?: string) => path ? posix.dirname(path) : undefined,
  getMdRelativePath: mocks.getMdRelativePath,
}))
vi.mock('@/helper/image', () => ({
  convertImageToBase64: vi.fn(),
  moveImageToLocalFolder: mocks.moveImageToLocalFolder,
  readFileAsBase64: mocks.readFileAsBase64,
  readImageFileAsDataUrl: mocks.readImageFileAsDataUrl,
}))
vi.mock('@/helper/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}))
vi.mock('@/stores', () => ({
  useEditorStore: {
    getState: () => ({
      folderData: mocks.workspaceRoot ? [{ path: mocks.workspaceRoot }] : undefined,
    }),
  },
}))
vi.mock('@/stores/useAppSettingStore', () => ({
  default: {
    getState: () => ({
      settingData: mocks.settingData,
    }),
  },
}))
vi.mock('@tauri-apps/api/path', () => ({
  join: vi.fn(async (...parts: string[]) => parts.join('/')),
}))

import { handleImagePaste, handleInsertLocalImage, handleUploadImage } from './imageHandlers'

const imageDataUrl = 'data:image/png;base64,aW1hZ2U='
const imagePath = '/photos/summer.png'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.fileObject = { name: 'note.md', path: '/workspace/note.md' }
  mocks.workspaceRoot = '/workspace'
  mocks.settingData = {
    when_upload_image: 'insert_path',
    upload_image_save_relative_path: 'assets/images',
  }
  mocks.getMdRelativePath.mockImplementation(async (path, relativeTo) =>
    posix.relative(relativeTo, path),
  )
  mocks.moveImageToLocalFolder.mockImplementation(async (_path, targetPath) =>
    `${targetPath}/stored.png`,
  )
  mocks.readFileAsBase64.mockResolvedValue(imageDataUrl)
})

describe('handleInsertLocalImage', () => {
  it('inserts the original local path by default', async () => {
    await expect(
      handleInsertLocalImage('/photos/summer.png', 'note-id'),
    ).resolves.toEqual({
      src: '/photos/summer.png',
      alt: 'summer',
      'data-file-name': 'summer.png',
    })
    expect(mocks.moveImageToLocalFolder).not.toHaveBeenCalled()
  })

  it('reports storage failures to the insertion form when strict handling is requested', async () => {
    mocks.settingData.when_upload_image = 'save_to_local_relative'
    mocks.moveImageToLocalFolder.mockRejectedValueOnce(new Error('storage failed'))
    await expect(handleInsertLocalImage('/photos/picture.png', 'note-id', { throwOnError: true })).rejects.toThrow('storage failed')
  })

  it('normalizes Windows drive paths for Markdown', async () => {
    await expect(
      handleInsertLocalImage('C:\\Photos\\summer.png', 'note-id'),
    ).resolves.toMatchObject({
      src: 'C:/Photos/summer.png',
      alt: 'summer',
    })
  })

  it('uses the configured workspace-relative storage behavior', async () => {
    mocks.settingData.when_upload_image = 'save_to_local_relative'
    mocks.moveImageToLocalFolder.mockResolvedValueOnce(
      '/workspace/assets/images/summer.png',
    )
    await expect(
      handleInsertLocalImage('/photos/summer.png', 'note-id'),
    ).resolves.toMatchObject({
      src: 'assets/images/summer.png',
      alt: 'summer',
    })
    expect(mocks.moveImageToLocalFolder).toHaveBeenCalledWith(
      '/photos/summer.png',
      '/workspace/assets/images',
    )
  })

  it('converts the selected file when Base64 insertion is configured', async () => {
    mocks.settingData.when_upload_image = 'upload_as_base64'

    await expect(
      handleInsertLocalImage('/photos/summer.png', 'note-id'),
    ).resolves.toMatchObject({
      src: 'data:image/png;base64,image',
    })
  })
})

describe.each(['upload', 'paste', 'local insert'] as const)('%s image paths', (entrypoint) => {
  const insertImage = async () => {
    if (entrypoint === 'upload') {
      const progress = vi.fn()
      const [upload] = handleUploadImage([
        { file: new File(['image'], 'summer.png', { type: 'image/png' }), progress },
      ], 'note-id')
      const result = await upload()
      expect(progress).toHaveBeenCalledExactlyOnceWith(1)
      expect(result['data-file-name']).toBe('summer.png')
      return result.src
    }

    if (entrypoint === 'paste') {
      return handleImagePaste(imagePath, 'note-id')
    }

    return (await handleInsertLocalImage(imagePath, 'note-id')).src
  }

  beforeEach(() => {
    mocks.settingData = {
      when_upload_image: 'save_to_file_relative',
      when_paste_image: 'save_to_file_relative',
      upload_image_save_relative_path_rule: '${documentPath}/assets',
      paste_image_save_relative_path_rule: '${documentPath}/assets',
    }
  })

  const expectStorageDirectory = (directory: string) => {
    expect(mocks.moveImageToLocalFolder).toHaveBeenCalledExactlyOnceWith(
      entrypoint === 'upload' ? imageDataUrl : imagePath,
      directory,
    )
  }

  it('returns a document-relative link when a saved Markdown file has no workspace', async () => {
    mocks.fileObject = { name: 'note.md', path: '/documents/note.md' }
    mocks.workspaceRoot = undefined

    await expect(insertImage()).resolves.toBe('assets/stored.png')
    expectStorageDirectory('/documents/assets')
  })

  it('expands the document file name in an asset folder without a workspace', async () => {
    mocks.fileObject = { name: 'my.note.md', path: '/documents/my.note.md' }
    mocks.workspaceRoot = undefined
    mocks.settingData.upload_image_save_relative_path_rule = '${documentPath}/${fileName}.assets'
    mocks.settingData.paste_image_save_relative_path_rule = '${documentPath}/${fileName}.assets'

    await expect(insertImage()).resolves.toBe('my.note.assets/stored.png')
    expectStorageDirectory('/documents/my.note.assets')
  })

  it('keeps file-relative assets beside a nested document in a workspace', async () => {
    mocks.fileObject = { name: 'note.md', path: '/workspace/docs/note.md' }

    await expect(insertImage()).resolves.toBe('assets/stored.png')
    expectStorageDirectory('/workspace/docs/assets')
  })

  it('keeps workspace-relative assets relative to the nested document', async () => {
    mocks.fileObject = { name: 'note.md', path: '/workspace/docs/note.md' }
    mocks.settingData.when_upload_image = 'save_to_local_relative'
    mocks.settingData.when_paste_image = 'save_to_local_relative'
    mocks.settingData.upload_image_save_relative_path = 'assets/images'
    mocks.settingData.paste_image_save_relative_path = 'assets/images'

    await expect(insertImage()).resolves.toBe('../assets/images/stored.png')
    expectStorageDirectory('/workspace/assets/images')
  })

  it('uses the workspace as the base when the document has no saved path', async () => {
    mocks.fileObject = null

    await expect(insertImage()).resolves.toBe('assets/stored.png')
    expectStorageDirectory('/workspace/assets')
  })

  it('preserves the image without writing when neither a document path nor workspace exists', async () => {
    mocks.fileObject = null
    mocks.workspaceRoot = undefined

    await expect(insertImage()).resolves.toBe(entrypoint === 'upload' ? imageDataUrl : imagePath)
    expect(mocks.moveImageToLocalFolder).not.toHaveBeenCalled()
    expect(mocks.getMdRelativePath).not.toHaveBeenCalled()
  })

  it('keeps an absolute link when absolute image storage is configured', async () => {
    mocks.workspaceRoot = undefined
    mocks.settingData.when_upload_image = 'save_to_local_absolute'
    mocks.settingData.when_paste_image = 'save_to_local_absolute'
    mocks.settingData.upload_image_save_absolute_path = '/shared/images'
    mocks.settingData.paste_image_save_absolute_path = '/shared/images'

    await expect(insertImage()).resolves.toBe('/shared/images/stored.png')
    expectStorageDirectory('/shared/images')
    expect(mocks.getMdRelativePath).not.toHaveBeenCalled()
  })
})
