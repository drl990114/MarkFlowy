import { getFileObject } from '@/helper/files'
import { getFolderPathFromPath, getMdRelativePath } from '@/helper/filesys'
import type { IFile } from '@/helper/filesys'
import {
  convertImageToBase64,
  moveImageToLocalFolder,
  readImageFileAsDataUrl,
  readFileAsBase64,
} from '@/helper/image'
import { logger } from '@/helper/logger'
import { sleep } from '@/helper'
import { useEditorStore } from '@/stores'
import useAppSettingStore from '@/stores/useAppSettingStore'
import { join } from '@tauri-apps/api/path'

export type ImageHandlerContext = {
  fileObject: IFile | null
  fileFolderPath: string | undefined
  workspaceRoot: string | undefined
  settingData: ReturnType<typeof useAppSettingStore.getState>['settingData']
  isTextbundle: boolean | undefined
}

export const getImageHandlerContext = (fileId?: string): ImageHandlerContext => {
  const fileObject = fileId ? getFileObject(fileId) : null
  const fileFolderPath = getFolderPathFromPath(fileObject?.path)
  const workspaceRoot = useEditorStore.getState().folderData?.[0]?.path
  const settingData = useAppSettingStore.getState().settingData
  const isTextbundle = fileFolderPath?.endsWith('.textbundle')

  return {
    fileObject,
    fileFolderPath,
    workspaceRoot,
    settingData,
    isTextbundle,
  }
}

/**
 * Get the file name without extension
 */
export const getFileNameWithoutExt = (fileName?: string): string => {
  if (!fileName) return ''
  const lastDotIndex = fileName.lastIndexOf('.')
  if (lastDotIndex === -1) return fileName
  return fileName.substring(0, lastDotIndex)
}

export type InsertedImageAttributes = {
  src: string
  alt?: string
  title?: string
  'data-file-name'?: string
}

const createImageAttributes = (
  src: string,
  fileName?: string,
): InsertedImageAttributes => {
  const normalizedSrc = /^[a-zA-Z]:\\/.test(src) ? src.replace(/\\/g, '/') : src

  return {
    src: normalizedSrc,
    alt: getFileNameWithoutExt(fileName),
    'data-file-name': fileName,
  }
}

export const handleInsertLocalImage = async (
  filePath: string,
  fileId?: string,
): Promise<InsertedImageAttributes> => {
  const { fileObject, fileFolderPath, workspaceRoot, settingData, isTextbundle } =
    getImageHandlerContext(fileId)
  const fileName = filePath.split(/[\\/]/).pop()

  try {
    if (isTextbundle) {
      const relativeTo = fileFolderPath || workspaceRoot
      if (relativeTo) {
        const fullPath = await moveImageToLocalFolder(filePath, `${relativeTo}/assets`)
        return createImageAttributes(
          await getMdRelativePath(fullPath, relativeTo),
          fileName,
        )
      }
    }

    if (settingData.when_upload_image === 'save_to_local_relative') {
      const targetPath = await join(
        workspaceRoot || '',
        settingData.upload_image_save_relative_path || 'assets/images',
      )
      const fullPath = await moveImageToLocalFolder(filePath, targetPath)
      const src = workspaceRoot
        ? await getMdRelativePath(fullPath, fileFolderPath || workspaceRoot)
        : fullPath
      return createImageAttributes(src, fileName)
    }

    if (
      settingData.when_upload_image === 'save_to_local_absolute' &&
      settingData.upload_image_save_absolute_path
    ) {
      const fullPath = await moveImageToLocalFolder(
        filePath,
        settingData.upload_image_save_absolute_path,
      )
      return createImageAttributes(fullPath, fileName)
    }

    if (settingData.when_upload_image === 'save_to_file_relative') {
      const basePath = fileFolderPath || workspaceRoot
      if (basePath) {
        const targetPath = replacePathVariables(
          settingData.upload_image_save_relative_path_rule ||
            '${documentPath}/assets',
          basePath,
          getFileNameWithoutExt(fileObject?.name),
        )
        const fullPath = await moveImageToLocalFolder(filePath, targetPath)
        const src = workspaceRoot
          ? await getMdRelativePath(fullPath, fileFolderPath || workspaceRoot)
          : fullPath
        return createImageAttributes(src, fileName)
      }
    }

    if (
      settingData.when_upload_image === 'paste_as_base64' ||
      settingData.when_upload_image === 'upload_as_base64'
    ) {
      const dataUrl = await readImageFileAsDataUrl(filePath)
      return createImageAttributes(dataUrl || filePath, fileName)
    }
  } catch (error) {
    logger.error('Local image insertion failed:', error)
  }

  return createImageAttributes(filePath, fileName)
}

/**
 * Replace variables in path rule
 * Supported variables:
 * - ${documentPath}: Parent folder path of the current document
 * - ${fileName}: Current document file name (without extension)
 */
export const replacePathVariables = (pathRule: string, documentPath: string, fileName: string): string => {
  let normalizedPath = pathRule.startsWith('.') ? pathRule.substring(1) : pathRule

  if (!normalizedPath.startsWith('${documentPath}') && !normalizedPath.startsWith('/')) {
    normalizedPath = `${documentPath}/${normalizedPath}`
  }

  return normalizedPath
    .replace(/\$\{documentPath\}/g, documentPath)
    .replace(/\$\{fileName\}/g, fileName)
}

export const handleUploadImage = (files: any[], fileId?: string) => {
  let completed = 0
  const promises: any[] = []

  for (const { file, progress } of files) {
    // eslint-disable-next-line @typescript-eslint/no-loop-func
    promises.push(async () => {
      try {
        const { fileObject, fileFolderPath, workspaceRoot, settingData, isTextbundle } =
          getImageHandlerContext(fileId)

        if (isTextbundle) {
          const targetPath = `${fileFolderPath || workspaceRoot || ''}/assets`
          if (workspaceRoot) {
            const base64 = await readFileAsBase64(file)
            const fullPath = await moveImageToLocalFolder(base64, targetPath)
            completed += 1
            progress(completed / files.length)
            return {
              src: await getMdRelativePath(fullPath, fileFolderPath || workspaceRoot),
              'data-file-name': file.name,
            }
          }
        }

        if (
          settingData.when_upload_image === 'paste_as_base64' ||
          settingData.when_upload_image === 'upload_as_base64'
        ) {
          const src = await readFileAsBase64(file)
          completed += 1
          progress(completed / files.length)
          return {
            src,
            'data-file-name': file.name,
          }
        }

        if (
          settingData.when_upload_image === 'save_to_local_relative' &&
          settingData.upload_image_save_relative_path
        ) {
          const targetPath = await join(
            workspaceRoot || '',
            settingData.upload_image_save_relative_path,
          )
          const base64 = await readFileAsBase64(file)
          const fullPath = await moveImageToLocalFolder(base64, targetPath)
          completed += 1
          progress(completed / files.length)
          if (workspaceRoot) {
            return {
              src: await getMdRelativePath(fullPath, fileFolderPath || workspaceRoot),
              'data-file-name': file.name,
            }
          } else {
            return {
              src: fullPath,
              'data-file-name': file.name,
            }
          }
        }

        if (
          settingData.when_upload_image === 'save_to_local_absolute' &&
          settingData.upload_image_save_absolute_path
        ) {
          const targetPath = settingData.upload_image_save_absolute_path
          const base64 = await readFileAsBase64(file)

          const fullPath = await moveImageToLocalFolder(base64, targetPath)
          completed += 1
          progress(completed / files.length)
          return {
            src: fullPath,
            'data-file-name': file.name,
          }
        }

        if (
          settingData.when_upload_image === 'save_to_file_relative' &&
          settingData.upload_image_save_relative_path_rule
        ) {
          const basePath = fileFolderPath || workspaceRoot || ''
          if (!basePath) {
            throw new Error('No document path or workspace root available')
          }
          const targetPath = replacePathVariables(
            settingData.upload_image_save_relative_path_rule,
            basePath,
            getFileNameWithoutExt(fileObject?.name),
          )
          const base64 = await readFileAsBase64(file)
          const fullPath = await moveImageToLocalFolder(base64, targetPath)
          completed += 1
          progress(completed / files.length)
          if (workspaceRoot) {
            return {
              src: await getMdRelativePath(fullPath, fileFolderPath || workspaceRoot || ''),
              'data-file-name': file.name,
            }
          } else {
            return {
              src: fullPath,
              'data-file-name': file.name,
            }
          }
        }

        if (settingData.when_upload_image === 'insert_path') {
          const src = await readFileAsBase64(file)
          const fallbackTarget =
            settingData.upload_image_save_absolute_path ||
            (fileFolderPath || workspaceRoot
              ? `${fileFolderPath || workspaceRoot}/assets`
              : undefined)

          if (fallbackTarget) {
            const fullPath = await moveImageToLocalFolder(src, fallbackTarget)
            completed += 1
            progress(completed / files.length)
            return {
              src: fullPath,
              'data-file-name': file.name,
            }
          }

          completed += 1
          progress(completed / files.length)
          return {
            src,
            'data-file-name': file.name,
          }
        }
      } catch (error) {
        logger.error('Image upload failed:', error)
        const reader = new FileReader()
        return new Promise<any>((resolve) => {
          reader.addEventListener(
            'load',
            (readerEvent) => {
              completed += 1
              progress(completed / files.length)
              resolve({
                src: readerEvent.target?.result as string,
                'data-file-name': file.name,
              })
            },
            { once: true },
          )
          reader.readAsDataURL(file)
        })
      }
    })
  }

  return promises
}

export const handleImagePaste = async (src: string, fileId?: string): Promise<string> => {
  await sleep(1)

  try {
    const { fileObject, fileFolderPath, workspaceRoot, settingData, isTextbundle } =
      getImageHandlerContext(fileId)

    if (isTextbundle) {
      const targetPath = `${fileFolderPath || workspaceRoot || ''}/assets`

      if (workspaceRoot) {
        const fullPath = await moveImageToLocalFolder(src, targetPath)
        return await getMdRelativePath(fullPath, fileFolderPath || workspaceRoot)
      }
    }

    if (settingData.when_paste_image === 'do_nothing') {
      return src
    }
    if (settingData.when_paste_image === 'paste_as_base64') {
      return await convertImageToBase64(src)
    }
    if (
      settingData.when_paste_image === 'save_to_local_relative' &&
      settingData.paste_image_save_relative_path
    ) {
      const targetPath = await join(
        workspaceRoot || '',
        settingData.paste_image_save_relative_path,
      )
      const fullPath = await moveImageToLocalFolder(src, targetPath)
      if (workspaceRoot) {
        return await getMdRelativePath(fullPath, fileFolderPath || workspaceRoot)
      } else {
        return fullPath
      }
    }

    if (
      settingData.when_paste_image === 'save_to_local_absolute' &&
      settingData.paste_image_save_absolute_path
    ) {
      const targetPath = settingData.paste_image_save_absolute_path
      const fullPath = await moveImageToLocalFolder(src, targetPath)
      return fullPath
    }

    if (
      settingData.when_paste_image === 'save_to_file_relative' &&
      settingData.paste_image_save_relative_path_rule
    ) {
      const basePath = fileFolderPath || workspaceRoot || ''
      if (!basePath) {
        return src
      }
      const targetPath = replacePathVariables(
        settingData.paste_image_save_relative_path_rule,
        basePath,
        getFileNameWithoutExt(fileObject?.name),
      )
      const fullPath = await moveImageToLocalFolder(src, targetPath)

      if (workspaceRoot) {
        return await getMdRelativePath(fullPath, fileFolderPath || workspaceRoot || '')
      } else {
        return fullPath
      }
    }
  } catch (error) {
    logger.error('Image conversion failed:', error)
  }

  return src
}
