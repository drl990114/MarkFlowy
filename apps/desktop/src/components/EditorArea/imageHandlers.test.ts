import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getMdRelativePath: vi.fn(async (path: string) => path),
  moveImageToLocalFolder: vi.fn(async (path: string) => path),
  readImageFileAsDataUrl: vi.fn(async () => 'data:image/png;base64,image'),
  settingData: {
    when_upload_image: 'insert_path',
    upload_image_save_relative_path: 'assets/images',
  } as Record<string, unknown>,
}))

vi.mock('@/helper', () => ({ sleep: vi.fn() }))
vi.mock('@/helper/files', () => ({
  getFileObject: () => ({
    name: 'note.md',
    path: '/workspace/note.md',
  }),
}))
vi.mock('@/helper/filesys', () => ({
  getFolderPathFromPath: () => '/workspace',
  getMdRelativePath: mocks.getMdRelativePath,
}))
vi.mock('@/helper/image', () => ({
  convertImageToBase64: vi.fn(),
  moveImageToLocalFolder: mocks.moveImageToLocalFolder,
  readFileAsBase64: vi.fn(),
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
      folderData: [{ path: '/workspace' }],
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

import { handleInsertLocalImage } from './imageHandlers'

describe('handleInsertLocalImage', () => {
  beforeEach(() => {
    mocks.settingData = {
      when_upload_image: 'insert_path',
      upload_image_save_relative_path: 'assets/images',
    }
    mocks.getMdRelativePath.mockClear()
    mocks.moveImageToLocalFolder.mockClear()
    mocks.readImageFileAsDataUrl.mockClear()
  })

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
    mocks.getMdRelativePath.mockResolvedValueOnce('assets/images/summer.png')

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
