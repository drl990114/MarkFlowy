import { getFileObject, getFileObjectByPath } from '@/helper/files'
import { createFile, getFileNameFromPath } from '@/helper/filesys'
import { logger } from '@/helper/logger'
import useEditorStore from '@/stores/useEditorStore'
import { invoke } from '@tauri-apps/api/core'
import { dirname, isAbsolute, resolve } from '@tauri-apps/api/path'
import { openUrl } from '@tauri-apps/plugin-opener'

const PROTOCOL_PATTERN = /^[a-z][a-z\d+.-]*:/i
const WINDOWS_ABSOLUTE_PATH_PATTERN = /^[a-z]:[\\/]/i

export function isLocalFileLink(href: string): boolean {
  const target = href.trim()
  if (!target || target.startsWith('#') || target.startsWith('?') || target.startsWith('//')) {
    return false
  }

  if (WINDOWS_ABSOLUTE_PATH_PATTERN.test(target) || target.startsWith('\\\\')) {
    return true
  }

  return target.toLowerCase().startsWith('file:') || !PROTOCOL_PATTERN.test(target)
}

export async function resolveLocalFileLinkPath(
  href: string,
  sourceFilePath?: string,
  workspaceRootPath?: string,
): Promise<string | undefined> {
  if (!isLocalFileLink(href)) return undefined

  const linkPath = getDecodedLinkPath(href)
  if (!linkPath) return undefined

  try {
    if (await isAbsolute(linkPath)) {
      return await resolve(linkPath)
    }

    const basePath = sourceFilePath ? await dirname(sourceFilePath) : workspaceRootPath
    if (!basePath) return undefined

    return await resolve(basePath, linkPath)
  } catch (error) {
    logger.warn('Failed to resolve local file link:', { error, href })
    return undefined
  }
}

export async function openEditorLink(href: string, sourceFileId?: string): Promise<boolean> {
  const target = href.trim()
  if (!target) return false

  if (!isLocalFileLink(target)) {
    if (target.startsWith('#') || target.startsWith('?')) return false

    try {
      await openUrl(target)
      return true
    } catch (error) {
      logger.warn('Failed to open external link:', { error, href: target })
      return false
    }
  }

  const editor = useEditorStore.getState()
  const sourceFilePath = sourceFileId ? getFileObject(sourceFileId)?.path : undefined
  const targetPath = await resolveLocalFileLinkPath(
    target,
    sourceFilePath,
    editor.getRootPath(),
  )
  if (!targetPath) return false

  let targetFile = getFileObjectByPath(targetPath) ?? editor.getFileNodeByPath(targetPath)
  if (targetFile?.kind === 'dir') return false

  if (!targetFile) {
    try {
      const [exists, isDirectory] = await Promise.all([
        invoke<boolean>('file_exists', { filePath: targetPath }),
        invoke<boolean>('is_dir', { path: targetPath }),
      ])
      if (!exists || isDirectory) return false
    } catch (error) {
      logger.warn('Failed to inspect local file link:', { error, href, targetPath })
      return false
    }

    const fileName = getFileNameFromPath(targetPath)
    targetFile = createFile({
      name: fileName,
      ext: getFileExtension(fileName),
      path: targetPath,
    })
  }

  editor.addOpenedFile(targetFile.id)
  editor.setActiveId(targetFile.id)
  return true
}

function getDecodedLinkPath(href: string): string | undefined {
  const target = href.trim()

  if (target.toLowerCase().startsWith('file:')) {
    try {
      const fileUrl = new URL(target)
      if (fileUrl.protocol !== 'file:') return undefined

      const pathname = decodeURIComponent(fileUrl.pathname)
      if (fileUrl.hostname && fileUrl.hostname !== 'localhost') {
        return `//${fileUrl.hostname}${pathname}`
      }

      return pathname.replace(/^\/([a-z]:\/)/i, '$1')
    } catch {
      return undefined
    }
  }

  try {
    return decodeURIComponent(target.split(/[?#]/, 1)[0])
  } catch {
    return undefined
  }
}

function getFileExtension(fileName: string): string {
  const dotIndex = fileName.lastIndexOf('.')
  return dotIndex > -1 ? fileName.slice(dotIndex + 1) : ''
}
