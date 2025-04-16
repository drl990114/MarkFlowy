import { extname } from '@tauri-apps/api/path'
import { EditorViewType } from 'rme'

export type FileType = 'markdown' | 'image' | 'json' | 'text' | 'unknown'

export interface FileTypeConfig {
  type: FileType
  supportedModes: Array<EditorViewType>
  defaultMode: EditorViewType
  exporters?: Array<string>
}

const fileTypeConfigs: Record<string, FileTypeConfig> = {
  md: {
    type: 'markdown',
    supportedModes: [EditorViewType.PREVIEW, EditorViewType.WYSIWYG, EditorViewType.SOURCECODE],
    defaultMode: EditorViewType.WYSIWYG,
    exporters: ['Html', 'Image']
  },
  json: {
    type: 'json',
    supportedModes: [EditorViewType.SOURCECODE],
    defaultMode: EditorViewType.SOURCECODE,
  },
  txt: {
    type: 'text',
    supportedModes: [EditorViewType.SOURCECODE],
    defaultMode: EditorViewType.SOURCECODE,
  },
  jpg: {
    type: 'image',
    supportedModes: [EditorViewType.PREVIEW],
    defaultMode: EditorViewType.PREVIEW,
  },
  jpeg: {
    type: 'image',
    supportedModes: [EditorViewType.PREVIEW],
    defaultMode: EditorViewType.PREVIEW,
  },
  png: {
    type: 'image',
    supportedModes: [EditorViewType.PREVIEW],
    defaultMode: EditorViewType.PREVIEW,
  },
  gif: {
    type: 'image',
    supportedModes: [EditorViewType.PREVIEW],
    defaultMode: EditorViewType.PREVIEW,
  },
}

export const isTextfileType = (fileTypeConfig: FileTypeConfig): boolean => {
  return ['markdown', 'json', 'text'].includes(fileTypeConfig.type)
}

export async function getFileTypeConfig(filePath: string): Promise<FileTypeConfig> {
  const ext = await extname(filePath)

  return (
    fileTypeConfigs[ext.toLowerCase()] || {
      type: 'unknown',
      supportedModes: [EditorViewType.SOURCECODE],
      defaultMode: EditorViewType.SOURCECODE,
    }
  )
}

export function isSupportedMode(config: FileTypeConfig, mode: string): boolean {
  return config.supportedModes.includes(mode as any)
}
