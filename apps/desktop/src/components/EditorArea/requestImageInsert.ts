import { logger } from '@/helper/logger'
import { dialog } from '@/services/dialog'
import {
  handleInsertLocalImage,
  type InsertedImageAttributes,
} from './imageHandlers'

export const requestImageInsert = async (
  fileId?: string,
): Promise<InsertedImageAttributes | null> => {
  const selection = await dialog.imageInsert()
  if (!selection) return null

  if (selection.type === 'url') {
    return { src: selection.url }
  }

  try {
    return await handleInsertLocalImage(selection.path, fileId)
  } catch (error) {
    logger.error('Failed to insert local image:', error)
    return null
  }
}
